/**
 * F5 unit tests: supplier bill recording (DR expense / DR input tax / CR AP +
 * ap_open_items), supplier payment execution (cash out = DR AP / CR cash) and
 * AP aging. Real posting service over fake repos (same harness as F4).
 */
import { fixturePostingRules } from './posting-rules.fixture';
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type {
	TAccountingPeriodSelect,
	TChartOfAccountSelect,
	TJournalEntrySelect,
	TJournalLineSelect,
} from '@drizzle/schemas/finance.schema';
import type {
	TCashBankAccountSelect,
	TCashBankTransactionSelect,
	TSupplierBillSelect,
} from '@drizzle/schemas/finance.schema';
import { PostingService } from '../../src/app/finance/services/posting.service';
import { ArAccountResolverService } from '../../src/app/finance/services/ar-account-resolver.service';
import { CashBankService } from '../../src/app/finance/services/cash-bank.service';
import { PaymentService } from '../../src/app/payment/services/payment.service';
import { SupplierBillService } from '../../src/app/finance/services/supplier-bill.service';
import {
	BillNotDraftError,
	CashBankAccountInactiveError,
} from '../../src/app/finance/errors/ledger.errors';
import {
	PaymentOverAllocationError,
	PaymentTargetNotIssuedError,
} from '../../src/app/payment/errors/payment.errors';

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
		['acc-tax-in', account('acc-tax-in', '1-1800', { name: 'Input tax' })],
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
		supplierCompanyId: string | null;
		dueDate: string | null;
		originalAmount: number;
		paidAmount: number;
		outstandingAmount: number;
		status: string;
	}> = [];
	const paymentsRows = new Map<string, { id: string; [k: string]: unknown }>();
	const allocations: Array<{
		id: string;
		paymentId: string;
		payableType: string;
		payableId: string;
		amount: number;
		updatedAt?: Date;
	}> = [];
	let seq = 0;
	const now = () => new Date();
	const id = (p: string) => `${p}-${++seq}`;

	const repoFake = {
		findAccountById: async (_o: string, id: string) => accounts.get(id) ?? null,
		findAccountByCode: async (_o: string, code: string) =>
			[...accounts.values()].find((a) => a.code === code) ?? null,
		findPeriodByMonth: async (_o: string, y: number, m: number) =>
			[...periods.values()].find((p) => p.periodYear === y && p.periodMonth === m) ?? null,
		findPostedEntryByIdempotencyKey: async (_o: string, key: string) =>
			[...entries.values()].find((e) => e.idempotencyKey === key) ?? null,
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
		// cash/bank
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
		paginateTransactions: async () => ({
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
		// bills + AP sub-ledger
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
		paginate: async () => ({
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
		// payments
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
		syncAllocations: async (_o: string, paymentId: string, rows: Array<{ payableType: string; payableId: string; amount: number }>) => {
			const live = allocations.filter((a) => a.paymentId === paymentId);
			for (const row of rows) {
				const found = live.find((a) => a.payableType === row.payableType && a.payableId === row.payableId);
				if (found) found.amount = row.amount;
				else allocations.push({ id: id('alloc'), paymentId, ...row });
			}
			return allocations.filter((a) => a.paymentId === paymentId) as never;
		},
		listPaymentAllocations: async (_o: string, paymentId: string) =>
			allocations.filter((a) => a.paymentId === paymentId),
	};
	const repo = repoFake;

	const numbering = {
		next: async (type: string) => `${type}-${String(++seq).padStart(6, '0')}`,
	} as unknown as never;

	const tx = new Proxy({} as never, {}) as never;
	const dbLike = {
		transaction: async (fn: (tx: never) => unknown) => fn(tx),
	} as unknown as BunSQLDatabase;

	// ADR-0024: the payment ledger moved to its own module. These adapters point
	// the payment service at this fake through its own repository and through
	// Accounting's settlement port, both backed by the same in-memory rows.
	const paymentLedger = {
		countOpen: async () =>
			(await repoFake.listPayments()).data.filter((p) =>
				['draft', 'submitted', 'approved'].includes(p.status as string),
			).length,
		list: () => repoFake.listPayments(),
		findById: repoFake.findPaymentById,
		insert: repoFake.insertPayment,
		update: repoFake.updatePayment,
		syncAllocations: repoFake.syncAllocations,
		listAllocations: repoFake.listPaymentAllocations,
	};
	const settlement = {
		findSalesInvoice: async () => null,
		findArOpenItem: async () => null,
		applyArSettlement: async () => undefined,
		findSupplierBill: repo.findSupplierBillById,
		findApOpenItem: repo.findApOpenItemByBill,
		applyApSettlement: async (
			org: string,
			billId: string,
			patch: { paidAmount: number; outstandingAmount: number; status: string },
			_txIn: never,
		) => {
			await repo.updateApOpenItem(org, billId, patch);
			await repo.updateSupplierBill(org, billId, {
				paidTotal: patch.paidAmount,
				outstandingTotal: patch.outstandingAmount,
				status: patch.status,
			});
		},
		postCashMovement: async (input: Record<string, unknown>, txIn: never) => {
			const counterpartAccountId = await arResolver.resolve(
				input.organizationId as string,
				input.side === 'payable' ? 'ap' : 'ar',
			);
			await cashBank.postMovement(
				{ organizationId: input.organizationId as string, actorUserId: input.actorUserId as string },
				{
					cashBankAccountId: input.cashBankAccountId as string,
					transactionDate: input.businessDate as string,
					direction: input.direction as 'in' | 'out',
					amount: input.amount as number,
					description: input.description as string,
					referenceNumber: input.referenceNumber as string,
					counterpartAccountId,
					sourceType: input.sourceType as string,
					sourceId: input.sourceId as string,
				},
				txIn,
			);
		},
	};

	const posting = new PostingService({} as unknown as BunSQLDatabase, repo as never, repo as never, repo as never, numbering);
	const arResolver = new ArAccountResolverService(fixturePostingRules(repo as never));
	const cashBank = new CashBankService(dbLike, repo as never, repo as never, posting, numbering);
	const paymentService = new PaymentService(dbLike, paymentLedger as never, settlement as never, numbering);
	const billService = new SupplierBillService(
		dbLike,
		repo as never,
		repo as never,
		repo as never,
		posting,
		arResolver,
		numbering,
		{} as never,
		{ publish: async () => null } as never,
		{ assertActiveCompany: async () => null } as never,
	);

	return {
		posting,
		billService,
		paymentService,
		cashBank,
		entries,
		journalLinesRows,
		bills,
		apItems,
		paymentsRows,
		cashAccounts,
		cashTxRows,
		links,
		accounts,
	};
}

async function seedRecordedBill(
	h: ReturnType<typeof makeHarness>,
	grandTotal = 1_000_000,
	taxTotal = 0,
) {
	const bill = (await h.billService.create(ctx, {
		supplierCompanyId: 'sup-1',
		purchaseOrderId: null,
		billDate: '2026-01-05',
		dueDate: '2026-02-04',
		subtotal: grandTotal - taxTotal,
		taxTotal,
		currencyCode: 'IDR',
		notes: null,
	})) as TSupplierBillSelect;
	return h.billService.record(ctx, bill.id) as Promise<TSupplierBillSelect>;
}

describe('SupplierBillService (F5)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});

	test('record posts DR expense / CR AP and opens the AP sub-ledger row', async () => {
		const recorded = await seedRecordedBill(h, 1_000_000);
		expect(recorded.status).toBe('approved');
		expect(recorded.outstandingTotal).toBe(1_000_000);

		const entry = [...h.entries.values()].find(
			(e) => e.sourceType === 'supplier_bill',
		)!;
		expect(entry.status).toBe('posted');
		expect(entry.sourceModule).toBe('finance');
		const lines = h.journalLinesRows.filter((l) => l.journalEntryId === entry.id);
		expect(lines).toHaveLength(2);
		const exp = lines.find((l) => l.accountId === 'acc-exp')!;
		expect(exp.debit).toBe(1_000_000);
		const ap = lines.find((l) => l.accountId === 'acc-ap')!;
		expect(ap.credit).toBe(1_000_000);

		expect(h.apItems).toHaveLength(1);
		expect(h.apItems[0].outstandingAmount).toBe(1_000_000);
		expect(h.apItems[0].status).toBe('open');
	});

	test('record with input tax posts three balanced lines', async () => {
		await seedRecordedBill(h, 1_100_000, 100_000);
		const entry = [...h.entries.values()].find(
			(e) => e.sourceType === 'supplier_bill',
		)!;
		const lines = h.journalLinesRows.filter((l) => l.journalEntryId === entry.id);
		expect(lines).toHaveLength(3);
		const tax = lines.find((l) => l.accountId === 'acc-tax-in')!;
		expect(tax.debit).toBe(100_000);
		const dr = lines.reduce((s, l) => s + l.debit, 0);
		const cr = lines.reduce((s, l) => s + l.credit, 0);
		expect(dr).toBe(cr);
	});

	test('refuses to record twice or cancel a recorded bill', async () => {
		const recorded = await seedRecordedBill(h);
		await expect(h.billService.record(ctx, recorded.id)).rejects.toThrow(
			BillNotDraftError,
		);
		await expect(h.billService.cancel(ctx, recorded.id)).rejects.toThrow(
			BillNotDraftError,
		);
	});
});

describe('Supplier payments + AP aging (F5)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(async () => {
		h = makeHarness();
		await h.cashBank.createAccount(ctx, {
			code: 'BCA-01',
			name: 'BCA',
			accountType: 'bank',
			openingBalance: 5_000_000,
		});
		const cashId = [...h.cashAccounts.keys()][0];
		h.links.set(cashId, {
			cashBankAccountId: cashId,
			chartOfAccountId: 'acc-cash-gl',
		} as never);
		// pre-fund the account so cash-out guards pass
		const cash = h.cashAccounts.get(cashId)!;
		cash.currentBalance = 5_000_000;
	});

	const cashId = (hh: ReturnType<typeof makeHarness>) =>
		[...hh.cashAccounts.keys()][0];

	test('supplier payment executes cash-out with DR AP / CR cash', async () => {
		const bill = await seedRecordedBill(h, 1_000_000);
		const payment = await h.paymentService.create(
			ctx,
			{
				paymentType: 'disbursement',
				counterpartyType: 'supplier',
				counterpartyId: 'sup-1',
				amount: 1_000_000,
				paymentMethod: 'bank_transfer',
				paymentDate: '2026-01-20',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		await h.paymentService.setAllocations(ctx, payment.id, [
			{ payableType: 'supplier_bill', payableId: bill.id, amount: 1_000_000 },
		]);
		await h.paymentService.submit(ctx, payment.id);
		await h.paymentService.approve(ctx, payment.id);
		const executed = await h.paymentService.execute(ctx, payment.id);

		expect(executed.status).toBe('executed');
		expect(executed.direction).toBe('out');
		// both mirrors settled
		expect(h.apItems[0].status).toBe('paid');
		expect(h.apItems[0].outstandingAmount).toBe(0);
		expect(h.bills.get(bill.id)!.status).toBe('paid');
		// cash went out
		expect(h.cashAccounts.get(cashId(h))!.currentBalance).toBe(4_000_000);
		// journal: DR AP / CR cash
		const entry = [...h.entries.values()].find((e) => e.sourceType === 'payment')!;
		const lines = h.journalLinesRows.filter((l) => l.journalEntryId === entry.id);
		const ap = lines.find((l) => l.accountId === 'acc-ap')!;
		const cash = lines.find((l) => l.accountId === 'acc-cash-gl')!;
		expect(ap.debit).toBe(1_000_000);
		expect(cash.credit).toBe(1_000_000);
	});

	test('partial bill payment leaves mirrors partially_paid', async () => {
		const bill = await seedRecordedBill(h, 1_000_000);
		const payment = await h.paymentService.create(
			ctx,
			{
				paymentType: 'disbursement',
				counterpartyType: null,
				counterpartyId: null,
				amount: 250_000,
				paymentMethod: 'cash',
				paymentDate: '2026-01-20',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		await h.paymentService.setAllocations(ctx, payment.id, [
			{ payableType: 'supplier_bill', payableId: bill.id, amount: 250_000 },
		]);
		await h.paymentService.submit(ctx, payment.id);
		await h.paymentService.approve(ctx, payment.id);
		await h.paymentService.execute(ctx, payment.id);

		expect(h.apItems[0].status).toBe('partially_paid');
		expect(h.apItems[0].outstandingAmount).toBe(750_000);
		expect(h.bills.get(bill.id)!.status).toBe('partially_paid');
	});

	test('refuses allocations to unrecorded bills and over-allocation', async () => {
		const draftBill = (await h.billService.create(ctx, {
			supplierCompanyId: 'sup-1',
			purchaseOrderId: null,
			billDate: '2026-01-06',
			dueDate: null,
			subtotal: 100_000,
			taxTotal: 0,
			currencyCode: 'IDR',
			notes: null,
		})) as TSupplierBillSelect;
		const payment = await h.paymentService.create(
			ctx,
			{
				paymentType: 'disbursement',
				counterpartyType: null,
				counterpartyId: null,
				amount: 100_000,
				paymentMethod: 'bank_transfer',
				paymentDate: '2026-01-20',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		// draft (unrecorded) bill is not a valid target
		await expect(
			h.paymentService.setAllocations(ctx, payment.id, [
				{ payableType: 'supplier_bill', payableId: draftBill.id, amount: 100_000 },
			]),
		).rejects.toThrow(PaymentTargetNotIssuedError);

		// recorded bill, over-allocated
		const bill = await seedRecordedBill(h, 100_000);
		await expect(
			h.paymentService.setAllocations(ctx, payment.id, [
				{ payableType: 'supplier_bill', payableId: bill.id, amount: 100_000 },
				{ payableType: 'supplier_bill', payableId: bill.id, amount: 1 },
			]),
		).rejects.toThrow();
		// and plain over-allocation against outstanding
		const payment2 = await h.paymentService.create(
			ctx,
			{
				paymentType: 'disbursement',
				counterpartyType: null,
				counterpartyId: null,
				amount: 200_000,
				paymentMethod: 'bank_transfer',
				paymentDate: '2026-01-20',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		await expect(
			h.paymentService.setAllocations(ctx, payment2.id, [
				{ payableType: 'supplier_bill', payableId: bill.id, amount: 200_000 },
			]),
		).rejects.toThrow(PaymentOverAllocationError);
	});

	test('inactive cash account refuses execution', async () => {
		const bill = await seedRecordedBill(h, 100_000);
		const payment = await h.paymentService.create(
			ctx,
			{
				paymentType: 'disbursement',
				counterpartyType: null,
				counterpartyId: null,
				amount: 100_000,
				paymentMethod: 'bank_transfer',
				paymentDate: '2026-01-20',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		await h.paymentService.setAllocations(ctx, payment.id, [
			{ payableType: 'supplier_bill', payableId: bill.id, amount: 100_000 },
		]);
		await h.paymentService.submit(ctx, payment.id);
		await h.paymentService.approve(ctx, payment.id);
		const cash = h.cashAccounts.get(cashId(h))!;
		cash.isActive = false;
		await expect(h.paymentService.execute(ctx, payment.id)).rejects.toThrow(
			CashBankAccountInactiveError,
		);
		expect(h.cashTxRows).toHaveLength(0);
	});
});
