/**
 * AR postings (ERP-0135): the invoice journal builder, deferred-revenue
 * amortisation, credit memos and maker-checker write-offs.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import type { TArOpenItemSelect, TCreditMemoSelect, TDeferredRevenueScheduleSelect } from '@drizzle/schemas/finance.schema';
import { allocateProRata, buildInvoicePosting } from '../../src/app/sale/utils/invoice-posting';
import { amortisationForMonth, monthsBetween } from '../../src/app/finance/utils/deferred-revenue';
import { DeferredRevenueService } from '../../src/app/finance/services/deferred-revenue.service';
import {
	creditTax,
	ReceivableAdjustmentService,
} from '../../src/app/finance/services/receivable-adjustment.service';
import {
	CreditMemoAmountError,
	WriteOffNotRequestedError,
	WriteOffSelfApprovalError,
} from '../../src/app/finance/errors/ledger.errors';

const ORG = 'org-1';
const runner = { run: <T>(work: (tx: never) => Promise<T>) => work({} as never) };

const sum = (lines: Array<{ debit: number; credit: number }>, side: 'debit' | 'credit') =>
	lines.reduce((acc, line) => acc + line[side], 0);

describe('buildInvoicePosting', () => {
	const invoice = { id: 'inv', customerId: 'cus', subtotal: 1_000_000, discountTotal: 0, taxTotal: 110_000, grandTotal: 1_110_000 };

	test('a down payment credits customer advances, not revenue', () => {
		const { lines, schedules } = buildInvoicePosting({
			invoice: { ...invoice, termKind: 'down_payment' },
			items: [{ id: 'l1', productId: null, lineTotal: 1_110_000, taxAmount: 110_000, servicePeriodStart: null, servicePeriodEnd: null }],
			productCategoryById: new Map(),
			advanceBase: 0,
		});
		expect(lines.map((l) => [l.role, l.debit, l.credit])).toEqual([
			['receivable', 1_110_000, 0],
			['customer_advance', 0, 1_000_000],
			['vat_output', 0, 110_000],
		]);
		expect(schedules).toEqual([]);
	});

	test('a settlement releases the earlier DP into revenue', () => {
		const { lines } = buildInvoicePosting({
			invoice: { ...invoice, termKind: 'settlement', subtotal: 700_000, taxTotal: 77_000, grandTotal: 777_000 },
			items: [{ id: 'l1', productId: null, lineTotal: 777_000, taxAmount: 77_000, servicePeriodStart: null, servicePeriodEnd: null }],
			productCategoryById: new Map(),
			advanceBase: 300_000,
		});
		expect(lines.find((l) => l.role === 'customer_advance')?.debit).toBe(300_000);
		expect(lines.find((l) => l.role === 'revenue')?.credit).toBe(1_000_000);
		expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
	});

	test('revenue splits by product category, service lines are deferred, the discount is allocated', () => {
		const { lines, schedules } = buildInvoicePosting({
			invoice: { ...invoice, termKind: null, subtotal: 1_500_000, discountTotal: 150_000, taxTotal: 148_500, grandTotal: 1_498_500 },
			items: [
				{ id: 'hw', productId: 'p-hw', lineTotal: 1_100_000, taxAmount: 100_000, servicePeriodStart: null, servicePeriodEnd: null },
				{ id: 'sw', productId: 'p-sw', lineTotal: 555_000, taxAmount: 55_000, servicePeriodStart: '2026-01-15', servicePeriodEnd: '2026-12-31' },
			],
			productCategoryById: new Map([
				['p-hw', 'cat-hardware'],
				['p-sw', 'cat-software'],
			]),
			advanceBase: 0,
		});
		const revenue = lines.find((l) => l.role === 'revenue');
		expect(revenue).toMatchObject({ discriminatorType: 'product_category', discriminatorValue: 'cat-hardware', credit: 900_000 });
		expect(lines.find((l) => l.role === 'deferred_revenue')?.credit).toBe(450_000);
		expect(schedules).toEqual([
			{
				invoiceItemId: 'sw',
				amount: 450_000,
				startDate: '2026-01-15',
				endDate: '2026-12-31',
				discriminatorType: 'product_category',
				discriminatorValue: 'cat-software',
			},
		]);
		expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
	});

	test('allocation is exact', () => {
		expect(allocateProRata(100, [1, 1, 1])).toEqual([34, 33, 33]);
		expect(allocateProRata(7, [0, 0])).toEqual([7, 0]);
	});
});

describe('deferred revenue amortisation', () => {
	test('straight-line per month; the last month takes the remainder', () => {
		expect(monthsBetween('2026-11-20', '2027-02-05')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
		const parts = ['2026-11', '2026-12', '2027-01', '2027-02'].map((m) => amortisationForMonth(1_000, '2026-11-20', '2027-02-05', m));
		expect(parts).toEqual([250, 250, 250, 250]);
		expect(amortisationForMonth(1_001, '2026-11-01', '2027-01-31', '2027-01')).toBe(335);
		expect(amortisationForMonth(1_001, '2026-11-01', '2027-01-31', '2027-03')).toBe(0);
	});

	test('the run catches a schedule up, one idempotent journal per month', async () => {
		const schedule = {
			id: 'sch-1',
			organizationId: ORG,
			totalAmount: 1_200,
			recognizedAmount: 0,
			startDate: '2026-01-01',
			endDate: '2026-12-31',
			recognizedThrough: null,
			status: 'active',
			discriminatorType: 'product_category',
			discriminatorValue: 'cat-software',
		} as unknown as TDeferredRevenueScheduleSelect;
		const posted: Array<{ key: string; lines: Array<{ role: string; discriminatorValue?: string | null; credit: number }> }> = [];
		const updates: Array<Record<string, unknown>> = [];
		const service = new DeferredRevenueService(
			runner as never,
			{
				listDue: async () => [schedule],
				update: async (_o: string, _id: string, patch: Record<string, unknown>) => {
					updates.push(patch);
				},
			} as never,
			{ listEntriesBySource: async () => [] } as never,
			{
				postBusinessEvent: async (_tx: unknown, input: { idempotencyKey: string; lines: never }) => {
					posted.push({ key: input.idempotencyKey, lines: input.lines });
					return { entry: { id: 'je' } } as never;
				},
			} as never,
		);
		const result = await service.runMonth({ organizationId: ORG, actorUserId: 'acc' }, 2026, 3);
		expect(result).toMatchObject({ month: '2026-03', entries: 3, amount: 300 });
		expect(posted.map((p) => p.key)).toEqual(['deferred:sch-1:2026-01', 'deferred:sch-1:2026-02', 'deferred:sch-1:2026-03']);
		expect(posted[0].lines[1]).toMatchObject({ role: 'revenue', discriminatorValue: 'cat-software', credit: 100 });
		expect(updates[updates.length - 1]).toMatchObject({ recognizedAmount: 300, recognizedThrough: '2026-03', status: 'active' });
	});
});

function openItem(overrides: Partial<TArOpenItemSelect> = {}): TArOpenItemSelect {
	return {
		id: 'ar-1',
		organizationId: ORG,
		invoiceId: 'inv-1',
		customerId: 'cus-1',
		originalAmount: 1_110_000,
		paidAmount: 0,
		outstandingAmount: 1_110_000,
		adjustedAmount: 0,
		status: 'open',
		writeOffReason: null,
		writeOffRequestedBy: null,
		writeOffRequestedAt: null,
		writtenOffBy: null,
		writtenOffAt: null,
		writeOffEntryId: null,
		...overrides,
	} as TArOpenItemSelect;
}

function adjustmentHarness(item: TArOpenItemSelect) {
	let current = item;
	const memos = new Map<string, TCreditMemoSelect>();
	const posted: Array<{ eventType: string; lines: Array<{ role: string; debit: number; credit: number }> }> = [];
	const invoiceUpdates: Array<Record<string, unknown>> = [];
	const service = new ReceivableAdjustmentService(
		runner as never,
		{
			insert: async (row: Record<string, unknown>) => {
				const memo = { id: 'cm-1', status: 'draft', journalEntryId: null, ...row } as unknown as TCreditMemoSelect;
				memos.set(memo.id, memo);
				return memo;
			},
			findById: async (_o: string, id: string) => memos.get(id) ?? null,
			update: async (_o: string, id: string, patch: Record<string, unknown>) => {
				const memo = { ...memos.get(id)!, ...patch } as TCreditMemoSelect;
				memos.set(id, memo);
				return memo;
			},
		} as never,
		{
			findArOpenItemByInvoice: async () => current,
			updateArOpenItem: async (_o: string, _i: string, patch: Record<string, unknown>) => {
				current = { ...current, ...patch } as TArOpenItemSelect;
				return current;
			},
		} as never,
		{
			findById: async () => ({ id: 'inv-1', customerId: 'cus-1', taxTotal: 110_000, grandTotal: 1_110_000 }) as never,
			updateTotals: async (_o: string, _i: string, patch: Record<string, unknown>) => {
				invoiceUpdates.push(patch);
				return null;
			},
		},
		{
			postBusinessEvent: async (_tx: unknown, input: { eventType: string; lines: never }) => {
				posted.push({ eventType: input.eventType, lines: input.lines });
				return { entry: { id: `je-${posted.length}` } } as never;
			},
			reverse: async () => ({}) as never,
		} as never,
		{ next: async () => 'CN-0001' },
	);
	return { service, posted, invoiceUpdates, current: () => current };
}

describe('credit memos and write-offs', () => {
	const maker = { organizationId: ORG, actorUserId: 'finance-a' };
	const checker = { organizationId: ORG, actorUserId: 'accountant-b' };

	test('a credit memo posts returns + VAT against the receivable and lowers the open amount', async () => {
		const h = adjustmentHarness(openItem());
		const memo = await h.service.createCreditMemo(maker, { invoiceId: 'inv-1', memoDate: '2026-11-25', amount: 222_000, reason: 'harga' });
		expect(memo.taxAmount).toBe(creditTax(222_000, { taxTotal: 110_000, grandTotal: 1_110_000 }));
		await h.service.applyCreditMemo(maker, memo.id);
		expect(h.posted[0].lines).toEqual([
			{ role: 'sales_return', debit: 200_000, credit: 0, partyType: 'customer', partyId: 'cus-1' } as never,
			{ role: 'vat_output', debit: 22_000, credit: 0 } as never,
			{ role: 'receivable', debit: 0, credit: 222_000, partyType: 'customer', partyId: 'cus-1' } as never,
		]);
		expect(h.current()).toMatchObject({ originalAmount: 888_000, adjustedAmount: 222_000, outstandingAmount: 888_000, status: 'open' });
		expect(h.invoiceUpdates[h.invoiceUpdates.length - 1]).toEqual({ outstandingTotal: 888_000, status: 'issued' });
	});

	test('a credit larger than the open amount is refused', async () => {
		const h = adjustmentHarness(openItem({ paidAmount: 1_000_000, outstandingAmount: 110_000, status: 'partially_paid' }));
		await expect(
			h.service.createCreditMemo(maker, { invoiceId: 'inv-1', memoDate: '2026-11-25', amount: 200_000, reason: 'x' }),
		).rejects.toThrow(CreditMemoAmountError);
	});

	test('a write-off needs a request and a different approver', async () => {
		const h = adjustmentHarness(openItem({ paidAmount: 110_000, outstandingAmount: 1_000_000, status: 'partially_paid' }));
		await expect(h.service.approveWriteOff(checker, 'inv-1')).rejects.toThrow(WriteOffNotRequestedError);
		await h.service.requestWriteOff(maker, 'inv-1', 'pelanggan pailit');
		await expect(h.service.approveWriteOff(maker, 'inv-1')).rejects.toThrow(WriteOffSelfApprovalError);
		await h.service.approveWriteOff(checker, 'inv-1');
		expect(h.posted[0]).toMatchObject({ eventType: 'finance.receivable_written_off' });
		expect(h.posted[0].lines.map((l) => [l.role, l.debit, l.credit])).toEqual([
			['bad_debt_allowance', 1_000_000, 0],
			['receivable', 0, 1_000_000],
		]);
		expect(h.current()).toMatchObject({ status: 'written_off', outstandingAmount: 0, originalAmount: 110_000, adjustedAmount: 1_000_000 });
		expect(h.invoiceUpdates[h.invoiceUpdates.length - 1]).toEqual({ outstandingTotal: 0, status: 'written_off' });
	});
});
