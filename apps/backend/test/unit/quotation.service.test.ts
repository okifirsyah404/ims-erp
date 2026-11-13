/**
 * Quotation (SPH) use cases, ADR-0011 step 3c: money rules, snapshots,
 * visibility, workflow, separation of duties, revisions and validity.
 * Repository and neighbour modules are in-memory fakes.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { endOfBusinessDate } from '@utils/business-date.util';
import { quantityTimesPrice } from '@utils/money.util';
import type {
	QuotationStatus,
	TQuotationItemSelect,
	TQuotationSelect,
	TQuotationStatusHistorySelect,
} from '@drizzle/schemas/sales.schema';
import type { IQuotationRepository } from '../../src/app/sales/contracts/quotation.repository.interface';
import { quotationBodySchema, quotationLostSchema } from '../../src/app/sales/contracts/quotation.contract';
import {
	QuotationContactInvalidError,
	QuotationCustomerUnavailableError,
	QuotationDiscountTooLargeError,
	QuotationItemUnavailableError,
	QuotationLeadNotFoundError,
	QuotationNotFoundError,
	QuotationSelfApprovalError,
	QuotationStateError,
} from '../../src/app/sales/errors/quotation.errors';
import { QuotationService, type TQuotationContext } from '../../src/app/sales/services/quotation.service';
import { computeTotals } from '../../src/app/sales/utils/quotation-totals';
import { isQuotationExpired, quotationExpiresAt } from '../../src/app/sales/utils/quotation-validity';

const CUSTOMER = '0190a1b2-0000-7000-8000-0000000000c1';
const INACTIVE = '0190a1b2-0000-7000-8000-0000000000c2';
const CONTACT = '0190a1b2-0000-7000-8000-0000000000d1';
const ITEM = '0190a1b2-0000-7000-8000-0000000000a1';
const LEAD = '0190a1b2-0000-7000-8000-0000000000e1';

class FakeQuotations implements IQuotationRepository {
	rows: TQuotationSelect[] = [];
	items = new Map<string, TQuotationItemSelect[]>();
	history: TQuotationStatusHistorySelect[] = [];
	private seq = 0;

	private log(quotationId: string, fromStatus: string | null, toStatus: string, by: string) {
		this.history.push({ quotationId, fromStatus, toStatus, changedBy: by } as TQuotationStatusHistorySelect);
	}
	private id() {
		return `0190a1b2-0000-7000-8000-${String(++this.seq).padStart(12, '0')}`;
	}
	async paginate(request: Parameters<IQuotationRepository['paginate']>[0]) {
		const data = this.rows.filter(
			(row) =>
				(!request.excludeSuperseded || row.status !== 'superseded') &&
				(!request.createdBy || row.createdBy === request.createdBy || (request.includeWon && row.status === 'won')),
		);
		return { meta: { page: 1, limit: 20, total: data.length, totalPages: 1 }, data };
	}
	async findById(id: string) {
		return this.rows.find((row) => row.id === id) ?? null;
	}
	async findItems(id: string) {
		return this.items.get(id) ?? [];
	}
	async findRevisions(baseCode: string) {
		return this.rows.filter((row) => row.baseCode === baseCode).sort((a, b) => a.revision - b.revision);
	}
	async findHistory(id: string) {
		return this.history.filter((entry) => entry.quotationId === id);
	}
	async create(header: Parameters<IQuotationRepository['create']>[0], items: Parameters<IQuotationRepository['create']>[1]) {
		const row = {
			...header,
			id: this.id(),
			baseCode: header.code,
			revision: 0,
			previousRevisionId: null,
			status: 'draft',
		} as TQuotationSelect;
		this.rows.push(row);
		this.items.set(row.id, items as TQuotationItemSelect[]);
		this.log(row.id, null, 'draft', header.createdBy);
		return row;
	}
	async replaceDraft(id: string, header: Parameters<IQuotationRepository['replaceDraft']>[1], items: Parameters<IQuotationRepository['replaceDraft']>[2]) {
		const row = await this.findById(id);
		if (!row || row.status !== 'draft') return null;
		Object.assign(row, header);
		this.items.set(id, items as TQuotationItemSelect[]);
		return row;
	}
	async transition(
		id: string,
		from: readonly QuotationStatus[],
		to: QuotationStatus,
		patch: object,
		actor: { userId: string },
	) {
		const row = await this.findById(id);
		if (!row || !from.includes(row.status)) return null;
		this.log(id, row.status, to, actor.userId);
		return Object.assign(row, patch, { status: to });
	}
	async createRevision(id: string, from: readonly QuotationStatus[], actorUserId: string) {
		const old = await this.findById(id);
		if (!old || !from.includes(old.status)) return null;
		this.log(id, old.status, 'superseded', actorUserId);
		old.status = 'superseded';
		const revision = Math.max(...(await this.findRevisions(old.baseCode)).map((r) => r.revision)) + 1;
		const row = {
			...old,
			id: this.id(),
			code: `${old.baseCode}-R${revision}`,
			revision,
			previousRevisionId: old.id,
			status: 'draft',
			approvedBy: null,
			approvedAt: null,
			rejectedReason: null,
			lostReason: null,
			lostNote: null,
		} as TQuotationSelect;
		this.rows.push(row);
		this.items.set(row.id, [...(this.items.get(id) ?? [])]);
		this.log(row.id, null, 'draft', actorUserId);
		return row;
	}
}

const customer = {
	id: CUSTOMER,
	code: 'PT-MAJU',
	name: 'PT Maju',
	customerType: 'company',
	email: 'a@maju.id',
	phone: null,
	whatsapp: '0812',
	taxId: '0123456789012345',
	addressLine: 'Jl. Merdeka 1',
	postalCode: '10110',
	status: 'active',
};

let repo: FakeQuotations;
let leadNoted: string[];
/** Registry calls made by the service (ERP-0044). */
let registered: { code: string; sourceId: string }[];
let voided: string[];
let service: QuotationService;

const sales: TQuotationContext = { actorUserId: 'sales-1', canViewAll: false, canViewDeals: false };
const sales2: TQuotationContext = { actorUserId: 'sales-2', canViewAll: false, canViewDeals: false };
const manager: TQuotationContext = { actorUserId: 'manager', canViewAll: true, canViewDeals: true };
const finance: TQuotationContext = { actorUserId: 'finance', canViewAll: false, canViewDeals: true };

function body(overrides: Record<string, unknown> = {}) {
	return quotationBodySchema.parse({
		customerId: CUSTOMER,
		title: 'Penawaran swing gate',
		lines: [{ itemId: ITEM, quantity: 2 }],
		...overrides,
	});
}

beforeEach(() => {
	repo = new FakeQuotations();
	leadNoted = [];
	registered = [];
	voided = [];
	service = new QuotationService(
		repo,
		{
			getActiveCustomer: async (id: string) => (id === CUSTOMER ? (customer as never) : null),
			getContact: async (customerId: string, id: string) =>
				customerId === CUSTOMER && id === CONTACT ? ({ id, name: 'Bu Rina' } as never) : null,
		},
		{
			noteQuotation: async (id: string) => {
				leadNoted.push(id);
				return id === LEAD;
			},
		},
		{
			getActiveItems: async (ids: string[]) =>
				ids.includes(ITEM)
					? ([
							{
								id: ITEM,
								sku: 'SG-01',
								name: 'Swing gate',
								specification: 'Stainless 304',
								unitLabel: 'unit',
								sellingPrice: 1_500_000_000,
								imageObjectKey: 'inventory/items/sg/photo.png',
							},
						] as never)
					: [],
		},
		{ next: async () => '1376/QT/IMS/XI/26' },
		{ getUser: async (id: string) => ({ id, name: `User ${id}` }) as never },
		{ presignGet: (key: string) => `https://files.test/${key}` },
		{ findLiveByQuotation: async () => null },
		{
			// ERP-0044: the registry is asserted through `registered` / `voided`.
			register: async (input) => {
				registered.push(input);
				return {} as never;
			},
			voidBySource: async (module, sourceType, sourceId) => {
				voided.push(`${module}/${sourceType}/${sourceId}`);
				return 1;
			},
		},
	);
});

describe('money rules', () => {
	test('11% VAT on the tax base, half-up, integer minor units', () => {
		const totals = computeTotals(
			[{ quantity: '3', unitPrice: 333_33, discountAmount: 0 }],
			{ enabled: true, rateBps: 1100 },
		);
		expect(totals.subtotal).toBe(999_99);
		expect(totals.taxTotal).toBe(110_00); // 10999.89 → 11000 (half-up)
		expect(totals.grandTotal).toBe(1_109_99);
	});

	test('fractional quantities (3 decimals) round half-up; huge values stay exact', () => {
		expect(quantityTimesPrice('12.5', 10_001)).toBe(125_013); // 125012.5 → 125013
		expect(quantityTimesPrice('0.001', 500)).toBe(1); // 0.5 → 1
		expect(quantityTimesPrice('1000000', 9_000_000_000)).toBe(9_000_000_000_000_000);
		expect(() => quantityTimesPrice('1.2345', 1)).toThrow(RangeError);
	});

	test('quantity with more than three decimals or zero is a 400 at the contract', () => {
		expect(() => body({ lines: [{ itemId: ITEM, quantity: '1.2345' }] })).toThrow();
		expect(() => body({ lines: [{ itemId: ITEM, quantity: 0 }] })).toThrow();
		expect(() => body({ lines: [] })).toThrow();
		expect(() => body({ lines: [{ name: 'Jasa', quantity: 1 }] })).toThrow(); // custom line needs unit + price
	});
});

describe('create', () => {
	test('numbers, snapshots the customer and item, totals with default 11% VAT', async () => {
		const created = await service.create(sales, body());
		expect(created.code).toBe('1376/QT/IMS/XI/26');
		expect(created.status).toBe('draft');
		expect(created.customerSnapshot.name).toBe('PT Maju');
		expect(created.vatRateBps).toBe(1100);
		expect(created.subtotal).toBe(3_000_000_000);
		expect(created.taxTotal).toBe(330_000_000);
		expect(created.grandTotal).toBe(3_330_000_000);
		const [line] = await repo.findItems(created.id);
		expect(line).toMatchObject({
			sku: 'SG-01',
			name: 'Swing gate',
			unit: 'unit',
			quantity: '2',
			lineTotal: 3_000_000_000,
			imageObjectKey: 'inventory/items/sg/photo.png',
		});
		const [shown] = (await service.get(sales, created.id)).items;
		expect(shown!.imageUrl).toBe('https://files.test/inventory/items/sg/photo.png');
		expect(repo.history.map((h) => h.toStatus)).toEqual(['draft']);
		// ERP-0044: the registry row shares the business code and source id.
		expect(registered).toEqual([
			expect.objectContaining({
				code: '1376/QT/IMS/XI/26',
				documentType: 'quotation',
				module: 'sales',
				sourceType: 'quotation',
				sourceId: created.id,
			}),
		]);
	});

	test('VAT off, custom line, per-line discount; attention defaults to the contact', async () => {
		const created = await service.create(
			sales,
			body({
				vatEnabled: false,
				customerContactId: CONTACT,
				lines: [{ name: 'Jasa instalasi', unit: 'paket', quantity: '1.5', unitPrice: 200_000_00, discountAmount: 10_000_00 }],
			}),
		);
		expect(created.attention).toBe('Bu Rina');
		expect(created.vatRateBps).toBe(0);
		expect(created.taxTotal).toBe(0);
		expect(created.grandTotal).toBe(290_000_00);
	});

	test('rejects an inactive customer, a foreign contact, an unknown item and an oversized discount', async () => {
		await expect(service.create(sales, body({ customerId: INACTIVE }))).rejects.toBeInstanceOf(
			QuotationCustomerUnavailableError,
		);
		await expect(service.create(sales, body({ customerContactId: INACTIVE }))).rejects.toBeInstanceOf(
			QuotationContactInvalidError,
		);
		await expect(
			service.create(sales, body({ lines: [{ itemId: INACTIVE, quantity: 1 }] })),
		).rejects.toBeInstanceOf(QuotationItemUnavailableError);
		await expect(
			service.create(sales, body({ lines: [{ itemId: ITEM, quantity: 1, discountAmount: 2_000_000_000 }] })),
		).rejects.toBeInstanceOf(QuotationDiscountTooLargeError);
		expect(repo.rows).toHaveLength(0);
	});

	test('a lead is noted (moves to "quotation" in CRM); an unknown lead is refused', async () => {
		await service.create(sales, body({ leadId: LEAD }));
		expect(leadNoted).toEqual([LEAD]);
		await expect(service.create(sales, body({ leadId: INACTIVE }))).rejects.toBeInstanceOf(
			QuotationLeadNotFoundError,
		);
	});

	test('the payment schedule fills the printed Payment line; an explicit one wins', async () => {
		const schedule = [
			{ label: 'DP', percentBps: 3000 },
			{ label: 'Siap Kirim', percentBps: 4000 },
			{ label: 'Terpasang', percentBps: 3000 },
		];
		const derived = await service.create(sales, body({ paymentSchedule: schedule }));
		expect(derived.paymentTerms).toBe('DP 30% - Siap Kirim 40% - Terpasang 30%');
		const explicit = await service.create(sales, body({ paymentSchedule: schedule, paymentTerms: 'DP 50% - 50% BAST' }));
		expect(explicit.paymentTerms).toBe('DP 50% - 50% BAST');
		expect(() => body({ paymentSchedule: [{ label: 'DP', percentBps: 5000 }] })).toThrow();
	});
});

describe('visibility (same rule as leads)', () => {
	test("sales sees only own SPH; another salesperson's SPH is 404 for read and actions", async () => {
		const mine = await service.create(sales, body());
		expect((await service.list(sales2, { page: 1, limit: 20 })).data).toHaveLength(0);
		await expect(service.get(sales2, mine.id)).rejects.toBeInstanceOf(QuotationNotFoundError);
		await expect(service.submit(sales2, mine.id)).rejects.toBeInstanceOf(QuotationNotFoundError);
		expect((await service.list(manager, { page: 1, limit: 20 })).data).toHaveLength(1);
	});

	test('billing staff see won SPHs and their earlier revisions only', async () => {
		const quotation = await service.create(sales, body());
		await expect(service.get(finance, quotation.id)).rejects.toBeInstanceOf(QuotationNotFoundError);
		await service.submit(sales, quotation.id);
		await service.decide(manager, quotation.id, { decision: 'reject', reason: 'Harga' });
		const revision = await service.revise(sales, quotation.id);
		repo.rows.find((row) => row.id === revision.id)!.status = 'won'; // set by the sales order (3d)
		expect((await service.get(finance, revision.id)).status).toBe('won');
		expect((await service.get(finance, quotation.id)).status).toBe('superseded');
	});
});

describe('workflow and separation of duties', () => {
	test('draft → submitted → approved → sent; edits only while draft; history is recorded', async () => {
		const quotation = await service.create(sales, body());
		await service.update(sales, quotation.id, body({ title: 'Penawaran revisi judul' }));
		await service.submit(sales, quotation.id);
		await expect(service.update(sales, quotation.id, body())).rejects.toBeInstanceOf(QuotationStateError);
		await expect(service.submit(sales, quotation.id)).rejects.toBeInstanceOf(QuotationStateError);
		await expect(service.markSent(sales, quotation.id)).rejects.toBeInstanceOf(QuotationStateError);
		const approved = await service.decide(manager, quotation.id, { decision: 'approve' });
		expect(approved.approvedBy).toBe('manager');
		const sent = await service.markSent(sales, quotation.id);
		expect(sent.sentBy).toBe('sales-1');
		const detail = await service.get(sales, quotation.id);
		expect(detail.history.map((h) => h.toStatus)).toEqual(['draft', 'submitted', 'approved', 'sent']);
		expect(detail.approver?.name).toBe('User manager');
	});

	test('the creator can never decide their own SPH, even as a manager', async () => {
		const own = await service.create(manager, body());
		await service.submit(manager, own.id);
		await expect(service.decide(manager, own.id, { decision: 'approve' })).rejects.toBeInstanceOf(
			QuotationSelfApprovalError,
		);
		await expect(service.decide(manager, own.id, { decision: 'reject', reason: 'x' })).rejects.toBeInstanceOf(
			QuotationSelfApprovalError,
		);
	});
});

describe('lost ("Batal") and revisions', () => {
	test('any open SPH can be lost with a reason; "other" needs a note; closed ones cannot', async () => {
		const quotation = await service.create(sales, body());
		expect(() => quotationLostSchema.parse({ reason: 'other' })).toThrow();
		const lost = await service.markLost(sales, quotation.id, { reason: 'price', note: 'Terlalu mahal' });
		expect(lost).toMatchObject({ status: 'lost', lostReason: 'price', closedBy: 'sales-1' });
		// ERP-0044: the registry copy of a lost SPH is voided.
		expect(voided).toEqual([`sales/quotation/${quotation.id}`]);
		await expect(service.markLost(sales, quotation.id, { reason: 'price' })).rejects.toBeInstanceOf(
			QuotationStateError,
		);
	});

	test('each revision keeps the base number and needs approval again; a lost SPH can be revised', async () => {
		const quotation = await service.create(sales, body());
		await expect(service.revise(sales, quotation.id)).rejects.toBeInstanceOf(QuotationStateError); // draft
		await service.markLost(sales, quotation.id, { reason: 'no_response' });
		const r1 = await service.revise(sales, quotation.id);
		expect(r1).toMatchObject({ code: '1376/QT/IMS/XI/26-R1', revision: 1, status: 'draft', createdBy: 'sales-1' });
		await expect(service.revise(sales, quotation.id)).rejects.toBeInstanceOf(QuotationStateError); // superseded
		await service.submit(sales, r1.id);
		const r2 = await service.revise(sales, r1.id);
		expect(r2.code).toBe('1376/QT/IMS/XI/26-R2');
		expect((await service.get(sales, r2.id)).revisions.map((r) => r.status)).toEqual([
			'superseded',
			'superseded',
			'draft',
		]);
		expect((await service.list(sales, { page: 1, limit: 20 })).data.map((r) => r.id)).toEqual([r2.id]);
	});

	test('a won SPH (has its sales order) cannot be revised', async () => {
		const quotation = await service.create(sales, body());
		repo.rows[0]!.status = 'won';
		await expect(service.revise(sales, quotation.id)).rejects.toBeInstanceOf(QuotationStateError);
	});
});

describe('validity (expiry is shown, never a status)', () => {
	test('valid through 23:59:59.999 WIB of the valid-until date', () => {
		const end = quotationExpiresAt('2026-11-30')!;
		expect(end).toBe(endOfBusinessDate('2026-11-30'));
		expect(new Date(end).toISOString()).toBe('2026-11-30T16:59:59.999Z');
		expect(isQuotationExpired('sent', end, end)).toBe(false);
		expect(isQuotationExpired('sent', end, end + 1)).toBe(true);
		expect(isQuotationExpired('lost', end, end + 1)).toBe(false);
		expect(quotationExpiresAt(null)).toBeNull();
	});

	test('valid until before the quotation date is a 400; the API returns expiresAt and expired', async () => {
		expect(() => body({ quotationDate: '2026-11-10', validUntil: '2026-11-09' })).toThrow();
		const quotation = await service.create(sales, body({ quotationDate: '2020-01-01', validUntil: '2020-01-31' }));
		const detail = await service.get(sales, quotation.id);
		expect(detail.expired).toBe(true);
		expect(detail.status).toBe('draft');
	});
});
