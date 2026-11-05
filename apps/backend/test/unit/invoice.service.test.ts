/**
 * Invoices and receipts (ADR-0011 step 3d-2): free billing terms that never
 * exceed the order and settle without rounding drift, derived DP /
 * settlement kinds, numbering on issue, void rules, receipts that never
 * overpay, reversal.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TInvoiceSelect, TReceiptSelect } from '@drizzle/schemas/finance.schema';
import type { TSalesOrderSelect } from '@drizzle/schemas/sales.schema';
import { createInvoiceSchema, createReceiptSchema } from '../../src/app/finance/contracts/invoice.contract';
import type {
	IInvoiceRepository,
	TComputedTerm,
	TInvoiceDraftData,
	TReceiptData,
} from '../../src/app/finance/contracts/invoice.repository.interface';
import {
	InvoiceDueBeforeIssueError,
	InvoiceOrderUnavailableError,
	InvoiceStateError,
	InvoiceTermError,
	ReceiptAlreadyReversedError,
	ReceiptExceedsOutstandingError,
} from '../../src/app/finance/errors/finance.errors';
import { InvoiceService } from '../../src/app/finance/services/invoice.service';
import { computeTerm, nextPlannedTerm, paymentStatus, sumTerms, type TTermAmounts } from '../../src/app/finance/utils/invoice-terms';

const ORDER = '0190a1b2-0000-7000-8000-00000000b001';

class FakeInvoices implements IInvoiceRepository {
	rows: TInvoiceSelect[] = [];
	receipts: TReceiptSelect[] = [];
	async paginate() {
		return { meta: { page: 1, limit: 20, total: this.rows.length, totalPages: 1 }, data: this.rows };
	}
	async findById(id: string) {
		return this.rows.find((row) => row.id === id) ?? null;
	}
	async listByOrder(orderId: string) {
		return this.rows.filter((row) => row.salesOrderId === orderId);
	}
	async hasLiveInvoices(orderId: string) {
		return this.rows.some((row) => row.salesOrderId === orderId && row.status !== 'void');
	}
	async createDraftLocked(data: TInvoiceDraftData, compute: (billed: TTermAmounts, liveCount: number) => TComputedTerm) {
		const live = this.rows.filter((row) => row.salesOrderId === data.salesOrderId && row.status !== 'void');
		const term = compute(sumTerms(live.map((row) => ({ taxBase: row.subtotal, vatAmount: row.taxTotal, total: row.grandTotal }))), live.length);
		const row = {
			...data,
			id: crypto.randomUUID(),
			code: null,
			termKind: term.termKind,
			description: term.description,
			percentageBps: term.percentageBps,
			subtotal: term.taxBase,
			taxTotal: term.vatAmount,
			grandTotal: term.total,
			paidTotal: 0,
			outstandingTotal: term.total,
			status: 'draft',
		} as TInvoiceSelect;
		this.rows.push(row);
		return row;
	}
	async issue(id: string, patch: { code: string; issueDate: string; dueDate: string | null; issuedBy: string }) {
		const row = await this.findById(id);
		if (!row || row.status !== 'draft') return null;
		return Object.assign(row, patch, { status: 'issued' as const });
	}
	async void(id: string, actor: string, reason: string) {
		const row = await this.findById(id);
		if (!row || !['draft', 'issued'].includes(row.status) || row.paidTotal > 0) return null;
		return Object.assign(row, { status: 'void' as const, voidedBy: actor, voidReason: reason, outstandingTotal: 0 });
	}
	async findReceipt(id: string) {
		return this.receipts.find((row) => row.id === id) ?? null;
	}
	async listReceipts(invoiceId: string) {
		return this.receipts.filter((row) => row.invoiceId === invoiceId);
	}
	async paginateReceipts() {
		return { meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] };
	}
	async addReceipt(data: TReceiptData) {
		const invoice = (await this.findById(data.invoiceId))!;
		if (data.amount > invoice.outstandingTotal) return null;
		const receipt = { ...data, id: crypto.randomUUID(), status: 'posted' } as TReceiptSelect;
		this.receipts.push(receipt);
		const paid = invoice.paidTotal + data.amount;
		Object.assign(invoice, { paidTotal: paid, outstandingTotal: invoice.grandTotal - paid, status: paymentStatus(invoice.grandTotal, paid) });
		return receipt;
	}
	async reverseReceipt(id: string, actor: string, reason: string) {
		const receipt = await this.findReceipt(id);
		if (!receipt || receipt.status !== 'posted') return null;
		Object.assign(receipt, { status: 'reversed', reversedBy: actor, reversalReason: reason });
		const invoice = (await this.findById(receipt.invoiceId))!;
		const paid = invoice.paidTotal - receipt.amount;
		Object.assign(invoice, { paidTotal: paid, outstandingTotal: invoice.grandTotal - paid, status: paymentStatus(invoice.grandTotal, paid) });
		return receipt;
	}
}

/** Rp 1.000.000,01 tax base (odd on purpose), 11% VAT. */
function order(overrides: Partial<TSalesOrderSelect> = {}): TSalesOrderSelect {
	return {
		id: ORDER,
		code: '0001/SO/IMS/XI/26',
		quotationCode: '1376/QT/IMS/X/26',
		title: 'Swing gate',
		status: 'confirmed',
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

let repo: FakeInvoices;
let current: TSalesOrderSelect;
let service: InvoiceService;
let sequence: number;
const draft = (term: unknown, extra: Record<string, unknown> = {}) =>
	service.createDraft('finance', createInvoiceSchema.parse({ salesOrderId: ORDER, term, ...extra }));

beforeEach(() => {
	repo = new FakeInvoices();
	current = order();
	sequence = 0;
	service = new InvoiceService(
		repo,
		{
			getOrderForBilling: async (id: string) =>
				id === ORDER && current.status !== 'cancelled' ? { order: current, items: [] } : null,
			getOrderForPrint: async (id: string) => (id === ORDER ? { order: current, items: [] } : null),
		},
		{ next: async (type: string) => `000${++sequence}/${type === 'invoice' ? 'INV' : 'KW'}/IMS/XI/26` },
		{ get: async () => ({ defaultInvoiceTerms: '1. Garansi 1 tahun' }) as never },
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
		expect(computeTerm(amounts, sumTerms([]), { mode: 'amount', total: 11_100_000 })).toEqual({
			taxBase: 10_000_000,
			vatAmount: 1_100_000,
			total: 11_100_000,
		});
	});

	test('more than is left, or a fully invoiced order, is refused', () => {
		expect(() => computeTerm(amounts, sumTerms([]), { mode: 'amount', total: 200_000_000 })).toThrow();
		expect(() => computeTerm(amounts, amounts, { mode: 'remaining' })).toThrow();
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

describe('drafting invoices', () => {
	test('the first planned term is the DP, the last one settles the exact remainder', async () => {
		const dp = await draft({ mode: 'next' });
		expect(dp).toMatchObject({ termKind: 'down_payment', description: 'DP 30%', percentageBps: 3000, status: 'draft', code: null });
		expect(dp.terms).toBe('1. Garansi 1 tahun');
		const rest = await draft({ mode: 'next' });
		expect(rest).toMatchObject({ termKind: 'settlement', description: 'Terpasang 70%' });
		expect(dp.grandTotal + rest.grandTotal).toBe(111_000_001);
		await expect(draft({ mode: 'next' })).rejects.toBeInstanceOf(InvoiceTermError);
		await expect(draft({ mode: 'remaining' })).rejects.toBeInstanceOf(InvoiceTermError);
	});

	test('free terms: installment in between, labels default per kind', async () => {
		expect((await draft({ mode: 'percentage', bps: 2000 })).description).toBe('DP 20%');
		const middle = await draft({ mode: 'amount', total: 11_100_000 }, { description: 'Material tiba' });
		expect(middle).toMatchObject({ termKind: 'installment', description: 'Material tiba' });
		expect(await draft({ mode: 'remaining' })).toMatchObject({ termKind: 'settlement', description: 'Pelunasan' });
	});

	test('a void invoice frees its share again; a cancelled order cannot be billed', async () => {
		const dp = await draft({ mode: 'percentage', bps: 5000 });
		await service.void('finance', dp.id, 'salah termin');
		expect((await draft({ mode: 'remaining' })).grandTotal).toBe(111_000_001);
		current = order({ status: 'cancelled' });
		await expect(draft({ mode: 'remaining' })).rejects.toBeInstanceOf(InvoiceOrderUnavailableError);
	});
});

describe('issuing, voiding, receipts', () => {
	test('numbered on issue; the due date cannot precede the issue date', async () => {
		const invoice = await draft({ mode: 'next' });
		await expect(service.issue('finance', invoice.id, { issueDate: '2026-11-10', dueDate: '2026-11-01' })).rejects.toBeInstanceOf(
			InvoiceDueBeforeIssueError,
		);
		const issued = await service.issue('finance', invoice.id, { issueDate: '2026-11-10', dueDate: '2026-11-24' });
		expect(issued).toMatchObject({ code: '0001/INV/IMS/XI/26', status: 'issued', issueDate: '2026-11-10' });
		await expect(service.issue('finance', invoice.id, {})).rejects.toBeInstanceOf(InvoiceStateError);
	});

	test('partial then full payment; never more than outstanding; a paid invoice cannot be voided', async () => {
		const invoice = await draft({ mode: 'remaining' });
		await expect(
			service.addReceipt('finance', invoice.id, createReceiptSchema.parse({ amount: 1, method: 'cash' })),
		).rejects.toBeInstanceOf(InvoiceStateError); // still a draft
		await service.issue('finance', invoice.id, {});
		const first = await service.addReceipt('finance', invoice.id, createReceiptSchema.parse({ amount: 11_000_001, method: 'bank_transfer' }));
		expect(first.code).toBe('0002/KW/IMS/XI/26');
		expect((await repo.findById(invoice.id))!.status).toBe('partially_paid');
		await expect(
			service.addReceipt('finance', invoice.id, createReceiptSchema.parse({ amount: 100_000_001, method: 'cash' })),
		).rejects.toBeInstanceOf(ReceiptExceedsOutstandingError);
		await service.addReceipt('finance', invoice.id, createReceiptSchema.parse({ amount: 100_000_000, method: 'cash' }));
		expect((await repo.findById(invoice.id))!).toMatchObject({ status: 'paid', outstandingTotal: 0 });
		await expect(service.void('finance', invoice.id, 'x')).rejects.toBeInstanceOf(InvoiceStateError);
	});

	test('reversing a receipt restores the outstanding amount; twice is refused', async () => {
		const invoice = await draft({ mode: 'remaining' });
		await service.issue('finance', invoice.id, {});
		const receipt = await service.addReceipt('finance', invoice.id, createReceiptSchema.parse({ amount: 111_000_001, method: 'cash' }));
		await service.reverseReceipt('finance', receipt.id, 'salah input');
		expect((await repo.findById(invoice.id))!).toMatchObject({ status: 'issued', paidTotal: 0, outstandingTotal: 111_000_001 });
		await expect(service.reverseReceipt('finance', receipt.id, 'lagi')).rejects.toBeInstanceOf(ReceiptAlreadyReversedError);
	});

	test('the billing summary and the printed schedule', async () => {
		const dp = await draft({ mode: 'next' });
		await service.issue('finance', dp.id, {});
		await service.addReceipt('finance', dp.id, createReceiptSchema.parse({ amount: dp.grandTotal, method: 'cash', receivedDate: '2026-11-12' }));
		const summary = await service.summary(ORDER);
		expect(summary).toMatchObject({ invoiced: dp.grandTotal, paid: dp.grandTotal, outstanding: 0 });
		expect(summary.remainingToInvoice).toBe(111_000_001 - dp.grandTotal);
		expect(summary.nextTerm).toMatchObject({ description: 'Terpasang 70%' });
		const detail = await service.get(dp.id);
		expect(detail.order?.schedule).toEqual([
			expect.objectContaining({ description: 'DP 30%', payments: [{ receivedDate: '2026-11-12', method: 'cash', amount: dp.grandTotal }] }),
		]);
	});
});
