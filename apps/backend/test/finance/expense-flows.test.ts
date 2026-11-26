/**
 * ERP-0013 unit tests: employee expense claims.
 *
 * Real posting service over fake repositories (same harness style as
 * `ap-flows.test.ts`). Covers the accrual journal shape (with and without
 * input tax), the server-derived total, the state machine, the employee and
 * expense-account gates, and posting idempotency.
 */
import { fixturePostingRules } from './posting-rules.fixture';
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type {
	TAccountingPeriodSelect,
	TChartOfAccountSelect,
	TExpenseClaimItemSelect,
	TExpenseClaimSelect,
	TJournalEntrySelect,
	TJournalLineSelect,
} from '@drizzle/schemas/finance.schema';
import { PostingService } from '../../src/app/finance/services/posting.service';
import { ArAccountResolverService } from '../../src/app/finance/services/ar-account-resolver.service';
import { ExpenseClaimService } from '../../src/app/finance/services/expense-claim.service';
import {
	ExpenseClaimAccountError,
	ExpenseClaimEmployeeError,
	ExpenseClaimEmptyError,
	ExpenseClaimNotDraftError,
	ExpenseClaimTransitionError,
} from '../../src/app/finance/errors/expense.errors';

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

function makeHarness(employeeStatus = 'active') {
	const accounts = new Map<string, TChartOfAccountSelect>([
		['acc-exp', account('acc-exp', '5-1000', { name: 'Operating expense', accountType: 'expense' })],
		['acc-exp-2', account('acc-exp-2', '5-1100', { name: 'Travel expense', accountType: 'expense' })],
		['acc-claim', account('acc-claim', '2-1200', { name: 'Expense claims payable', accountType: 'liability', normalBalance: 'credit' })],
		['acc-tax-in', account('acc-tax-in', '1-1800', { name: 'Input tax' })],
		['acc-rev', account('acc-rev', '4-1000', { name: 'Revenue', accountType: 'revenue', normalBalance: 'credit' })],
		['acc-inactive', account('acc-inactive', '5-9999', { name: 'Old expense', accountType: 'expense', isActive: false })],
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
	const claims = new Map<string, TExpenseClaimSelect>();
	const claimItems: TExpenseClaimItemSelect[] = [];
	let seq = 0;
	const id = (p: string) => `${p}-${++seq}`;
	const now = () => new Date();

	const repo = {
		// chart of accounts
		findAccountById: async (_o: string, id: string) => accounts.get(id) ?? null,
		findAccountByCode: async (_o: string, code: string) =>
			[...accounts.values()].find((a) => a.code === code) ?? null,
		// periods
		findPeriodByMonth: async (_o: string, y: number, m: number) =>
			[...periods.values()].find((p) => p.periodYear === y && p.periodMonth === m) ?? null,
		// journal
		findPostedEntryByIdempotencyKey: async (_o: string, key: string) =>
			[...entries.values()].find((e) => e.idempotencyKey === key) ?? null,
		findEntryById: async (_o: string, id: string) => entries.get(id) ?? null,
		findEntryBySource: async (_o: string, sourceType: string, sourceId: string) =>
			[...entries.values()].find(
				(e) => e.sourceType === sourceType && e.sourceId === sourceId,
			) ?? null,
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
		// expense claims
		insertExpenseClaim: async (row: Record<string, unknown>) => {
			const created = {
				id: id('ec'),
				submittedBy: null,
				submittedAt: null,
				approvedBy: null,
				approvedAt: null,
				paymentId: null,
				notes: null,
				createdAt: now(),
				updatedAt: now(),
				deletedAt: null,
				...row,
			} as TExpenseClaimSelect;
			claims.set(created.id, created);
			return created;
		},
		findExpenseClaimById: async (_o: string, id: string) => claims.get(id) ?? null,
		updateExpenseClaim: async (_o: string, id: string, patch: Record<string, unknown>) => {
			const row = claims.get(id);
			if (!row) return null;
			Object.assign(row, patch);
			return row;
		},
		paginate: async () => ({
			data: [...claims.values()],
			meta: { page: 1, limit: 20, total: claims.size, totalPages: 1 },
		}),
		insertExpenseClaimItems: async (rows: Array<Record<string, unknown>>) =>
			rows.map((row) => {
				const created = { id: id('eci'), createdAt: now(), updatedAt: now(), deletedAt: null, ...row } as TExpenseClaimItemSelect;
				claimItems.push(created);
				return created;
			}),
		findExpenseClaimItems: async (_o: string, claimId: string) =>
			claimItems.filter((row) => row.expenseClaimId === claimId && row.deletedAt == null),
		deleteExpenseClaimItems: async (_o: string, claimId: string) => {
			for (const row of claimItems) {
				if (row.expenseClaimId === claimId && row.deletedAt == null) row.deletedAt = now();
			}
		},
	};

	const numbering = {
		next: async (type: string) => `${type}-${String(++seq).padStart(6, '0')}`,
	} as unknown as never;

	const tx = new Proxy({} as never, {}) as never;
	const dbLike = {
		transaction: async (fn: (tx: never) => unknown) => fn(tx),
	} as unknown as BunSQLDatabase;

	const employees = {
		findEmployeeById: async (id: string) =>
			id === 'emp-1'
				? { id, organizationId: ORG, employmentStatus: employeeStatus }
				: null,
	};

	const posting = new PostingService(dbLike, repo as never, repo as never, repo as never, numbering);
	const resolver = new ArAccountResolverService(fixturePostingRules(repo as never));
	const service = new ExpenseClaimService(
		dbLike,
		repo as never,
		repo as never,
		repo as never,
		posting,
		resolver,
		numbering,
		employees,
	);

	return { service, posting, claims, claimItems, entries, journalLinesRows, accounts };
}

const line = (categoryCode: string, amount: number, taxAmount = 0) => ({
	expenseDate: '2026-01-05',
	categoryCode,
	description: null,
	amount,
	taxAmount,
});

async function draft(h: ReturnType<typeof makeHarness>, items = [line('5-1000', 100_000)]) {
	return h.service.create(ctx, {
		employeeId: 'emp-1',
		claimDate: '2026-01-10',
		notes: null,
		items,
	});
}

describe('expense claims (ERP-0013)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});

	test('create derives the total from the lines and keeps the claim a draft', async () => {
		const claim = await draft(h, [line('5-1000', 100_000), line('5-1100', 25_000, 2_750)]);
		expect(claim.status).toBe('draft');
		expect(claim.totalAmount).toBe(127_750);
		expect(claim.code).toContain('expense_claim-');
		expect(claim.items).toHaveLength(2);
		expect(h.entries.size).toBe(0);
	});

	test('approve posts DR expense / CR claims payable and is idempotent', async () => {
		const claim = await draft(h);
		await h.service.submit(ctx, claim.id);
		await h.service.approve(ctx, claim.id);

		expect(h.entries.size).toBe(1);
		const [entry] = [...h.entries.values()];
		expect(entry!.idempotencyKey).toBe(`expense_claim:${claim.id}`);
		expect(entry!.sourceType).toBe('expense_claim');
		const lines = h.journalLinesRows;
		expect(lines).toHaveLength(2);
		const expense = lines.find((l) => l.accountId === 'acc-exp')!;
		const payable = lines.find((l) => l.accountId === 'acc-claim')!;
		expect(expense.debit).toBe(100_000);
		expect(expense.credit).toBe(0);
		expect(payable.credit).toBe(100_000);
		expect(payable.debit).toBe(0);

		// Replaying the same posting payload returns the original entry.
		const replay = await h.posting.post({} as never, {
			organizationId: ORG,
			entryDate: '2026-01-10',
			sourceModule: 'finance',
			sourceType: 'expense_claim',
			sourceId: claim.id,
			idempotencyKey: `expense_claim:${claim.id}`,
			lines: [],
		});
		expect(replay.replayed).toBe(true);
		expect(h.entries.size).toBe(1);
	});

	test('input tax adds a third line and lines sharing an account are merged', async () => {
		const claim = await draft(h, [
			line('5-1000', 100_000, 11_000),
			line('5-1000', 50_000),
			line('5-1100', 20_000),
		]);
		await h.service.submit(ctx, claim.id);
		await h.service.approve(ctx, claim.id);

		const lines = h.journalLinesRows;
		expect(lines).toHaveLength(4);
		expect(lines.find((l) => l.accountId === 'acc-exp')!.debit).toBe(150_000);
		expect(lines.find((l) => l.accountId === 'acc-exp-2')!.debit).toBe(20_000);
		expect(lines.find((l) => l.accountId === 'acc-tax-in')!.debit).toBe(11_000);
		expect(lines.find((l) => l.accountId === 'acc-claim')!.credit).toBe(181_000);
		const debit = lines.reduce((s, l) => s + l.debit, 0);
		const credit = lines.reduce((s, l) => s + l.credit, 0);
		expect(debit).toBe(credit);
	});

	test('submit rejects a claim without lines', async () => {
		const claim = await draft(h);
		for (const row of h.claimItems) row.deletedAt = new Date();
		await expect(h.service.submit(ctx, claim.id)).rejects.toBeInstanceOf(ExpenseClaimEmptyError);
	});

	test('the state machine refuses illegal transitions', async () => {
		const claim = await draft(h);
		await expect(h.service.approve(ctx, claim.id)).rejects.toBeInstanceOf(ExpenseClaimTransitionError);
		await h.service.submit(ctx, claim.id);
		await h.service.approve(ctx, claim.id);
		await expect(h.service.cancel(ctx, claim.id)).rejects.toBeInstanceOf(ExpenseClaimTransitionError);
		await expect(h.service.reject(ctx, claim.id)).rejects.toBeInstanceOf(ExpenseClaimTransitionError);
	});

	test('a submitted claim can no longer be edited', async () => {
		const claim = await draft(h);
		await h.service.submit(ctx, claim.id);
		await expect(
			h.service.update(ctx, claim.id, { notes: 'late edit' }),
		).rejects.toBeInstanceOf(ExpenseClaimNotDraftError);
	});

	test('a rejected claim reopens as a draft when edited', async () => {
		const claim = await draft(h);
		await h.service.submit(ctx, claim.id);
		await h.service.reject(ctx, claim.id);
		const edited = await h.service.update(ctx, claim.id, { items: [line('5-1100', 75_000)] });
		expect(edited.status).toBe('draft');
		expect(edited.totalAmount).toBe(75_000);
		expect(edited.items).toHaveLength(1);
	});

	test('a terminated employee is refused at create time', async () => {
		const terminated = makeHarness('terminated');
		await expect(draft(terminated)).rejects.toBeInstanceOf(ExpenseClaimEmployeeError);
	});

	test('approve refuses a category that is not an active expense account', async () => {
		const claim = await draft(h, [line('4-1000', 10_000)]);
		await h.service.submit(ctx, claim.id);
		await expect(h.service.approve(ctx, claim.id)).rejects.toBeInstanceOf(ExpenseClaimAccountError);

		const inactive = await draft(h, [line('5-9999', 10_000)]);
		await h.service.submit(ctx, inactive.id);
		await expect(h.service.approve(ctx, inactive.id)).rejects.toBeInstanceOf(ExpenseClaimAccountError);
	});
});
