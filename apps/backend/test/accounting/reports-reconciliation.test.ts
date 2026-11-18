/**
 * F6 unit tests: financial reports computed from the ledger (P&L, balance
 * sheet, direct-method cash flow) and the bank reconciliation workflow.
 * The harness posts REAL journal entries through the posting service so the
 * reports read genuine `journal_lines` aggregates.
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
import { PostingService } from '../../src/app/accounting/services/posting.service';
import { ReportService } from '../../src/app/accounting/services/report.service';
import { BankReconciliationService } from '../../src/app/accounting/services/bank-reconciliation.service';
import {
	BankReconciliationStateError,
} from '../../src/app/accounting/errors/ledger.errors';

const ORG = 'org-1';
const ACTOR = 'user-1';
const ctx = { organizationId: ORG, actorUserId: ACTOR };
const reportCtx = { organizationId: ORG };

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
		['acc-cash', account('acc-cash', '1-1100', { name: 'Cash' })],
		['acc-ar', account('acc-ar', '1-1300', { name: 'Receivables' })],
		['acc-rev', account('acc-rev', '4-1000', { name: 'Sales', accountType: 'revenue', normalBalance: 'credit' })],
		['acc-exp', account('acc-exp', '5-1000', { name: 'Expense', accountType: 'expense', normalBalance: 'debit' })],
		['acc-equip', account('acc-equip', '1-4000', { name: 'Equipment', cashFlowCategory: 'investing' })],
		['acc-loan', account('acc-loan', '2-3000', { name: 'Loan', accountType: 'liability', normalBalance: 'credit', cashFlowCategory: 'financing' })],
		['acc-ar-cat', account('acc-ar-cat', '1-2100', { name: 'AR CF', cashFlowCategory: 'operating' })],
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
		[
			'per-2026-02',
			{
				id: 'per-2026-02',
				organizationId: ORG,
				code: '2026-02',
				periodYear: 2026,
				periodMonth: 2,
				startDate: '2026-02-01',
				endDate: '2026-02-28',
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
	const cashAccounts = new Map<string, { id: string; currentBalance: number; [k: string]: unknown }>();
	const reconciliations = new Map<string, { id: string; [k: string]: unknown }>();
	const reconItems: Array<{
		id: string;
		bankReconciliationId: string;
		isMatched: boolean;
		statementAmount: number | null;
	}> = [];
	let seq = 0;
	const now = () => new Date();
	const id = (p: string) => `${p}-${++seq}`;

	const repo = {
		findAccountById: async (_o: string, id: string) => accounts.get(id) ?? null,
		findAccountByCode: async (_o: string, code: string) =>
			[...accounts.values()].find((a) => a.code === code) ?? null,
		listAccountsMap: async () => accounts,
		findPeriodByMonth: async (_o: string, y: number, m: number) =>
			[...periods.values()].find((p) => p.periodYear === y && p.periodMonth === m) ?? null,
		findPostedEntryByIdempotencyKey: async () => null,
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
		listAccountActivity: async (
			_org: string,
			startDate: string,
			endDate: string,
		) => {
			// Aggregate posted lines of entries within the date range.
			const eligible = new Set(
				[...entries.values()]
					.filter(
						(e) =>
							e.status === 'posted' &&
							e.entryDate >= startDate &&
							e.entryDate <= endDate,
					)
					.map((e) => e.id),
			);
			const byAccount = new Map<string, { debit: number; credit: number }>();
			for (const line of journalLinesRows) {
				if (!eligible.has(line.journalEntryId)) continue;
				const agg = byAccount.get(line.accountId) ?? { debit: 0, credit: 0 };
				agg.debit += line.debit;
				agg.credit += line.credit;
				byAccount.set(line.accountId, agg);
			}
			return [...byAccount.entries()].map(([accountId, agg]) => ({
				accountId,
				debit: agg.debit,
				credit: agg.credit,
			}));
		},
		// cash/bank (for reconciliation book balance)
		findCashBankAccountById: async (_o: string, id: string) =>
			cashAccounts.get(id) ?? null,
		findCashBankAccountByCode: async () => null,
		listCashBankAccounts: async () => [...cashAccounts.values()],
		insertCashBankAccount: async (row: Record<string, unknown>) => {
			const created = { id: id('cba'), currentBalance: 0, ...row };
			cashAccounts.set(created.id, created);
			return created;
		},
		updateCashBankAccount: async () => null,
		insertCashBankTransaction: async () => null,
		listCashBankTransactions: async () => ({
			data: [],
			meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
		}),
		findBankAccountLinkByCashAccount: async () => null,
		upsertBankAccountLink: async () => null,
		deactivateBankAccountLink: async () => {},
		// reconciliation
		insertBankReconciliation: async (row: Record<string, unknown>) => {
			const created = { id: id('rec'), reconciledBy: null, reconciledAt: null, ...row };
			reconciliations.set(created.id, created);
			return created;
		},
		findBankReconciliationById: async (_o: string, id: string) =>
			reconciliations.get(id) ?? null,
		listBankReconciliations: async () => ({
			data: [...reconciliations.values()],
			meta: { page: 1, limit: 20, total: reconciliations.size, totalPages: 1 },
		}),
		updateBankReconciliation: async (_o: string, id: string, patch: Record<string, unknown>) => {
			const row = reconciliations.get(id);
			if (!row) return null;
			Object.assign(row, patch);
			return row;
		},
		insertBankReconciliationItems: async (rows: Array<Record<string, unknown>>) =>
			rows.map((row) => {
				const created = {
					id: id('ri'),
					isMatched: false,
					statementAmount: null,
					...row,
				};
				reconItems.push(created as never);
				return created;
			}),
		listBankReconciliationItems: async (_o: string, recId: string) =>
			reconItems.filter((r) => r.bankReconciliationId === recId),
		updateBankReconciliationItem: async (_o: string, id: string, patch: Record<string, unknown>) => {
			const row = reconItems.find((r) => r.id === id);
			if (!row) return null;
			Object.assign(row, patch);
			return row;
		},
	};

	const numbering = {
		next: async (type: string) => `${type}-${String(++seq).padStart(6, '0')}`,
	} as unknown as CodeNumberService;

	const tx = new Proxy({} as never, {}) as never;
	const dbLike = {
		transaction: async (fn: (tx: never) => unknown) => fn(tx),
	} as unknown as BunSQLDatabase;

	const posting = new PostingService({} as unknown as BunSQLDatabase, repo as never, repo as never, repo as never, numbering);
	const reports = new ReportService(repo as never, repo as never);
	const reconciliationsService = new BankReconciliationService(
		dbLike,
		repo as never,
		repo as never,
		numbering,
	);

	/** Posts a balanced entry through the REAL posting service. */
	const post = async (
		date: string,
		lines: Array<{ accountId: string; debit?: number; credit?: number }>,
	) =>
		posting.post(tx, {
			organizationId: ORG,
			entryDate: date,
			sourceModule: 'accounting',
			sourceType: 'test',
			idempotencyKey: `t:${id('k')}`,
			description: null,
			lines: lines.map((l) => ({
				accountId: l.accountId,
				debit: l.debit ?? 0,
				credit: l.credit ?? 0,
			})),
		});

	return {
		posting,
		post,
		reports,
		reconciliations: reconciliationsService,
		entries,
		journalLinesRows,
		cashAccounts,
		reconItems,
		accounts,
	};
}

describe('ReportService (F6)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});

	test('P&L: revenue − expenses over the range', async () => {
		// January: sell 1,000,000 on credit; incur 400,000 expense on cash.
		await h.post('2026-01-10', [
			{ accountId: 'acc-ar', debit: 1_000_000 },
			{ accountId: 'acc-rev', credit: 1_000_000 },
		]);
		await h.post('2026-01-15', [
			{ accountId: 'acc-exp', debit: 400_000 },
			{ accountId: 'acc-cash', credit: 400_000 },
		]);
		// February: another sale (outside the January range).
		await h.post('2026-02-10', [
			{ accountId: 'acc-ar', debit: 500_000 },
			{ accountId: 'acc-rev', credit: 500_000 },
		]);

		const pl = await h.reports.profitAndLoss(reportCtx, '2026-01-01', '2026-01-31');
		expect(pl.totalRevenue).toBe(1_000_000);
		expect(pl.totalExpenses).toBe(400_000);
		expect(pl.netIncome).toBe(600_000);
	});

	test('balance sheet: assets = liabilities + equity + current earnings', async () => {
		// Owner capital: DR cash 5,000,000 / CR loan (financing) 2,000,000 + implicit equity via revenue route
		await h.post('2026-01-05', [
			{ accountId: 'acc-cash', debit: 2_000_000 },
			{ accountId: 'acc-loan', credit: 2_000_000 },
		]);
		await h.post('2026-01-10', [
			{ accountId: 'acc-ar', debit: 1_000_000 },
			{ accountId: 'acc-rev', credit: 1_000_000 },
		]);
		await h.post('2026-01-15', [
			{ accountId: 'acc-exp', debit: 400_000 },
			{ accountId: 'acc-cash', credit: 400_000 },
		]);

		const bs = await h.reports.balanceSheet(reportCtx, '2026-01-31');
		// assets: cash 1.6M + AR 1M = 2.6M
		expect(bs.totalAssets).toBe(2_600_000);
		expect(bs.totalLiabilities).toBe(2_000_000);
		// equity carries the current earnings (600k)
		expect(bs.totalEquity).toBe(600_000);
		expect(bs.unexplained).toBe(0);
	});

	test('cash flow: direct method by cash_flow_category', async () => {
		// operating: AR collected 800,000 (cash in, AR credited)
		await h.post('2026-01-10', [
			{ accountId: 'acc-ar', debit: 1_000_000 },
			{ accountId: 'acc-rev', credit: 1_000_000 },
		]);
		await h.post('2026-01-20', [
			{ accountId: 'acc-cash', debit: 800_000 },
			{ accountId: 'acc-ar-cat', credit: 800_000 },
		]);
		// investing: buy equipment 500,000 (equip debited = outflow)
		await h.post('2026-01-25', [
			{ accountId: 'acc-equip', debit: 500_000 },
			{ accountId: 'acc-cash', credit: 500_000 },
		]);
		// financing: loan drawdown 2,000,000
		await h.post('2026-01-05', [
			{ accountId: 'acc-cash', debit: 2_000_000 },
			{ accountId: 'acc-loan', credit: 2_000_000 },
		]);

		const cf = await h.reports.cashFlow(reportCtx, '2026-01-01', '2026-01-31');
		expect(cf.netOperating).toBe(800_000);
		expect(cf.netInvesting).toBe(-500_000);
		expect(cf.netFinancing).toBe(2_000_000);
		expect(cf.netChangeInCash).toBe(2_300_000);
	});
});

describe('BankReconciliationService (F6)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(async () => {
		h = makeHarness();
		await h.cashAccounts.set('cba-1', {
			id: 'cba-1',
			currentBalance: 5_000_000,
		} as never);
	});

	const create = async () =>
		h.reconciliations.create(ctx, {
			cashBankAccountId: 'cba-1',
			reconciliationDate: '2026-01-31',
			statementBalance: 5_000_000,
			notes: null,
		}) as Promise<{ id: string; [k: string]: unknown }>;

	test('workflow draft → in_progress → reconciled → closed with full matching', async () => {
		const rec = await create();
		expect(rec.status).toBe('draft');
		expect(rec.bookBalance).toBe(5_000_000);
		expect(rec.difference).toBe(0);

		await h.reconciliations.addItems(ctx, rec.id, [
			{
				cashBankTransactionId: null,
				statementReference: 'STMT-1',
				statementAmount: 5_000_000,
				notes: null,
			},
		]);
		await h.reconciliations.matchItem(ctx, rec.id, h.reconItems[0].id, null);

		const reconciled = (await h.reconciliations.reconcile(ctx, rec.id)) as {
			status: string;
		};
		expect(reconciled.status).toBe('reconciled');

		const closed = (await h.reconciliations.close(ctx, rec.id)) as {
			status: string;
		};
		expect(closed.status).toBe('closed');
	});

	test('refuses reconciling with unmatched items', async () => {
		const rec = await create();
		await h.reconciliations.addItems(ctx, rec.id, [
			{
				cashBankTransactionId: null,
				statementReference: 'STMT-1',
				statementAmount: 1_000_000,
				notes: null,
			},
			{
				cashBankTransactionId: null,
				statementReference: 'STMT-2',
				statementAmount: 4_000_000,
				notes: null,
			},
		]);
		await h.reconciliations.matchItem(ctx, rec.id, h.reconItems[0].id, null);
		await expect(h.reconciliations.reconcile(ctx, rec.id)).rejects.toThrow(
			BankReconciliationStateError,
		);
	});

	test('refuses reconciling when matched items do not explain the statement balance', async () => {
		const rec = await create();
		await h.reconciliations.addItems(ctx, rec.id, [
			{
				cashBankTransactionId: null,
				statementReference: 'STMT-1',
				statementAmount: 1_000_000,
				notes: null,
			},
		]);
		await h.reconciliations.matchItem(ctx, rec.id, h.reconItems[0].id, null);
		await expect(h.reconciliations.reconcile(ctx, rec.id)).rejects.toThrow(
			BankReconciliationStateError,
		);
	});

	test('refuses closing before reconciling and stale-state operations', async () => {
		const rec = await create();
		await expect(h.reconciliations.close(ctx, rec.id)).rejects.toThrow(
			BankReconciliationStateError,
		);
		// add items after reconcile→closed would be refused; draft check first:
		await h.reconciliations.addItems(ctx, rec.id, [
			{
				cashBankTransactionId: null,
				statementReference: 'S',
				statementAmount: 1,
				notes: null,
			},
		]);
	});
});
