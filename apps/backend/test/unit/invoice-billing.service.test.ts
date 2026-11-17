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
import type { TInvoiceSelect, TReceiptSelect, TSalesOrderSelect } from '@drizzle/schemas/sales.schema';
import { invoiceTermCreateSchema } from '../../src/app/sales/contracts/invoice.contract';
import type { TInvoiceRepository } from '../../src/app/sales/contracts/invoice.repository.interface';
import { InvoiceNotVoidableError, InvoiceOrderUnavailableError, InvoiceTermError } from '../../src/app/sales/errors/invoice.errors';
import { InvoiceBillingService } from '../../src/app/sales/services/invoice-billing.service';
import { computeTerm, nextPlannedTerm, sumTerms } from '../../src/app/sales/utils/invoice-terms';

const ORDER = '0190a1b2-0000-7000-8000-00000000b001';
const ORG = 'org-1';
const ctx = { organizationId: ORG, actorUserId: 'finance' };

let rows: TInvoiceSelect[];
let items: Record<string, unknown>[];
let receipts: TReceiptSelect[];
let current: TSalesOrderSelect;
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
		listByOrder: async (orderId) => rows.filter((row) => row.salesOrderId === orderId),
		listReceipts: async (_org, invoiceId) => receipts.filter((row) => row.salesInvoiceId === invoiceId),
		async update(_org, id, patch) {
			const row = rows.find((item) => item.id === id);
			return row ? Object.assign(row, patch) : null;
		},
		async withLockedInvoice<T>(_org: string, id: string, work: (invoice: TInvoiceSelect, tx: unknown) => Promise<T>) {
			const row = rows.find((item) => item.id === id);
			return row ? work(row, 'tx') : null;
		},
		async createTermDraftLocked(orderId, build) {
			const liveRows = rows.filter((row) => row.salesOrderId === orderId && live(row));
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
function order(overrides: Partial<TSalesOrderSelect> = {}): TSalesOrderSelect {
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
	} as TSalesOrderSelect;
}

const draft = (term: unknown, extra: Record<string, unknown> = {}) =>
	service.createFromTerm(ctx, invoiceTermCreateSchema.parse({ salesOrderId: ORDER, term, ...extra }));

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
			findPostedEntryBySourceTypeAndId: async (_org: string, sourceType: string, sourceId: string) =>
				sourceType === 'invoice' ? ({ id: `je-${sourceId}`, status: 'posted', reversedByEntryId: null, entryDate: '2026-11-01' } as never) : null,
			updateArOpenItem: async (_org: string, invoiceId: string, patch: Record<string, unknown>) => {
				arUpdates.push({ invoiceId, patch });
				return null;
			},
		},
		{
			voidBySource: async (_module: string, _type: string, sourceId: string) => {
				voidedDocs.push(sourceId);
				return 1;
			},
		},
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
		receipts.push({ id: 'r1', code: 'KW-1', salesInvoiceId: dp.id, receivedDate: '2026-11-02', amount: dp.grandTotal, method: 'bank_transfer', reference: null, notes: null, status: 'posted', reversalReason: null } as TReceiptSelect);
		await draft({ mode: 'next' }); // a draft: not in the schedule
		const detail = await service.detail(ctx, dp.id);
		expect(detail.receipts).toEqual([expect.objectContaining({ id: 'r1', invoiceId: dp.id, amount: dp.grandTotal })]);
		expect(detail.order?.schedule.map((row) => row.description)).toEqual(['DP 30%']);
		expect(detail.order?.schedule[0]!.payments).toEqual([{ receivedDate: '2026-11-02', method: 'bank_transfer', amount: dp.grandTotal }]);
	});
});
