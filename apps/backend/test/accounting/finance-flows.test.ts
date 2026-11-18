/**
 * F3 unit tests: opening balances (batch draft + one-shot post) and cash/bank
 * (manual movement with auto-journal). The repository is an in-memory double;
 * the posting service is the REAL one over a fake repo so the journals these
 * flows produce are validated against the same rules as F2.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { CodeNumberService } from '@app/code-number';
import type {
	TAccountingPeriodSelect,
	TBankAccountLinkSelect,
	TChartOfAccountSelect,
	TJournalEntrySelect,
	TJournalLineSelect,
	TOpeningBalanceSelect,
} from '@drizzle/schemas/accounting.schema';
import type {
	TCashBankAccountSelect,
	TCashBankTransactionSelect,
} from '@drizzle/schemas/finance.schema';
import { PostingService } from '../../src/app/accounting/services/posting.service';
import { OpeningBalanceService } from '../../src/app/accounting/services/opening-balance.service';
import { CashBankService } from '../../src/app/accounting/services/cash-bank.service';
import {
	CashBankInsufficientFundsError,
	CashBankLinkRequiredError,
	JournalUnbalancedError,
	OpeningBalanceAlreadyPostedError,
} from '../../src/app/accounting/errors/ledger.errors';

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

/** One fake repo covering both the ledger and finance tables these flows use. */
function makeHarness() {
	const accounts = new Map<string, TChartOfAccountSelect>([
		['acc-cash-gl', account('acc-cash-gl', '1-1100', { name: 'Cash GL' })],
		['acc-capital', account('acc-capital', '3-1000', { name: 'Owner capital', accountType: 'equity', normalBalance: 'credit' })],
		['acc-sales', account('acc-sales', '4-1000', { name: 'Sales', accountType: 'revenue', normalBalance: 'credit' })],
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
	const openingRows: TOpeningBalanceSelect[] = [];
	const cashAccounts = new Map<string, TCashBankAccountSelect>();
	const cashTxRows: TCashBankTransactionSelect[] = [];
	const links = new Map<string, TBankAccountLinkSelect>();
	let entrySeq = 0;
	let lineSeq = 0;
	let obSeq = 0;
	let cbAccSeq = 0;
	let cbTxSeq = 0;
	let allocSeq = 0;

	const now = () => new Date();

	const repo = {
		// accounts
		findAccountById: async (_o: string, id: string) => accounts.get(id) ?? null,
		findAccountsByCodes: async () => new Map(),
		// periods
		findPeriodByMonth: async (_o: string, y: number, m: number) =>
			[...periods.values()].find(
				(p) => p.periodYear === y && p.periodMonth === m,
			) ?? null,
		// journal
		findPostedEntryByIdempotencyKey: async (_o: string, key: string) =>
			[...entries.values()].find((e) => e.idempotencyKey === key) ?? null,
		findEntryById: async (_o: string, id: string) => entries.get(id) ?? null,
		findLinesByEntryId: async (_o: string, entryId: string) =>
			journalLinesRows.filter((l) => l.journalEntryId === entryId),
		insertEntry: async (row: Record<string, unknown>) => {
			const created = {
				id: `je-${++entrySeq}`,
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
		insertLines: async (
			rows: Array<Record<string, unknown>>,
		): Promise<TJournalLineSelect[]> =>
			rows.map((row) => {
				const created = {
					id: `jl-${++lineSeq}`,
					createdAt: now(),
					updatedAt: now(),
					deletedAt: null,
					...row,
				} as TJournalLineSelect;
				journalLinesRows.push(created);
				return created;
			}),
		markReversed: async () => {},
		// opening balances
		listOpeningBalances: async () => [...openingRows.values()],
		findOpeningBalanceByAccountAndDate: async (
			_o: string,
			accountId: string,
			asOfDate: string,
		) =>
			openingRows.find(
				(r) => r.accountId === accountId && r.asOfDate === asOfDate,
			) ?? null,
		insertOpeningBalance: async (row: Record<string, unknown>) => {
			const created = {
				id: `ob-${++obSeq}`,
				postedAt: null,
				createdAt: now(),
				updatedAt: now(),
				deletedAt: null,
				...row,
			} as TOpeningBalanceSelect;
			openingRows.push(created);
			return created;
		},
		updateOpeningBalance: async (
			_o: string,
			id: string,
			patch: Record<string, unknown>,
		) => {
			const row = openingRows.find((r) => r.id === id);
			if (!row) return null;
			Object.assign(row, patch, { updatedAt: now() });
			return row;
		},
		deleteOpeningBalance: async (_o: string, id: string) => {
			const idx = openingRows.findIndex((r) => r.id === id);
			if (idx < 0) return false;
			openingRows.splice(idx, 1);
			return true;
		},
		stampOpeningBalancePosted: async (_o: string, id: string) => {
			const row = openingRows.find((r) => r.id === id);
			if (row) row.postedAt = now();
		},
		// bank account links
		findBankAccountLinkByCashAccount: async (
			_o: string,
			cashBankAccountId: string,
		) => links.get(cashBankAccountId) ?? null,
		upsertBankAccountLink: async (row: Record<string, unknown>) => {
			const created = {
				id: `bal-${row.cashBankAccountId}`,
				createdAt: now(),
				updatedAt: now(),
				deletedAt: null,
				...row,
			} as TBankAccountLinkSelect;
			links.set(created.cashBankAccountId, created);
			return created;
		},
		deactivateBankAccountLink: async () => {},
		// cash/bank
		findCashBankAccountByCode: async (_o: string, code: string) =>
			[...cashAccounts.values()].find((a) => a.code === code) ?? null,
		findCashBankAccountById: async (_o: string, id: string) =>
			cashAccounts.get(id) ?? null,
		listCashBankAccounts: async () => [...cashAccounts.values()],
		insertCashBankAccount: async (row: Record<string, unknown>) => {
			const created = {
				id: `cba-${++cbAccSeq}`,
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
		updateCashBankAccount: async (
			_o: string,
			id: string,
			patch: Record<string, unknown>,
		) => {
			const row = cashAccounts.get(id);
			if (!row) return null;
			Object.assign(row, patch, { updatedAt: now() });
			return row;
		},
		insertCashBankTransaction: async (row: Record<string, unknown>) => {
			const created = {
				id: `cbt-${++cbTxSeq}`,
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
			data: [...cashTxRows.values()],
			meta: {
				page: 1,
				limit: 20,
				total: cashTxRows.length,
				totalPages: 1,
			},
		}),
	};

	const numbering = {
		next: async (type: string) => `${type}-${String(++allocSeq).padStart(6, '0')}`,
	} as unknown as CodeNumberService;

	// A no-op "transaction" that just forwards to the fake repo.
	const tx = new Proxy({} as never, {}) as never;

	const posting = new PostingService(
		{} as unknown as BunSQLDatabase,
		repo as never,
		repo as never,
		repo as never,
		numbering,
	);
	const opening = new OpeningBalanceService(
		{ transaction: async (fn: (tx: never) => unknown) => fn(tx) } as unknown as BunSQLDatabase,
		repo as never,
		repo as never,
		posting,
	);
	const cashBank = new CashBankService(
		{ transaction: async (fn: (tx: never) => unknown) => fn(tx) } as unknown as BunSQLDatabase,
		repo as never,
		repo as never,
		posting,
		numbering,
	);

	return {
		posting,
		opening,
		cashBank,
		entries,
		journalLinesRows,
		openingRows,
		cashAccounts,
		cashTxRows,
		links,
	};
}

describe('OpeningBalanceService', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});

	test('posts a balanced batch as ONE journal entry and stamps rows', async () => {
		await h.opening.addRow(ctx, {
			accountId: 'acc-cash-gl',
			asOfDate: '2026-01-01',
			debitBalance: 50_000_000,
			creditBalance: 0,
			description: null,
		});
		await h.opening.addRow(ctx, {
			accountId: 'acc-capital',
			asOfDate: '2026-01-01',
			debitBalance: 0,
			creditBalance: 50_000_000,
			description: null,
		});
		const { entryId, rows } = await h.opening.post(ctx);
		expect(rows).toBe(2);
		const entry = h.entries.get(entryId)!;
		expect(entry.status).toBe('posted');
		expect(entry.sourceType).toBe('opening_balance');
		expect(entry.totalDebit).toBe(50_000_000);
		// rows stamped
		expect(h.openingRows.every((r) => r.postedAt !== null)).toBe(true);
	});

	test('refuses an unbalanced batch', async () => {
		await h.opening.addRow(ctx, {
			accountId: 'acc-cash-gl',
			asOfDate: '2026-01-01',
			debitBalance: 100,
			creditBalance: 0,
			description: null,
		});
		await expect(h.opening.post(ctx)).rejects.toThrow(JournalUnbalancedError);
	});

	test('refuses editing a posted row', async () => {
		await h.opening.addRow(ctx, {
			accountId: 'acc-cash-gl',
			asOfDate: '2026-01-01',
			debitBalance: 10,
			creditBalance: 0,
			description: null,
		});
		await h.opening.addRow(ctx, {
			accountId: 'acc-capital',
			asOfDate: '2026-01-01',
			debitBalance: 0,
			creditBalance: 10,
			description: null,
		});
		await h.opening.post(ctx);
		const row = h.openingRows[0]!;
		await expect(
			h.opening.updateRow(ctx, row.id, { debitBalance: 20 }),
		).rejects.toThrow(OpeningBalanceAlreadyPostedError);
	});
});

describe('CashBankService', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(async () => {
		h = makeHarness();
		await h.cashBank.createAccount(ctx, {
			code: 'BCA-01',
			name: 'BCA Operational',
			accountType: 'bank',
			openingBalance: 0,
		});
	});

	const accountId = () => [...h.cashAccounts.keys()][0]!;

	test('posts a cash-in movement with DR cash / CR counterpart and updates balance', async () => {
		await h.links.set(accountId(), {
			id: 'bal-x',
			organizationId: ORG,
			cashBankAccountId: accountId(),
			chartOfAccountId: 'acc-cash-gl',
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
		} as TBankAccountLinkSelect);

		const movement = await h.cashBank.postMovement(ctx, {
			cashBankAccountId: accountId(),
			transactionDate: '2026-01-10',
			direction: 'in',
			amount: 1_000_000,
			description: 'Owner deposit',
			referenceNumber: null,
			counterpartAccountId: 'acc-capital',
		});
		expect(movement.balanceAfter).toBe(1_000_000);
		expect(movement.code).toMatch(/^cash_bank_transaction-\d{6}$/);

		// the auto-journal: DR cash GL, CR capital
		const entry = [...h.entries.values()].find(
			(e) => e.sourceType === 'cash_bank_transaction',
		)!;
		expect(entry.status).toBe('posted');
		const lines = h.journalLinesRows.filter(
			(l) => l.journalEntryId === entry.id,
		);
		const cashLine = lines.find((l) => l.accountId === 'acc-cash-gl')!;
		expect(cashLine.debit).toBe(1_000_000);
		const capLine = lines.find((l) => l.accountId === 'acc-capital')!;
		expect(capLine.credit).toBe(1_000_000);
	});

	test('refuses a movement when no GL link exists (Q4: required at posting)', async () => {
		await expect(
			h.cashBank.postMovement(ctx, {
				cashBankAccountId: accountId(),
				transactionDate: '2026-01-10',
				direction: 'in',
				amount: 100,
				description: null,
				referenceNumber: null,
				counterpartAccountId: 'acc-capital',
			}),
		).rejects.toThrow(CashBankLinkRequiredError);
	});

	test('refuses an out movement exceeding the balance', async () => {
		await h.links.set(accountId(), {
			id: 'bal-x',
			organizationId: ORG,
			cashBankAccountId: accountId(),
			chartOfAccountId: 'acc-cash-gl',
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
		} as TBankAccountLinkSelect);

		await expect(
			h.cashBank.postMovement(ctx, {
				cashBankAccountId: accountId(),
				transactionDate: '2026-01-10',
				direction: 'out',
				amount: 500,
				description: null,
				referenceNumber: null,
				counterpartAccountId: 'acc-sales',
			}),
		).rejects.toThrow(CashBankInsufficientFundsError);
	});
});
