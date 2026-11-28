/**
 * Lead and website-inquiry unit tests (ADR-0011 port step 3b).
 *
 * @remarks
 * Record rules the database cannot express: visibility (managers see all,
 * others only their own; invisible = 404), assignment (managers only,
 * assignee must be a member with `lead:read`), conversion (open leads only,
 * atomic), and website capture (idempotent replays, attachment limits).
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TCustomerSelect } from '@drizzle/schemas/customer.schema';
import type { TTx } from '@drizzle/types';
import type {
	LeadStatus,
	TLeadActivitySelect,
	TLeadSelect,
} from '@drizzle/schemas/project.schema';
import { type ErpPermissionRequest, LEAD_SOURCE_VALUES, zodIssuesToFormErrors } from '@ims-erp/common';
import { LEAD_SOURCES } from '@drizzle/schemas/project.schema';
import { createLeadSchema } from '../../src/app/project/contracts/lead.contract';
import type {
	ILeadActivityRepository,
	ILeadAttachmentRepository,
	ILeadRepository,
	TInquiryCreateData,
	TLeadAttachmentData,
	TLeadCreateData,
	TLeadPaginationRequest,
	TLeadUpdateData,
} from '../../src/app/project/contracts/lead.repository.interface';
import { rfqSubmissionSchema } from '../../src/app/project/contracts/website-inquiry.contract';
import {
	LeadAlreadyConvertedError,
	LeadAssigneeInvalidError,
	LeadAssignForbiddenError,
	LeadClosedError,
	LeadCustomerUnavailableError,
	LeadLostError,
	LeadNotFoundError,
	WebsiteInquiryError,
} from '../../src/app/project/errors/lead.errors';
import { LeadService, type TLeadContext } from '../../src/app/project/services/lead.service';
import { WebsiteInquiryService } from '../../src/app/project/services/website-inquiry.service';

const ORG = 'org-sales';
const MANAGER: TLeadContext = { organizationId: ORG, actorUserId: 'manager', canManage: true };
const ALICE: TLeadContext = { organizationId: ORG, actorUserId: 'alice', canManage: false };
const BOB: TLeadContext = { organizationId: ORG, actorUserId: 'bob', canManage: false };
/** Members of ORG and their roles; `outsider` belongs to no organization. */
const MEMBER_ROLES: Record<string, string> = { manager: 'sales_manager', alice: 'sales', bob: 'sales', clerk: 'warehouse' };
const ACTIVE_CUSTOMER = '01920000-0000-7000-8000-0000000000c1';

class FakeLeads implements ILeadRepository {
	rows: TLeadSelect[] = [];
	raceOnNextInquiry = false;

	async paginate(request: TLeadPaginationRequest) {
		const data = this.rows.filter(
			(row) => request.ownerUserId === undefined || row.ownerUserId === request.ownerUserId,
		);
		return { meta: { page: 1, limit: 20, total: data.length, totalPages: 1 }, data };
	}
	async listFollowUpsDue(until: Date) {
		return this.rows.filter(
			(row) => row.nextFollowUpAt && row.nextFollowUpAt <= until && !['won', 'lost'].includes(row.status),
		);
	}
	async findById(id: string) {
		return this.rows.find((row) => row.id === id) ?? null;
	}
	async findByIdempotencyKey(key: string) {
		return this.rows.find((row) => row.idempotencyKey === key) ?? null;
	}
	async create(data: TLeadCreateData) {
		const row = { ...data, id: crypto.randomUUID(), status: 'new', customerId: null, createdAt: new Date() } as unknown as TLeadSelect;
		this.rows.push(row);
		return row;
	}
	async createInquiry(data: TInquiryCreateData, _tx?: TTx) {
		if (this.raceOnNextInquiry) {
			this.raceOnNextInquiry = false;
			// The concurrent request committed first with the same key.
			this.rows.push({ ...data, id: crypto.randomUUID(), reference: 'RFQ-FIRST' } as unknown as TLeadSelect);
			throw Object.assign(new Error('duplicate'), { code: '23505' });
		}
		const row = { ...data, id: crypto.randomUUID(), source: 'website', status: 'new', ownerUserId: null, createdAt: new Date() } as unknown as TLeadSelect;
		this.rows.push(row);
		return row;
	}
	async update(id: string, patch: TLeadUpdateData) {
		const row = await this.findById(id);
		return row && row.status !== 'won' ? Object.assign(row, patch) : null;
	}
	async setStatus(id: string, status: LeadStatus, lostReason: string | null) {
		const row = await this.findById(id);
		return row && row.status !== 'won' ? Object.assign(row, { status, lostReason }) : null;
	}
	async markQuoted(id: string) {
		const row = await this.findById(id);
		return row && ['new', 'contacted', 'survey'].includes(row.status)
			? Object.assign(row, { status: 'quotation' as LeadStatus })
			: null;
	}
	async assign(id: string, ownerUserId: string | null) {
		const row = await this.findById(id);
		return row ? Object.assign(row, { ownerUserId }) : null;
	}
	async markConverted(id: string, customerId: string) {
		const row = await this.findById(id);
		if (!row || row.status === 'won' || row.status === 'lost' || row.customerId) return null;
		return Object.assign(row, { status: 'won', customerId });
	}
	async softDelete(id: string) {
		const index = this.rows.findIndex((row) => row.id === id);
		if (index >= 0) this.rows.splice(index, 1);
		return index >= 0;
	}
}

class FakeAttachments implements ILeadAttachmentRepository {
	rows: (TLeadAttachmentData & { id: string; leadId: string })[] = [];
	async listByLead(leadId: string) {
		return this.rows.filter((a) => a.leadId === leadId) as never;
	}
	async createMany(leadId: string, files: TLeadAttachmentData[], _tx?: TTx) {
		this.rows.push(...files.map((file) => ({ ...file, id: crypto.randomUUID(), leadId })));
	}
}

class FakeActivities implements ILeadActivityRepository {
	rows: TLeadActivitySelect[] = [];
	async listByLead(leadId: string) {
		return this.rows.filter((row) => row.leadId === leadId);
	}
	async create(data: Parameters<ILeadActivityRepository['create']>[0]) {
		const row = { ...data, id: crypto.randomUUID() } as TLeadActivitySelect;
		this.rows.push(row);
		return row;
	}
}

const leadInput = (extra: Record<string, unknown> = {}) =>
	createLeadSchema.parse({ name: 'Budi', phone: '0812 3456 7890', source: 'phone', ...extra });

const published: { topic: string; id: string }[] = [];
const outbox = { publish: async (topic: string, aggregate: { id: string }) => void published.push({ topic, id: aggregate.id }) as never };

describe('LeadService', () => {
	let leads: FakeLeads;
	let activities: FakeActivities;
	let createdCustomers: string[];
	let service: LeadService;

	beforeEach(() => {
		leads = new FakeLeads();
		activities = new FakeActivities();
		createdCustomers = [];
		service = new LeadService(
			leads,
			activities,
			new FakeAttachments(),
			{
				getActiveCustomer: async (id: string) => (id === ACTIVE_CUSTOMER ? ({ id } as TCustomerSelect) : null),
				createCustomer: async (input: { code: string }) => {
					createdCustomers.push(input.code);
					return { id: '01920000-0000-7000-8000-0000000000c9' } as TCustomerSelect;
				},
			} as never,
			{ getMemberRole: async (organizationId: string, userId: string) => (organizationId === ORG ? (MEMBER_ROLES[userId] ?? null) : null) },
			{
				// Only the warehouse role lacks lead access.
				hasPermission: async (_org: string, roles: readonly string[], request: ErpPermissionRequest) =>
					!(roles.includes('warehouse') && 'lead' in request),
			},
			{ getUser: async (id: string) => ({ id, name: `User ${id}` }) as never },
			{ presignGet: (key: string) => `https://files.test/${key}` },
			outbox,
		);
	});

	test('a new lead is published to n8n as lead.created', async () => {
		published.length = 0;
		const lead = await service.create(ALICE, leadInput());
		expect(published).toEqual([{ topic: 'lead.created', id: lead.id }]);
	});

	test('a WhatsApp chat becomes an unassigned whatsapp lead, published to n8n (M04 contract)', async () => {
		published.length = 0;
		const lead = await service.captureFromChat('cs-1', { name: 'Budi', whatsapp: '+6281234567890', needs: 'WhatsApp:\nSwing gate' });
		expect(lead).toMatchObject({ name: 'Budi', whatsapp: '+6281234567890', source: 'whatsapp', ownerUserId: null, createdBy: 'cs-1', needs: 'WhatsApp:\nSwing gate' });
		expect(published).toEqual([{ topic: 'lead.created', id: lead.id }]);
	});

	test('non-managers own what they create and only see their own leads (others answer 404)', async () => {
		const mine = await service.create(ALICE, leadInput({ assignedTo: 'bob' }));
		expect(mine.ownerUserId).toBe('alice');
		await service.create(BOB, leadInput());
		expect((await service.list(ALICE, { page: 1, limit: 20 })).data.map((l) => l.ownerUserId)).toEqual(['alice']);
		expect((await service.list(MANAGER, { page: 1, limit: 20 })).data).toHaveLength(2);
		await expect(service.get(BOB, mine.id)).rejects.toBeInstanceOf(LeadNotFoundError);
		expect((await service.get(ALICE, mine.id)).assignee).toEqual({ userId: 'alice', name: 'User alice' });
	});

	test('only managers assign, and only to members of their organization with lead access', async () => {
		const lead = await service.create(MANAGER, leadInput({ assignedTo: null }));
		expect(lead.ownerUserId).toBeNull();
		await expect(service.assign(ALICE, lead.id, 'alice')).rejects.toBeInstanceOf(LeadAssignForbiddenError);
		await expect(service.assign(MANAGER, lead.id, 'clerk')).rejects.toBeInstanceOf(LeadAssigneeInvalidError);
		await expect(service.assign(MANAGER, lead.id, 'outsider')).rejects.toBeInstanceOf(LeadAssigneeInvalidError);
		expect((await service.assign(MANAGER, lead.id, 'bob')).ownerUserId).toBe('bob');
	});

	test('a contact channel is required on manual leads', () => {
		expect(() => createLeadSchema.parse({ name: 'X', source: 'phone' })).toThrow();
	});

	test('the shared lead schema names the field and key of each refusal (P7-6, TF-A)', () => {
		const input = { name: ' ', source: 'phone' };
		const parsed = createLeadSchema.safeParse(input);
		expect(parsed.success).toBe(false);
		expect(zodIssuesToFormErrors(parsed.error?.issues ?? [], input)).toEqual([
			{ field: 'name', key: 'required' },
			{ field: 'contact', key: 'contactRequired' },
		]);
		const negative = { name: 'Budi', source: 'phone', phone: '0812', estimatedValue: -1 };
		expect(zodIssuesToFormErrors(createLeadSchema.safeParse(negative).error?.issues ?? [], negative)).toEqual([
			{ field: 'estimatedValue', key: 'notNegative' },
		]);
	});

	test('the backend lead sources and the shared schema list the same values', () => {
		expect([...LEAD_SOURCE_VALUES]).toEqual([...LEAD_SOURCES]);
	});

	test('activities set the next follow-up; lost leads need a reason elsewhere and block conversion', async () => {
		const lead = await service.create(ALICE, leadInput());
		await service.addActivity(ALICE, lead.id, { activityType: 'survey', notes: 'Survei lokasi', nextFollowUpAt: 1_800_000_000_000 });
		expect((await leads.findById(lead.id))?.nextFollowUpAt).toEqual(new Date(1_800_000_000_000));
		await service.changeStatus(ALICE, lead.id, { status: 'lost', lostReason: 'Harga' });
		await expect(service.convert(ALICE, lead.id, { customerId: ACTIVE_CUSTOMER })).rejects.toBeInstanceOf(LeadLostError);
	});

	test('conversion links an active customer once; a converted lead is closed', async () => {
		const lead = await service.create(ALICE, leadInput());
		await expect(
			service.convert(ALICE, lead.id, { customerId: '01920000-0000-7000-8000-0000000000ff' }),
		).rejects.toBeInstanceOf(LeadCustomerUnavailableError);
		const won = await service.convert(ALICE, lead.id, { customerId: ACTIVE_CUSTOMER });
		expect(won.status).toBe('won');
		await expect(service.convert(ALICE, lead.id, { customerId: ACTIVE_CUSTOMER })).rejects.toBeInstanceOf(
			LeadAlreadyConvertedError,
		);
		await expect(service.update(ALICE, lead.id, { name: 'X' })).rejects.toBeInstanceOf(LeadClosedError);
		await expect(service.changeStatus(ALICE, lead.id, { status: 'contacted' })).rejects.toBeInstanceOf(LeadClosedError);
	});
});

describe('WebsiteInquiryService', () => {
	let leads: FakeLeads;
	let attachments: FakeAttachments;
	let stored: string[];
	let service: WebsiteInquiryService;
	let sequence: number;

	const rfq = rfqSubmissionSchema.parse({
		company: { contactName: 'Sari', email: 'Sari@Example.com', phone: '021-5550101' },
		project: { siteLocation: 'Jakarta', type: 'new-installation' },
		items: [{ productSlug: 'swing-barrier-gate', quantity: 2 }],
		source: 'web',
	});
	const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);

	beforeEach(() => {
		leads = new FakeLeads();
		attachments = new FakeAttachments();
		stored = [];
		sequence = 0;
		service = new WebsiteInquiryService(
			leads,
			attachments,
			{ next: async () => `RFQ-2026-${String(++sequence).padStart(5, '0')}` },
			{ run: <T>(work: (tx: TTx) => Promise<T>) => work({} as TTx) },
			{ put: async (key: string) => void stored.push(key) },
			outbox,
		);
	});

	test('an RFQ becomes an unassigned website lead with its files and a readable summary', async () => {
		const receipt = await service.submitRfq(rfq, [file('denah.pdf'), file('foto.JPG')], 'key-0001');
		expect(receipt).toEqual({ reference: 'RFQ-2026-00001', replayed: false });
		const [lead] = leads.rows;
		expect(lead).toMatchObject({ source: 'website', ownerUserId: null, channel: 'rfq', email: 'sari@example.com' });
		expect(lead.needs).toContain('Produk: swing-barrier-gate x2');
		expect(stored).toHaveLength(2);
		expect(attachments.rows.map((a) => a.contentType)).toEqual(['application/pdf', 'image/jpeg']);
	});

	test('a replayed Idempotency-Key returns the first reference without a second lead or upload', async () => {
		await service.submitRfq(rfq, [file('denah.pdf')], 'key-0001');
		const replay = await service.submitRfq(rfq, [file('denah.pdf')], 'key-0001');
		expect(replay).toEqual({ reference: 'RFQ-2026-00001', replayed: true });
		expect(leads.rows).toHaveLength(1);
		expect(stored).toHaveLength(1);
	});

	test('a concurrent duplicate key answers with the winner reference', async () => {
		leads.raceOnNextInquiry = true;
		expect(await service.submitRfq(rfq, [], 'key-0002')).toEqual({ reference: 'RFQ-FIRST', replayed: true });
	});

	test('attachment limits: count, size, and type', async () => {
		const many = Array.from({ length: 11 }, (_, i) => file(`f${i}.pdf`));
		await expect(service.submitRfq(rfq, many, null)).rejects.toBeInstanceOf(WebsiteInquiryError);
		await expect(service.submitRfq(rfq, [file('big.pdf', 25 * 1024 * 1024 + 1)], null)).rejects.toBeInstanceOf(
			WebsiteInquiryError,
		);
		await expect(service.submitRfq(rfq, [file('virus.exe')], null)).rejects.toBeInstanceOf(WebsiteInquiryError);
		expect(leads.rows).toHaveLength(0);
	});
});

describe('LeadService follow-up reminders (ERP-0066)', () => {
	test('due today or past goes to the owner; more than 3 days late is published again as overdue', async () => {
		const events: { topic: string; data: Record<string, unknown>; dedupeKey?: string }[] = [];
		const repo = new FakeLeads();
		const lead = (id: string, at: string, status = 'contacted', owner: string | null = 'sales-1') =>
			({ id, name: `Lead ${id}`, status, ownerUserId: owner, nextFollowUpAt: new Date(at), reference: null, companyName: null, phone: '0812', whatsapp: null, email: null, source: 'phone', needs: null, estimatedValue: null }) as unknown as TLeadSelect;
		repo.rows = [
			lead('today', '2026-11-16T02:00:00Z'),
			lead('late2', '2026-11-14T02:00:00Z'),
			lead('late5', '2026-11-11T02:00:00Z', 'new', null),
			lead('future', '2026-11-18T02:00:00Z'),
			lead('won', '2026-11-10T02:00:00Z', 'won'),
		];
		const service = new LeadService(
			repo,
			new FakeActivities(),
			new FakeAttachments(),
			{} as never,
			{} as never,
			{} as never,
			{ getUser: async (id: string) => ({ id, name: `User ${id}`, phone: '081100000001', email: null }) as never },
			{} as never,
			{
				publish: async (topic: string, _aggregate: unknown, data: Record<string, unknown>, options?: { dedupeKey?: string }) => {
					events.push({ topic, data, dedupeKey: options?.dedupeKey });
					return {} as never;
				},
			} as never,
		);
		const result = await service.publishFollowUpNotices(new Date('2026-11-16T01:00:00Z'));
		expect(result).toEqual({ processed: 3, skipped: 0 });
		expect(events.map((event) => [event.data.leadId, event.data.stage, event.data.daysOverdue])).toEqual([
			['today', 'due', 0],
			['late2', 'due', 2],
			['late5', 'overdue', 5],
		]);
		expect(events[0]?.data.owner).toEqual({ userId: 'sales-1', name: 'User sales-1', phone: '081100000001', email: null });
		expect(events[2]?.data.owner).toBeNull();
		expect(events[0]?.dedupeKey).toBe(`lead.follow_up_due:today:${new Date('2026-11-16T02:00:00Z').getTime()}:due`);
	});
});
