/**
 * Customer portal data reads (ERP-0022): tickets, projects and devices.
 *
 * @remarks
 * Split from `customer-portal.test.ts` in ADR-0024 P2: the account, sign-in,
 * guard and form-payload tests now live in `portal-account.test.ts`. These
 * tests depend on the `ticket` and `project` modules (ADR-0024 P6) and on the
 * old aftersales/projects schemas; they stay red until those modules are
 * rebuilt and the portal's data ports are re-pointed (status: blocked on P6).
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TTicketMessageSelect, TTicketSelect } from '@drizzle/schemas/ticket.schema';
import type { TWarrantySelect } from '@drizzle/schemas/project.schema';
import type { TEvidenceSelect, THandoverSelect, TProjectSelect, TTaskSelect } from '@drizzle/schemas/project.schema';
import { TicketNotFoundError, TicketStateError } from '../../src/app/ticket/errors/ticket.errors';
import { TicketService } from '../../src/app/ticket/services/ticket.service';
import { PortalProductNotFoundError } from '../../src/app/customer/errors/portal.errors';
import { PortalService } from '../../src/app/customer/services/portal.service';
import { projectDetail, ticketDetail, ticketSummary, type TPresenter } from '../../src/app/customer/utils/portal-presenter';
import { ProjectPortalService } from '../../src/app/project/services/project-portal.service';
import type { PortalContext } from '../../src/authorization/portal-auth';

const CUST_A = '0190a1b2-0000-7000-8000-0000000000a1';
const CUST_B = '0190a1b2-0000-7000-8000-0000000000b2';

/** Minimal stand-in for the customer lookup the ticket service takes (replaced when the ticket module lands in P6). */
const customers = {
	getActiveCustomer: async (id: string) =>
		id === CUST_A || id === CUST_B ? ({ id, name: id === CUST_A ? 'PT Alfa' : 'PT Beta', customerType: 'company', status: 'active' } as never) : null,
};

/* ------------------------------------------------------------------------ *
 * Tickets
 * ------------------------------------------------------------------------ */

let tickets: TTicketSelect[];
let comments: TTicketMessageSelect[];

function ticketService(): TicketService {
	return new TicketService(
		{
			paginate: async () => ({ meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] }),
			findById: async (id) => tickets.find((row) => row.id === id) ?? null,
			listByCustomer: async (customerId) => tickets.filter((row) => row.customerId === customerId),
			async create(data) {
				const row = { ...data, id: crypto.randomUUID(), status: 'new', assigneeUserId: null, resolvedAt: null, closedAt: null, resolution: null } as TTicketSelect;
				tickets.push(row);
				return row;
			},
			async transition(id, from, data) {
				const row = tickets.find((ticket) => ticket.id === id);
				return row && from.includes(row.status) ? Object.assign(row, data) : null;
			},
		},
		{
			check: async () => ({ customerId: null, projectId: null, projectCode: null, deviceDescription: null, inWarranty: false, warrantyEndsOn: null, warrantyCode: null }),
		},
		customers,
		{ getProject: async () => null },
		{ getMemberRole: async () => 'customer_service', listMembers: async () => ({ meta: { page: 1, limit: 100, total: 0, totalPages: 0 }, data: [] }) as never },
		{ hasPermission: async () => true },
		{ getUser: async (id: string) => ({ id, name: `User ${id}` }) as never },
		{ next: async () => '0001/TKT/IMS/XI/26' },
		// M04: ticket events go to the outbox; not under test here.
		{ publish: async () => {} } as never,
		{ register: async () => ({}) as never },
		{
			list: async (ticketId, visibility) => comments.filter((row) => row.ticketId === ticketId && (!visibility || row.visibility === visibility)),
			async latestCustomerVisible(ticketIds) {
				const result = new Map<string, { latest: TTicketMessageSelect; count: number }>();
				for (const row of comments.filter((item) => ticketIds.includes(item.ticketId) && item.visibility === 'customer')) {
					result.set(row.ticketId, { latest: row, count: (result.get(row.ticketId)?.count ?? 0) + 1 });
				}
				return result;
			},
			async create(data) {
				const now = new Date();
				const row = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null } as TTicketMessageSelect;
				comments.push(row);
				return row;
			},
		},
	);
}

const actorA = { userId: 'u-a', name: 'Budi', email: 'budi@alfa.co.id', customerId: CUST_A };
const actorB = { userId: 'u-b', name: 'Rina', email: 'rina@beta.co.id', customerId: CUST_B };
const staff = { organizationId: 'org', actorUserId: 'cs-1', canManage: true };
const p: TPresenter = { t: (key) => key, language: 'id', today: '2026-11-14', now: new Date('2026-11-14T03:00:00Z') };

describe('portal tickets', () => {
	beforeEach(() => {
		tickets = [];
		comments = [];
	});

	test('opened from the portal: channel portal, the login as reporter', async () => {
		const service = ticketService();
		const ticket = await service.createFromPortal(actorA, { subject: 'Gate macet', description: 'Tidak membuka sejak pagi', projectId: null, serialNumber: null, deviceDescription: null });
		const row = tickets[0]!;
		expect(row.channel).toBe('portal');
		expect(row.reporterName).toBe('Budi');
		expect(row.reporterContact).toBe('budi@alfa.co.id');
		expect(row.createdBy).toBe('u-a');
		expect(row.customerId).toBe(CUST_A);
		expect(ticket.code).toBe('0001/TKT/IMS/XI/26');
	});

	test("customer B never sees, reads or writes customer A's ticket", async () => {
		const service = ticketService();
		const ticket = await service.createFromPortal(actorA, { subject: 'A', description: 'A', projectId: null, serialNumber: null, deviceDescription: null });
		expect(await service.listForCustomer(CUST_B)).toEqual([]);
		await expect(service.getForCustomer(CUST_B, ticket.id)).rejects.toBeInstanceOf(TicketNotFoundError);
		await expect(service.addCustomerMessage(actorB, ticket.id, 'halo')).rejects.toBeInstanceOf(TicketNotFoundError);
		await expect(service.confirmFromPortal(actorB, ticket.id)).rejects.toBeInstanceOf(TicketNotFoundError);
	});

	test('internal notes and the service cost never reach the portal', async () => {
		const service = ticketService();
		const ticket = await service.createFromPortal(actorA, { subject: 'A', description: 'A', projectId: null, serialNumber: null, deviceDescription: null });
		await service.addComment(staff, ticket.id, { body: 'Suku cadang mahal, tagih Rp 2 jt', visibility: 'internal' });
		await service.addComment(staff, ticket.id, { body: 'Teknisi datang besok', visibility: 'customer' });
		await service.addCustomerMessage(actorA, ticket.id, 'Terima kasih');
		const detail = await service.getForCustomer(CUST_A, ticket.id);
		expect(detail.messages.map((message) => message.body)).toEqual(['Teknisi datang besok', 'Terima kasih']);
		expect(JSON.stringify(detail)).not.toContain('Suku cadang');
		expect('serviceCost' in detail).toBe(false);
		expect(await service.listComments(staff, ticket.id)).toHaveLength(3);
		const presented = ticketDetail(p, detail);
		expect(JSON.stringify(presented)).not.toContain('Suku cadang');
		expect(presented.messages.filter((message) => message.kind === 'message')).toHaveLength(3);
	});

	test('a staff reply puts the ticket on "awaiting you"', async () => {
		const service = ticketService();
		const ticket = await service.createFromPortal(actorA, { subject: 'A', description: 'A', projectId: null, serialNumber: null, deviceDescription: null });
		expect(ticketSummary(p, (await service.listForCustomer(CUST_A))[0]!).status).toBe('new');
		await service.addComment(staff, ticket.id, { body: 'Boleh kirim foto?', visibility: 'customer' });
		expect(ticketSummary(p, (await service.listForCustomer(CUST_A))[0]!).status).toBe('awaiting_you');
	});

	test('the customer confirms only a resolved ticket; a closed ticket takes no messages', async () => {
		const service = ticketService();
		const ticket = await service.createFromPortal(actorA, { subject: 'A', description: 'A', projectId: null, serialNumber: null, deviceDescription: null });
		await expect(service.confirmFromPortal(actorA, ticket.id)).rejects.toBeInstanceOf(TicketStateError);
		await service.resolve(staff, ticket.id, { resolution: 'Motor diganti', serviceCost: 0 });
		const closed = await service.confirmFromPortal(actorA, ticket.id);
		expect(closed.status).toBe('closed');
		expect(tickets[0]!.confirmationChannel).toBe('portal');
		expect(tickets[0]!.confirmedByName).toBe('Budi');
		expect(tickets[0]!.closedBy).toBe('u-a');
		await expect(service.addCustomerMessage(actorA, ticket.id, 'lagi')).rejects.toBeInstanceOf(TicketStateError);
	});
});

/* ------------------------------------------------------------------------ *
 * Projects and devices
 * ------------------------------------------------------------------------ */

const project = (id: string, customerId: string, status: TProjectSelect['status'] = 'active') =>
	({
		id,
		code: `PRJ-${id}`,
		customerId,
		title: `Proyek ${id}`,
		siteName: 'Lobi',
		stage: 'installation',
		status,
		contractValue: 11_100_000_000,
		picUserId: 'pm-1',
		targetStartDate: '2026-11-01',
		targetEndDate: '2026-11-30',
		closedAt: null,
		notes: 'catatan internal',
		deletedAt: null,
	}) as unknown as TProjectSelect;

describe('portal projects', () => {
	const projects = [project('p1', CUST_A), project('p2', CUST_B), project('p3', CUST_A, 'cancelled')];
	const evidence = [
		{ id: 'e1', projectId: 'p1', kind: 'bast', storageKey: 'k1', fileName: 'bast.pdf', contentType: 'application/pdf', sizeBytes: 10, createdAt: new Date() },
		{ id: 'e2', projectId: 'p1', kind: 'other', storageKey: 'k2', fileName: 'internal.xlsx', contentType: 'application/vnd.ms-excel', sizeBytes: 10, createdAt: new Date() },
	] as TEvidenceSelect[];
	const tasks = [
		{ projectId: 'p1', title: 'Survey', stage: 'preparation', status: 'done', dueDate: '2026-11-02', doneAt: new Date() },
		{ projectId: 'p1', title: 'Pasang', stage: 'installation', status: 'in_progress', dueDate: '2026-11-20', doneAt: null },
	] as TTaskSelect[];
	const service = new ProjectPortalService(
		{
			listByCustomer: async (customerId: string) => projects.filter((row) => row.customerId === customerId && row.status !== 'cancelled'),
			findById: async (id: string) => projects.find((row) => row.id === id) ?? null,
			listTasks: async (projectId: string) => tasks.filter((task) => task.projectId === projectId),
			listEvidence: async (projectId: string) => evidence.filter((file) => file.projectId === projectId),
		} as never,
		{ list: async () => [{ id: 'b1', code: 'BAST-1', bastDate: '2026-11-25', workTitle: 'Swing gate', status: 'issued' }, { id: 'b2', code: 'BAST-2', bastDate: '2026-11-26', workTitle: 'X', status: 'cancelled' }] as THandoverSelect[] },
		{ getUser: async (id: string) => ({ id, name: 'Andi PM' }) as never },
		{ presignGet: (key: string) => `https://files/${key}?signed` },
	);

	test("only the customer's live projects; another customer's or a cancelled one answers null", async () => {
		expect((await service.listForCustomer(CUST_A)).map((row) => row.id)).toEqual(['p1']);
		expect(await service.getForCustomer(CUST_B, 'p1')).toBeNull();
		expect(await service.getForCustomer(CUST_A, 'p3')).toBeNull();
	});

	test('no contract value, notes or internal files; issued BASTs only', async () => {
		const detail = (await service.getForCustomer(CUST_A, 'p1'))!;
		const text = JSON.stringify(detail);
		expect(text).not.toContain('11100000000');
		expect(text).not.toContain('catatan internal');
		expect(detail.files.map((file) => file.fileName)).toEqual(['bast.pdf']);
		expect(detail.handovers.map((bast) => bast.code)).toEqual(['BAST-1']);
		const presented = projectDetail(p, detail);
		expect(presented.stage).toBe(3);
		expect(presented.progress).toBe(0.5);
		expect(presented.daysLeft).toBe(16);
		expect(presented.milestones.map((milestone) => milestone.state).slice(0, 4)).toEqual(['done', 'done', 'current', 'upcoming']);
	});
});

describe('portal devices', () => {
	const certificate = {
		id: '0190a1b2-0000-7000-8000-00000000ce01',
		code: 'SG-GARANSI-1',
		projectId: 'p1',
		customerId: CUST_A,
		items: [{ description: 'Swing gate', volume: '2 unit', remarks: 'SN-1, SN-2' }],
	} as unknown as TWarrantySelect;
	const portal = (customerId: string) => ({ customerId, companyId: customerId }) as PortalContext;
	const service = new PortalService(
		{} as never,
		{} as never,
		{
			listForCustomer: async (customerId: string) => (customerId === CUST_A ? [certificate] : []),
			getForCustomer: async (customerId: string, id: string) => (customerId === CUST_A && id === certificate.id ? certificate : null),
		},
		{} as never,
		{} as never,
		{} as never,
	);

	test("a device is a certificate line; another customer's or a missing line is 404", async () => {
		expect((await service.listDevices(portal(CUST_A))).map((device) => device.id)).toEqual([`${certificate.id}:0`]);
		await expect(service.getDevice(portal(CUST_B), `${certificate.id}:0`)).rejects.toBeInstanceOf(PortalProductNotFoundError);
		await expect(service.getDevice(portal(CUST_A), `${certificate.id}:1`)).rejects.toBeInstanceOf(PortalProductNotFoundError);
	});
});

