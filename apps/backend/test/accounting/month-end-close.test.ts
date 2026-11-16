/**
 * F7 unit tests: month-end close checklist (computed on demand, D7) and the
 * void-executed-payment reversal deferred from F4 decision 4a — mirrored
 * cash movement + AP/AR open-item rollback, all through the real posting
 * path (D4 append-only corrections).
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { CodeNumberService } from '@app/code-number';
import type {
	TAccountingPeriodSelect,
	TChartOfAccountSelect,
	TJournalEntrySelect,
	TJournalLineSelect,
} from '@drizzle/schemas/accounting.schema';
import type {
	TCashBankAccountSelect,
	TCashBankTransactionSelect,
	TSupplierBillSelect,
} from '@drizzle/schemas/finance.schema';
import type { LedgerRepository } from '../../src/app/accounting/repositories/ledger.repository';
import { PostingService } from '../../src/app/accounting/services/posting.service';
import { ArAccountResolverService } from '../../src/app/accounting/services/ar-account-resolver.service';
import { CashBankService } from '../../src/app/accounting/services/cash-bank.service';
import { PaymentService } from '../../src/app/accounting/services/payment.service';
import { SupplierBillService } from '../../src/app/accounting/services/supplier-bill.service';
import { MonthEndCloseService } from '../../src/app/accounting/services/month-end-close.service';
import { PaymentInvalidTransitionError } from '../../src/app/accounting/errors/ledger.errors';

const ORG = 'org-1';
const ACTOR = 'user-1';
const ctx = { organizationId: ORG, actorUserId: ACTOR };

function account(
	id: string,
	code: string,
	overrides: Partial<TChartOfAccountSelect> = {},
): TChartOfAccountSelect {
	return {
		id,
		organizationId: ORG,
		code,
		name: code,
		accountType: 'asset',
		normalBalance: 'debit',
		parentAccountId: null,
		level: 1,
		isPostable: true,
		isSystem: false,
		isActive: true,
		cashFlowCategory: null,
		description: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		...overrides,
	} as TChartOfAccountSelect;
}

function makeHarness() {
	const accounts = new Map<string, TChartOfAccountSelect>([
		['acc-ap', account('acc-ap', '2-1100', { name: 'Trade payables', accountType: 'liability', normalBalance: 'credit' })],
		['acc-exp', account('acc-exp', '5-1000', { name: 'Operating expense', accountType: 'expense', normalBalance: 'debit' })],
		['acc-tax-in', account('acc-tax-in', '1-1800', { name: 'Input tax', accountType: 'asset', normalBalance: 'debit' })],
		['acc-cash-gl', account('acc-cash-gl', '1-1100', { name: 'Cash GL' })],
	]);
	const periods = new Map<string, TAccountingPeriodSelect>([
		[
			'per-2026-01',
			{
				id: 'per-2026-01',
				organizationId: ORG,
				code: '2026-01',
				periodYear: 2026,
				periodMonth: 1,
				startDate: '2026-01-01',
				endDate: '2026-01-31',
				status: 'open',
				closedBy: null,
				closedAt: null,
				reopenedBy: null,
				reopenedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
			} as TAccountingPeriodSelect,
		],
	]);
	const entries = new Map<string, TJournalEntrySelect>();
	const journalLinesRows: TJournalLineSelect[] = [];
	const cashAccounts = new Map<string, TCashBankAccountSelect>();
	const cashTxRows: TCashBankTransactionSelect[] = [];
	const links = new Map<string, { cashBankAccountId: string; chartOfAccountId: string }>();
	const bills = new Map<string, TSupplierBillSelect>();
	const apItems: Array<{
		id: string;
		supplierBillId: string;
		originalAmount: number;
		paidAmount: number;
		outstandingAmount: number;
		status: string;
	}> = [];
	const paymentsRows = new Map<string, { id: string; [k: string]: unknown }>();
	const allocations: Array<{
		id: string;
		paymentId: string;
		supplierBillId: string | null;
		salesInvoiceId: string | null;
		amount: number;
	}> = [];
	let seq = 0;
	const now = () => new Date();
	const id = (p: string) => `${p}-${++seq}`;

	// Ensure a period for the current month exists (the void reversal posts
	// on today's date, which lands in the live period).
	{
		const today = new Date();
		const y = today.getFullYear();
		const m = today.getMonth() + 1;
		const key = `per-cur-${y}-${m}`;
		periods.set(key, {
			id: key,
			organizationId: ORG,
			code: `${y}-${String(m).padStart(2, '0')}`,
			periodYear: y,
			periodMonth: m,
			startDate: `${y}-${String(m).padStart(2, '0')}-01`,
			endDate: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
			status: 'open',
			closedBy: null,
			closedAt: null,
			reopenedBy: null,
			reopenedAt: null,
			createdAt: now(),
			updatedAt: now(),
			deletedAt: null,
		} as TAccountingPeriodSelect);
	}

	const repo = {
		findAccountById: async (_o: string, id: string) => accounts.get(id) ?? null,
		findAccountByCode: async (_o: string, code: string) =>
			[...accounts.values()].find((a) => a.code === code) ?? null,
		findPeriodByMonth: async (_o: string, y: number, m: number) =>
			[...periods.values()].find((p) => p.periodYear === y && p.periodMonth === m) ?? null,
		findPostedEntryByIdempotencyKey: async (_o: string, key: string) =>
			[...entries.values()].find((e) => e.idempotencyKey === key) ?? null,
		findPostedEntryBySourceTypeAndId: async (
			_o: string,
			sourceType: string,
			sourceId: string,
		) =>
			[...entries.values()]
				.filter((e) => e.sourceType === sourceType && e.sourceId === sourceId)
				.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null,
		findEntryById: async (_o: string, id: string) => entries.get(id) ?? null,
		findLinesByEntryId: async (_o: string, entryId: string) =>
			journalLinesRows.filter((l) => l.journalEntryId === entryId),
		insertEntry: async (row: Record<string, unknown>) => {
			const created = {
				id: id('je'),
				organizationId: ORG,
				reversedByEntryId: null,
				preparedBy: null,
				submittedAt: null,
				approvedBy: null,
				approvedAt: null,
				createdAt: now(),
				updatedAt: now(),
				deletedAt: null,
				...row,
			} as TJournalEntrySelect;
			entries.set(created.id, created);
			return created;
		},
		insertLines: async (rows: Array<Record<string, unknown>>) =>
			rows.map((row) => {
				const created = { id: id('jl'), createdAt: now(), updatedAt: now(), deletedAt: null, ...row } as TJournalLineSelect;
				journalLinesRows.push(created);
				return created;
			}),
		markReversed: async () => {},
		findCashBankAccountByCode: async () => null,
		findCashBankAccountById: async (_o: string, id: string) => cashAccounts.get(id) ?? null,
		listCashBankAccounts: async () => [...cashAccounts.values()],
		insertCashBankAccount: async (row: Record<string, unknown>) => {
			const created = {
				id: id('cba'),
				isActive: true,
				currencyCode: 'IDR',
				createdAt: now(),
				updatedAt: now(),
				deletedAt: null,
				...row,
			} as TCashBankAccountSelect;
			cashAccounts.set(created.id, created);
			return created;
		},
		updateCashBankAccount: async (_o: string, id: string, patch: Record<string, unknown>) => {
			const row = cashAccounts.get(id);
			if (!row) return null;
			Object.assign(row, patch);
			return row;
		},
		insertCashBankTransaction: async (row: Record<string, unknown>) => {
			const created = {
				id: id('cbt'),
				currencyCode: 'IDR',
				sourceType: null,
				sourceId: null,
				createdAt: now(),
				updatedAt: now(),
				deletedAt: null,
				...row,
			} as TCashBankTransactionSelect;
			cashTxRows.push(created);
			return created;
		},
		listCashBankTransactions: async () => ({
			data: [...cashTxRows],
			meta: { page: 1, limit: 20, total: cashTxRows.length, totalPages: 1 },
		}),
		findBankAccountLinkByCashAccount: async (_o: string, cbId: string) =>
			links.get(cbId) ?? null,
		upsertBankAccountLink: async (row: Record<string, unknown>) => {
			links.set(row.cashBankAccountId as string, row as never);
			return row;
		},
		deactivateBankAccountLink: async () => {},
		insertSupplierBill: async (row: Record<string, unknown>) => {
			const created = {
				id: id('sb'),
				createdAt: now(),
				updatedAt: now(),
				deletedAt: null,
				paidTotal: 0,
				outstandingTotal: 0,
				...row,
			} as TSupplierBillSelect;
			bills.set(created.id, created);
			return created;
		},
		findSupplierBillItems: async () => [],
		findSupplierBillById: async (_o: string, id: string) => bills.get(id) ?? null,
		updateSupplierBill: async (_o: string, id: string, patch: Record<string, unknown>) => {
			const row = bills.get(id);
			if (!row) return null;
			Object.assign(row, patch);
			return row;
		},
		listSupplierBills: async () => ({
			data: [...bills.values()],
			meta: { page: 1, limit: 20, total: bills.size, totalPages: 1 },
		}),
		insertApOpenItem: async (row: Record<string, unknown>) => {
			const created = { id: id('ap'), ...row } as never;
			apItems.push(created);
			return created;
		},
		findApOpenItemByBill: async (_o: string, billId: string) =>
			apItems.find((r) => r.supplierBillId === billId) ?? null,
		updateApOpenItem: async (_o: string, billId: string, patch: Record<string, unknown>) => {
			const row = apItems.find((r) => r.supplierBillId === billId);
			if (!row) return null;
			Object.assign(row, patch);
			return row;
		},
		listApOpenItemsForAging: async () =>
			apItems.filter((r) => r.status !== 'paid' && r.status !== 'void'),
		findSalesInvoiceById: async () => null,
		findArOpenItemByInvoice: async () => null,
		updateArOpenItem: async () => null,
		updateSalesInvoiceTotals: async () => null,
		insertPayment: async (row: Record<string, unknown>) => {
			const created = {
				id: id('pay'),
				createdAt: now(),
				updatedAt: now(),
				deletedAt: null,
				voidedAt: null,
				voidReason: null,
				...row,
			};
			paymentsRows.set(created.id as string, created);
			return created;
		},
		updatePayment: async (_o: string, id: string, patch: Record<string, unknown>) => {
			const row = paymentsRows.get(id);
			if (!row) return null;
			Object.assign(row, patch);
			return row;
		},
		findPaymentById: async (_o: string, id: string) => paymentsRows.get(id) ?? null,
		listPayments: async () => ({
			data: [...paymentsRows.values()],
			meta: { page: 1, limit: 20, total: paymentsRows.size, totalPages: 1 },
		}),
		insertPaymentAllocations: async (rows: Array<Record<string, unknown>>) =>
			rows.map((row) => {
				const created = { id: id('alloc'), createdAt: now(), updatedAt: now(), ...row } as never;
				allocations.push(created);
				return created;
			}),
		listPaymentAllocations: async (_o: string, paymentId: string) =>
			allocations.filter((a) => a.paymentId === paymentId),
		listExecutedAllocations: async (_o: string, paymentId: string) =>
			allocations.filter((a) => a.paymentId === paymentId),
		markAllocationExecuted: async (_o: string, allocId: string) => {
			const row = allocations.find((a) => a.id === allocId);
			if (row) (row as { updatedAt?: Date }).updatedAt = now();
		},
		closeChecklistCounts: async () => ({
			draftInvoicesInRange: draftInvoiceCount,
			postedInPeriod: entries.size,
			draftPayments: [...paymentsRows.values()].filter((p) =>
				['draft', 'submitted', 'approved'].includes(p.status as string),
			).length,
			draftBills: [...bills.values()].filter((b) => b.status === 'draft').length,
			unreconciledReconciliations: unreconciledCount,
		}),
	} as unknown as LedgerRepository;

	let draftInvoiceCount = 0;
	let unreconciledCount = 0;

	const numbering = {
		next: async (type: string) => `${type}-${String(++seq).padStart(6, '0')}`,
	} as unknown as CodeNumberService;

	const tx = new Proxy({} as never, {}) as never;
	const dbLike = {
		transaction: async (fn: (tx: never) => unknown) => fn(tx),
	} as unknown as BunSQLDatabase;

	const posting = new PostingService({} as unknown as BunSQLDatabase, repo, numbering);
	const arResolver = new ArAccountResolverService(repo);
	const cashBank = new CashBankService(dbLike, repo, posting, numbering);
	const paymentService = new PaymentService(dbLike, repo, cashBank, arResolver, numbering);
	const billService = new SupplierBillService(dbLike, repo, posting, arResolver, numbering, {} as never, { publish: async () => null } as never, { get: async () => null } as never);
	const closeService = new MonthEndCloseService(dbLike, repo, cashBank);

	return {
		billService,
		paymentService,
		cashBank,
		closeService,
		entries,
		journalLinesRows,
		bills,
		apItems,
		paymentsRows,
		cashAccounts,
		cashTxRows,
		links,
		setDraftInvoices: (n: number) => (draftInvoiceCount = n),
		setUnreconciled: (n: number) => (unreconciledCount = n),
	};
}

async function seedExecutedSupplierPayment(
	h: ReturnType<typeof makeHarness>,
	amount = 1_000_000,
) {
	const bill = (await h.billService.create(ctx, {
		supplierId: 'sup-1',
		purchaseOrderId: null,
		billDate: '2026-01-05',
		dueDate: '2026-02-04',
		subtotal: amount,
		taxTotal: 0,
		currencyCode: 'IDR',
		notes: null,
	})) as TSupplierBillSelect;
	await h.billService.record(ctx, bill.id);

	await h.cashAccounts.set(
		'cba-1',
		{
			id: 'cba-1',
			isActive: true,
			currentBalance: 5_000_000,
			currencyCode: 'IDR',
		} as unknown as TCashBankAccountSelect,
	);
	h.links.set('cba-1', { cashBankAccountId: 'cba-1', chartOfAccountId: 'acc-cash-gl' });

	const payment = (await h.paymentService.create(
		ctx,
		{
			paymentType: 'supplier_payment',
			counterpartyType: 'supplier',
			counterpartyId: 'sup-1',
			amount,
			paymentMethod: 'bank_transfer',
			paymentDate: '2026-01-20',
			cashBankAccountId: 'cba-1',
			referenceNumber: null,
			notes: null,
		},
		[{ supplierBillId: bill.id, amount }],
	)) as { id: string };
	await h.paymentService.setAllocations(ctx, payment.id, [
		{ supplierBillId: bill.id, amount },
	]);
	await h.paymentService.submit(ctx, payment.id);
	await h.paymentService.approve(ctx, payment.id);
	const executed = (await h.paymentService.execute(ctx, payment.id)) as {
		id: string;
		status: string;
	};
	return { bill, payment: executed };
}

describe('MonthEndCloseService checklist (F7)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});

	test('all clear when there is nothing pending', async () => {
		const report = await h.closeService.checklist(ORG, 2026, 1);
		expect(report.allClear).toBe(true);
		expect(report.items.find((i) => i.key === 'pending_payments')?.pass).toBe(
			true,
		);
	});

	test('flags pending payments, drafts, and open reconciliations', async () => {
		await seedExecutedSupplierPayment(h); // executed → not pending
		const payment = (await h.paymentService.create(
			ctx,
			{
				paymentType: 'supplier_payment',
				counterpartyType: 'supplier',
				counterpartyId: 'sup-1',
				amount: 1,
				paymentMethod: 'cash',
				paymentDate: '2026-01-21',
				cashBankAccountId: 'cba-1',
				referenceNumber: null,
				notes: null,
			},
			[{ supplierBillId: 'sb-none', amount: 1 }],
		)) as { id: string };
		h.setDraftInvoices(2);
		h.setUnreconciled(1);

		const report = await h.closeService.checklist(ORG, 2026, 1);
		expect(report.allClear).toBe(false);
		expect(
			report.items.find((i) => i.key === 'pending_payments')?.count,
		).toBe(1); // the draft payment only; the executed one does not block
		expect(report.items.find((i) => i.key === 'draft_invoices')?.count).toBe(2);
		expect(
			report.items.find((i) => i.key === 'open_reconciliations')?.pass,
		).toBe(false);
		void payment;
	});
});

describe('voidExecutedPayment (F7, deferred from F4 4a)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});

	test('reverses mirrors and cash, marks void, appends a mirrored JE', async () => {
		const { bill, payment } = await seedExecutedSupplierPayment(h);
		const cashBefore = 5_000_000 - 1_000_000;
		expect(
			(h.cashAccounts.get('cba-1') as { currentBalance: number })
				.currentBalance,
		).toBe(cashBefore);
		const entryCountBefore = h.entries.size;

		const voided = (await h.closeService.voidExecutedPayment(ctx, payment.id, {
			reason: 'wrong counterparty',
		})) as { status: string; voidReason: string };

		expect(voided.status).toBe('void');
		expect(voided.voidReason).toBe('wrong counterparty');

		// cash returned
		expect(
			(h.cashAccounts.get('cba-1') as { currentBalance: number })
				.currentBalance,
		).toBe(5_000_000);
		// new cash transaction row, opposite direction
		const lastTx = h.cashTxRows[h.cashTxRows.length - 1];
		expect(lastTx.direction).toBe('in');
		expect(lastTx.amount).toBe(1_000_000);
		// the mirrored JE carries payment_void provenance (cash tx rows do not)
		const voidEntry = [...h.entries.values()].find(
			(e) => e.sourceType === 'payment_void',
		);
		expect(voidEntry?.sourceId).toBe(payment.id);
		// AP mirror rolled back
		expect(bill.paidTotal).toBe(0);
		expect(bill.outstandingTotal).toBe(1_000_000);
		expect(bill.status).toBe('approved');
		expect(h.apItems[0].paidAmount).toBe(0);
		expect(h.apItems[0].outstandingAmount).toBe(1_000_000);
		expect(h.apItems[0].status).toBe('approved');
		// a new (mirrored) journal entry was appended, never an edit
		expect(h.entries.size).toBe(entryCountBefore + 1);
	});

	test('refuses voiding a payment that is not executed', async () => {
		await seedExecutedSupplierPayment(h);
		const draft = (await h.paymentService.create(
			ctx,
			{
				paymentType: 'supplier_payment',
				counterpartyType: 'supplier',
				counterpartyId: 'sup-1',
				amount: 1,
				paymentMethod: 'cash',
				paymentDate: '2026-01-21',
				cashBankAccountId: 'cba-1',
				referenceNumber: null,
				notes: null,
			},
			[{ supplierBillId: 'sb-none', amount: 1 }],
		)) as { id: string };
		await expect(
			h.closeService.voidExecutedPayment(ctx, draft.id, { reason: 'x' }),
		).rejects.toThrow(PaymentInvalidTransitionError);
	});
});
