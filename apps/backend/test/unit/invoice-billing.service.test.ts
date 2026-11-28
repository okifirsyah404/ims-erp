/**
 * Billing a sales order by terms (M02, ADR-0011 step 3d-2), restored on top
 * of the accounting-aware Sales invoice after the PR #68 merge dropped it:
 * free terms that never exceed the order and settle without rounding drift,
 * DP / installment / settlement kinds, one line per term draft (so the
 * existing issue posting works), the billing summary and printed schedule,
 * and voiding — an issued invoice gets its journal reversed and its AR item
 * voided; a paid one cannot be voided.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TInvoiceSelect, TReceiptSelect, TOrderSelect } from '@drizzle/schemas/sale.schema';
import { invoiceCreateSchema, invoiceTermCreateSchema } from '../../src/app/sale/contracts/invoice.contract';
import type { TInvoiceRepository } from '../../src/app/sale/contracts/invoice.repository.interface';
import {
	InvoiceCustomerInactiveError,
	InvoiceCustomerRequiredError,
	InvoiceDueDateRequiredError,
	InvoiceNotVoidableError,
	InvoiceOrderUnavailableError,
	InvoiceTermError,
} from '../../src/app/sale/errors/invoice.errors';
import { InvoiceService } from '../../src/app/sale/services/invoice.service';
import { InvoiceBillingService } from '../../src/app/sale/services/invoice-billing.service';
import { computeTerm, nextPlannedTerm, sumTerms } from '../../src/app/sale/utils/invoice-terms';

const ORDER = '0190a1b2-0000-7000-8000-00000000b001';
const ORG = 'org-1';
const ctx = { organizationId: ORG, actorUserId: 'finance' };

let rows: TInvoiceSelect[];
let items: Record<string, unknown>[];
let receipts: TReceiptSelect[];
let current: TOrderSelect;
let sequence: number;
let reversed: { entryId: string; entryDate?: string }[];
let arUpdates: { invoiceId: string; patch: Record<string, unknown> }[];
let voidedDocs: string[];
let service: InvoiceBillingService;

const live = (row: TInvoiceSelect) => row.status !== 'void' && row.status !== 'cancelled';

type TBillingRepo = Pick<TInvoiceRepository, 'findById' | 'listByOrder' | 'listReceipts' | 'update' | 'withLockedInvoice' | 'createTermDraftLocked'>;

function fakeRepo(): TInvoiceRepository {
	const repo: TBillingRepo = {
		findById: async (_org, id) => rows.find((row) => row.id === id) ?? null,
		listByOrder: async (orderId) => rows.filter((row) => row.orderId === orderId),
		listReceipts: async (_org, invoiceId) => receipts.filter((row) => row.invoiceId === invoiceId),
		async update(_org, id, patch) {
			const row = rows.find((item) => item.id === id);
			return row ? Object.assign(row, patch) : null;
		},
		async withLockedInvoice<T>(_org: string, id: string, work: (invoice: TInvoiceSelect, tx: unknown) => Promise<T>) {
			const row = rows.find((item) => item.id === id);
			return row ? work(row, 'tx') : null;
		},
		async createTermDraftLocked(orderId, build) {
			const liveRows = rows.filter((row) => row.orderId === orderId && live(row));
			const billed = sumTerms(liveRows.map((row) => ({ taxBase: row.subtotal, vatAmount: row.taxTotal, total: row.grandTotal })));
			const built = await build(billed, liveRows.length, 'tx');
			const row = { ...built.row, id: crypto.randomUUID(), createdAt: new Date() } as unknown as TInvoiceSelect;
			rows.push(row);
			items.push(...built.items.map((item) => ({ ...item, invoiceId: row.id })));
			return row;
		},
	};
	return repo as unknown as TInvoiceRepository;
}

/** Rp 1.000.000,01 tax base (odd on purpose), 11% VAT. */
function order(overrides: Partial<TOrderSelect> = {}): TOrderSelect {
	return {
		id: ORDER,
		code: '0001/SO/IMS/XI/26',
		quotationCode: '1376/QT/IMS/X/26',
		title: 'Swing gate',
		status: 'active',
		customerId: '0190a1b2-0000-7000-8000-0000000000c1',
		customerSnapshot: { code: 'PT-MAJU', name: 'PT Maju' },
		vatEnabled: true,
		vatRateBps: 1100,
		subtotal: 100_000_001,
		discountTotal: 0,
		taxTotal: 11_000_000,
		grandTotal: 111_000_001,
		currencyCode: 'IDR',
		paymentSchedule: [
			{ label: 'DP', percentBps: 3000 },
			{ label: 'Terpasang', percentBps: 7000 },
		],
		...overrides,
	} as TOrderSelect;
}

const draft = (term: unknown, extra: Record<string, unknown> = {}) =>
	service.createFromTerm(ctx, invoiceTermCreateSchema.parse({ orderId: ORDER, term, ...extra }));

beforeEach(() => {
	rows = [];
	items = [];
	receipts = [];
	current = order();
	sequence = 0;
	reversed = [];
	arUpdates = [];
	voidedDocs = [];
	service = new InvoiceBillingService(
		fakeRepo(),
		{
			getOrderForBilling: async (id: string) => (id === ORDER && current.status !== 'cancelled' ? { order: current, items: [] } : null),
			getOrderForPrint: async (id: string) => (id === ORDER ? { order: current, items: [] } : null),
		},
		{ next: async () => `000${++sequence}/INV/IMS/XI/26` },
		{ get: async () => ({ defaultInvoiceTerms: '1. Garansi 1 tahun' }) as never },
		{
			reverse: async (_tx: unknown, _org: string, entryId: string, _actor: string, options: { entryDate?: string } = {}) => {
				reversed.push({ entryId, entryDate: options.entryDate });
				return {} as never;
			},
		},
		{
			findPostedEntryForSource: async (_org: string, sourceType: string, sourceId: string) =>
				sourceType === 'invoice' ? ({ id: `je-${sourceId}`, status: 'posted', reversedByEntryId: null, entryDate: '2026-11-01' } as never) : null,
			setOpenItemStatus: async (_org: string, invoiceId: string, patch: Record<string, unknown>) => {
				arUpdates.push({ invoiceId, patch });
			},
		},
		{
			voidBySource: async (_module: string, _type: string, sourceId: string) => {
				voidedDocs.push(sourceId);
				return 1;
			},
		},		{ cancelForInvoice: async () => undefined },
	);
});

describe('term rules', () => {
	const amounts = { taxBase: 100_000_001, vatAmount: 11_000_000, total: 111_000_001, vatEnabled: true, vatRateBps: 1100 };

	test('two 50% terms of an odd base settle exactly', () => {
		const first = computeTerm(amounts, sumTerms([]), { mode: 'percentage', bps: 5000 });
		const second = computeTerm(amounts, first, { mode: 'percentage', bps: 5000 });
		expect(sumTerms([first, second])).toEqual({ taxBase: 100_000_001, vatAmount: 11_000_000, total: 111_000_001 });
	});

	test('a VAT-inclusive amount is split into tax base and VAT', () => {
		expect(computeTerm(amounts, sumTerms([]), { mode: 'amount', total: 11_100_000 })).toEqual({ taxBase: 10_000_000, vatAmount: 1_100_000, total: 11_100_000 });
	});

	test('the next planned term follows the schedule; without one the deal is one term', () => {
		const schedule = [
			{ label: 'DP', percentBps: 3000 },
			{ label: 'Terpasang', percentBps: 7000 },
		];
		expect(nextPlannedTerm(schedule, 1_000, 0)).toMatchObject({ index: 0, description: 'DP 30%', last: false });
		expect(nextPlannedTerm(schedule, 1_000, 300)).toMatchObject({ index: 1, last: true });
		expect(nextPlannedTerm(schedule, 1_000, 1_000)).toBeNull();
		expect(nextPlannedTerm(null, 1_000, 0)).toMatchObject({ description: 'Pelunasan 100%', last: true });
	});
});

describe('drafting term invoices', () => {
	test('the first planned term is the DP, the last settles the exact remainder; one line each', async () => {
		const dp = await draft({ mode: 'next' });
		expect(dp).toMatchObject({ organizationId: ORG, termKind: 'down_payment', description: 'DP 30%', percentageBps: 3000, status: 'draft', code: '0001/INV/IMS/XI/26' });
		expect(dp.terms).toBe('1. Garansi 1 tahun');
		const rest = await draft({ mode: 'next' });
		expect(rest).toMatchObject({ termKind: 'settlement', description: 'Terpasang 70%' });
		expect(dp.grandTotal + rest.grandTotal).toBe(111_000_001);
		expect(items).toHaveLength(2);
		expect(items[0]).toMatchObject({ quantity: 1, unitPrice: dp.subtotal, taxAmount: dp.taxTotal, lineTotal: dp.grandTotal });
		await expect(draft({ mode: 'next' })).rejects.toBeInstanceOf(InvoiceTermError);
		await expect(draft({ mode: 'remaining' })).rejects.toBeInstanceOf(InvoiceTermError);
	});

	test('free terms: installment in between, labels default per kind', async () => {
		expect((await draft({ mode: 'percentage', bps: 2000 })).description).toBe('DP 20%');
		expect(await draft({ mode: 'amount', total: 11_100_000 }, { description: 'Material tiba' })).toMatchObject({ termKind: 'installment', description: 'Material tiba' });
		expect(await draft({ mode: 'remaining' })).toMatchObject({ termKind: 'settlement', description: 'Pelunasan' });
	});

	test('a void or cancelled invoice frees its share; a cancelled order cannot be billed', async () => {
		const dp = await draft({ mode: 'percentage', bps: 5000 });
		await service.void(ctx, dp.id, 'salah termin');
		const second = await draft({ mode: 'percentage', bps: 5000 });
		second.status = 'cancelled';
		expect((await draft({ mode: 'remaining' })).grandTotal).toBe(111_000_001);
		current = order({ status: 'cancelled' });
		await expect(draft({ mode: 'remaining' })).rejects.toBeInstanceOf(InvoiceOrderUnavailableError);
	});
});

describe('voiding', () => {
	test('a draft is voided without touching the ledger', async () => {
		const dp = await draft({ mode: 'next' });
		const voided = await service.void(ctx, dp.id, 'dobel');
		expect(voided).toMatchObject({ status: 'void', voidReason: 'dobel', voidedBy: 'finance', outstandingTotal: 0 });
		expect(reversed).toEqual([]);
		expect(arUpdates).toEqual([]);
	});

	test('an issued unpaid invoice: journal reversed, AR item voided, registry copy voided', async () => {
		const dp = await draft({ mode: 'next' });
		Object.assign(dp, { status: 'issued', outstandingTotal: dp.grandTotal });
		await service.void(ctx, dp.id, 'salah customer');
		expect(reversed).toEqual([{ entryId: `je-${dp.id}`, entryDate: expect.any(String) }]);
		expect(arUpdates).toEqual([{ invoiceId: dp.id, patch: { status: 'void' } }]);
		expect(voidedDocs).toEqual([dp.id]);
		expect(dp.status).toBe('void');
	});

	test('a paid or partly paid invoice cannot be voided', async () => {
		const dp = await draft({ mode: 'next' });
		Object.assign(dp, { status: 'partially_paid', paidTotal: 1_000 });
		await expect(service.void(ctx, dp.id, 'x')).rejects.toBeInstanceOf(InvoiceNotVoidableError);
		expect(reversed).toEqual([]);
	});
});

describe('summary and detail', () => {
	test('the billing card: invoiced, paid, left, next planned term', async () => {
		const dp = await draft({ mode: 'next' });
		Object.assign(dp, { status: 'partially_paid', paidTotal: 5_000_000, outstandingTotal: dp.grandTotal - 5_000_000 });
		const summary = await service.summary(ORDER);
		expect(summary).toMatchObject({ invoiced: dp.grandTotal, paid: 5_000_000, remainingToInvoice: 111_000_001 - dp.grandTotal, outstanding: dp.grandTotal - 5_000_000 });
		expect(summary.nextTerm).toMatchObject({ description: 'Terpasang 70%', last: true });
	});

	test('the invoice page: receipts mapped to the web shape, schedule of issued terms', async () => {
		const dp = await draft({ mode: 'next' });
		Object.assign(dp, { status: 'paid', paidTotal: dp.grandTotal, outstandingTotal: 0 });
		receipts.push({ id: 'r1', code: 'KW-1', invoiceId: dp.id, receivedDate: '2026-11-02', amount: dp.grandTotal, method: 'bank_transfer', reference: null, notes: null, status: 'posted', reversalReason: null } as TReceiptSelect);
		await draft({ mode: 'next' }); // a draft: not in the schedule
		const detail = await service.detail(ctx, dp.id);
		expect(detail.receipts).toEqual([expect.objectContaining({ id: 'r1', invoiceId: dp.id, amount: dp.grandTotal })]);
		expect(detail.order?.schedule.map((row) => row.description)).toEqual(['DP 30%']);
		expect(detail.order?.schedule[0]!.payments).toEqual([{ receivedDate: '2026-11-02', method: 'bank_transfer', amount: dp.grandTotal }]);
	});
});

/* ------------------------------------------------------------------ */
/* B-42 (KF-S6, FU9): an invoice without a sales order                 */
/* ------------------------------------------------------------------ */

const ACTIVE_CUSTOMER = '0190a1b2-0000-7000-8000-0000000000c9';
const INACTIVE_CUSTOMER = '0190a1b2-0000-7000-8000-0000000000ca';

function freeInvoiceHarness() {
	const invoiceRows: TInvoiceSelect[] = [];
	const lineRows: Record<string, unknown>[] = [];
	const posted: { entryDate: string; lines: unknown[] }[] = [];
	const openItems: Record<string, unknown>[] = [];
	const registry: string[] = [];
	let numbers = 0;
	const repo = {
		async insert(row: Record<string, unknown>) {
			const created = { ...row, id: crypto.randomUUID(), projectId: null, termKind: 'installment', createdAt: new Date() } as unknown as TInvoiceSelect;
			invoiceRows.push(created);
			return created;
		},
		async replaceItems(_org: string, invoiceId: string, rows: Record<string, unknown>[]) {
			lineRows.push(...rows.map((row) => ({ ...row, id: crypto.randomUUID(), invoiceId })));
		},
		findById: async (_org: string, id: string) => invoiceRows.find((row) => row.id === id) ?? null,
		listItems: async (_org: string, id: string) => lineRows.filter((row) => row.invoiceId === id) as never,
		async update(_org: string, id: string, patch: Record<string, unknown>) {
			const row = invoiceRows.find((item) => item.id === id);
			return row ? Object.assign(row, patch) : null;
		},
		async addReceipt(data: { invoiceId: string; amount: number; code: string; receivedDate: string }) {
			const invoice = invoiceRows.find((row) => row.id === data.invoiceId)!;
			const paidTotal = invoice.paidTotal + data.amount;
			Object.assign(invoice, {
				paidTotal,
				outstandingTotal: invoice.grandTotal - paidTotal,
				status: paidTotal >= invoice.grandTotal ? 'paid' : 'partially_paid',
			});
			return { ...data, id: crypto.randomUUID(), status: 'posted' } as unknown as TReceiptSelect;
		},
		sumLiveDownPaymentBase: async () => 0,
	};
	const invoices = new InvoiceService(
		{ transaction: async (work: (tx: unknown) => Promise<unknown>) => work('tx') } as never,
		repo as never,
		{ openItem: async (_org: string, item: Record<string, unknown>) => void openItems.push(item) } as never,
		{
			postBusinessEvent: async (_tx: unknown, event: { entryDate: string; lines: unknown[] }) => {
				posted.push({ entryDate: event.entryDate, lines: event.lines });
				return { entry: { id: 'je-1' } };
			},
		} as never,
		{} as never,
		{ next: async (type: string) => `000${++numbers}/${type === 'invoice' ? 'INV' : 'KW'}/IMS/XI/26` } as never,
		{ publish: async () => null } as never,
		{ register: async (input: { code: string }) => void registry.push(input.code), voidBySource: async () => 1 } as never,
		{ productsById: async () => new Map() } as never,
		{ createSchedules: async () => undefined } as never,
		undefined,
		{ post: async () => undefined, reverse: async () => undefined } as never,
		{
			getActiveCustomer: async (id: string) => (id === ACTIVE_CUSTOMER ? ({ id } as never) : null),
			getSnapshot: async () => ({ code: 'CUS-00009', name: 'PT Servis Jaya', type: 'company', email: null, phone: null, taxId: null, addressLine: null, postalCode: null }) as never,
			activeCustomerOptions: async (search?: string) =>
				[{ id: ACTIVE_CUSTOMER, code: 'CUS-00009', name: 'PT Servis Jaya' }].filter((row) => !search || row.name.includes(search)),
		},
	);
	return { invoices, invoiceRows, lineRows, posted, openItems, registry };
}

const freeBody = (extra: Record<string, unknown> = {}) =>
	invoiceCreateSchema.parse({
		customerId: ACTIVE_CUSTOMER,
		title: 'Jasa servis controller',
		dueDate: '2026-12-29',
		vatEnabled: true,
		items: [{ description: 'Jasa servis', quantity: 1, unitPrice: 50_000_000 }],
		...extra,
	});

describe('invoice without a sales order (B-42, KF-S6)', () => {
	test('create → issue → pay: VAT by the server, customer snapshotted, numbered, paid in full', async () => {
		const h = freeInvoiceHarness();
		const draft = await h.invoices.create(ctx, freeBody());
		expect(draft).toMatchObject({
			status: 'draft',
			orderId: null,
			customerId: ACTIVE_CUSTOMER,
			title: 'Jasa servis controller',
			customerSnapshot: expect.objectContaining({ name: 'PT Servis Jaya' }),
			vatEnabled: true,
			vatRateBps: 1100,
			subtotal: 50_000_000,
			taxTotal: 5_500_000,
			grandTotal: 55_500_000,
			createdBy: 'finance',
		});
		expect(draft.code).toBe('0001/INV/IMS/XI/26');
		expect(h.lineRows).toEqual([expect.objectContaining({ description: 'Jasa servis', taxAmount: 5_500_000, lineTotal: 55_500_000 })]);

		const issued = await h.invoices.issue(ctx, draft.id, { issueDate: '2026-11-29', dueDate: null });
		expect(issued).toMatchObject({ status: 'issued', issueDate: '2026-11-29', dueDate: '2026-12-29', outstandingTotal: 55_500_000 });
		expect(h.posted).toHaveLength(1);
		expect(h.openItems).toEqual([expect.objectContaining({ customerId: ACTIVE_CUSTOMER, originalAmount: 55_500_000, dueDate: '2026-12-29' })]);
		expect(h.registry).toEqual(['0001/INV/IMS/XI/26']);

		await h.invoices.addReceipt(ctx, draft.id, { amount: 55_500_000, receivedDate: '2026-11-30', method: 'bank_transfer', reference: null, notes: null });
		expect(h.invoiceRows[0]).toMatchObject({ status: 'paid', paidTotal: 55_500_000, outstandingTotal: 0 });
		expect(h.registry).toEqual(['0001/INV/IMS/XI/26', '0002/KW/IMS/XI/26']);
	});

	test('no VAT: the lines carry none, whatever the client sent', async () => {
		const h = freeInvoiceHarness();
		const draft = await h.invoices.create(
			ctx,
			freeBody({ vatEnabled: false, items: [{ description: 'Biaya tambahan', quantity: 2, unitPrice: 10_000_000, taxAmount: 999 }] }),
		);
		expect(draft).toMatchObject({ vatEnabled: false, vatRateBps: 0, subtotal: 20_000_000, taxTotal: 0, grandTotal: 20_000_000 });
	});

	test('the customer picker lists active customers through the customer contract (finance has no customer:read)', async () => {
		const h = freeInvoiceHarness();
		expect(await h.invoices.customerOptions('Servis')).toEqual([{ id: ACTIVE_CUSTOMER, code: 'CUS-00009', name: 'PT Servis Jaya' }]);
		expect(await h.invoices.customerOptions('Tidak ada')).toEqual([]);
	});

	test('a customer is required and must be active', async () => {
		const h = freeInvoiceHarness();
		await expect(h.invoices.create(ctx, freeBody({ customerId: null }))).rejects.toBeInstanceOf(InvoiceCustomerRequiredError);
		await expect(h.invoices.create(ctx, freeBody({ customerId: INACTIVE_CUSTOMER }))).rejects.toBeInstanceOf(InvoiceCustomerInactiveError);
		expect(h.invoiceRows).toEqual([]);
	});

	test('FU9: no invoice is issued without a due date', async () => {
		const h = freeInvoiceHarness();
		const draft = await h.invoices.create(ctx, freeBody({ dueDate: null }));
		await expect(h.invoices.issue(ctx, draft.id, { issueDate: '2026-11-29', dueDate: null })).rejects.toBeInstanceOf(InvoiceDueDateRequiredError);
		expect(h.posted).toEqual([]);
		// The issue form may supply it.
		const issued = await h.invoices.issue(ctx, draft.id, { issueDate: '2026-11-29', dueDate: '2026-12-15' });
		expect(issued).toMatchObject({ status: 'issued', dueDate: '2026-12-15' });
	});
});
