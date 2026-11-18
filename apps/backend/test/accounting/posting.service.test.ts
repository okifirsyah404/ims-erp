/**
 * PostingService unit tests (M09 F2, finance plan).
 *
 * The repository is a hand-written in-memory double; the posting rules are
 * what is under test: balanced-entry enforcement, one-side-per-line, COA
 * resolution (postable/active), period lock (closed/locked reject), the
 * status vocabulary, idempotent replay, and append-only reversal.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { CodeNumberService } from '@app/code-number';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { PostingService } from '../../src/app/accounting/services/posting.service';
import type {
	TAccountingPeriodSelect,
	TChartOfAccountSelect,
	TJournalEntrySelect,
	TJournalLineSelect,
} from '@drizzle/schemas/accounting.schema';
import {
	AccountInactiveError,
	AccountNotPostableError,
	AccountNotFoundError,
	JournalAlreadyReversedError,
	JournalLineSideError,
	JournalTransitionError,
	JournalUnbalancedError,
	PeriodLockedError,
	PeriodNotFoundError,
} from '../../src/app/accounting/errors/ledger.errors';

const ORG = 'org-1';

function account(
	overrides: Partial<TChartOfAccountSelect> = {},
): TChartOfAccountSelect {
	return {
		id: 'acc-cash',
		organizationId: ORG,
		code: '1-1100',
		name: 'Cash',
		accountType: 'asset',
		normalBalance: 'debit',
		parentAccountId: null,
		level: 1,
		isPostable: true,
		isSystem: false,
		isActive: true,
		cashFlowCategory: 'operating',
		description: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		...overrides,
	} as TChartOfAccountSelect;
}

function period(
	overrides: Partial<TAccountingPeriodSelect> = {},
): TAccountingPeriodSelect {
	return {
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
		...overrides,
	} as TAccountingPeriodSelect;
}

/** No-op transaction handle — the doubles are synchronous in-memory maps. */
const tx = {} as never;

function makeHarness() {
	const accounts = new Map<string, TChartOfAccountSelect>([
		['acc-cash', account()],
		['acc-rev', account({ id: 'acc-rev', code: '4-1000', name: 'Revenue', accountType: 'revenue', normalBalance: 'credit' })],
		['acc-ar', account({ id: 'acc-ar', code: '1-1200', name: 'AR' })],
		['acc-head', account({ id: 'acc-head', code: '9-0000', name: 'Header only', isPostable: false })],
		['acc-off', account({ id: 'acc-off', code: '1-9900', name: 'Closed account', isActive: false })],
	]);
	const periods = new Map<string, TAccountingPeriodSelect>([
		['per-2026-01', period()],
		['per-2026-02', period({ id: 'per-2026-02', code: '2026-02', periodMonth: 2, startDate: '2026-02-01', endDate: '2026-02-28' })],
		['per-2025-12', period({ id: 'per-2025-12', code: '2025-12', periodYear: 2025, periodMonth: 12, startDate: '2025-12-01', endDate: '2025-12-31', status: 'closed' })],
		['per-2025-11', period({ id: 'per-2025-11', code: '2025-11', periodYear: 2025, periodMonth: 11, startDate: '2025-11-01', endDate: '2025-11-30', status: 'locked' })],
	]);
	const entries = new Map<string, TJournalEntrySelect>();
	const lines: TJournalLineSelect[] = [];
	let entrySeq = 0;
	let lineSeq = 0;
	let allocSeq = 0;

	const repo = {
		findAccountById: async (_org: string, id: string) => accounts.get(id) ?? null,
		findAccountByCode: async (_org: string, code: string) =>
			[...accounts.values()].find((a) => a.code === code) ?? null,
		findAccountsByCodes: async (_org: string, codes: string[]) => {
			const map = new Map<string, TChartOfAccountSelect>();
			for (const a of accounts.values()) if (codes.includes(a.code)) map.set(a.code, a);
			return map;
		},
		findPeriodByMonth: async (_org: string, year: number, month: number) =>
			[...periods.values()].find(
				(p) => p.periodYear === year && p.periodMonth === month,
			) ?? null,
		findEntryById: async (_org: string, id: string) => entries.get(id) ?? null,
		findPostedEntryByIdempotencyKey: async (
			_org: string,
			key: string,
		) => [...entries.values()].find((e) => e.idempotencyKey === key) ?? null,
		findLinesByEntryId: async (_org: string, entryId: string) =>
			lines.filter((l) => l.journalEntryId === entryId),
		insertEntry: async (row: Record<string, unknown>) => {
			const created = {
				id: `je-${++entrySeq}`,
				organizationId: ORG,
				reversedByEntryId: null,
				preparedBy: null,
				submittedAt: null,
				approvedBy: null,
				approvedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
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
					createdAt: new Date(),
					updatedAt: new Date(),
					deletedAt: null,
					...row,
				} as TJournalLineSelect;
				lines.push(created);
				return created;
			}),
		markReversed: async (_org: string, entryId: string, reversedBy: string) => {
			const entry = entries.get(entryId);
			if (entry) {
				entry.status = 'reversed';
				entry.reversedByEntryId = reversedBy;
			}
		},
	};

	const numbering = {
		next: async (type: string) => `${type}-${String(++allocSeq).padStart(6, '0')}`,
	} as unknown as CodeNumberService;

	const service = new PostingService(
		{} as unknown as BunSQLDatabase, // unused by these rules; tx doubles cover I/O
		repo as never,
		repo as never,
		repo as never,
		numbering,
	);
	return { service, entries, lines };
}

/** A balanced two-line entry against resolved account ids. */
const balancedLines = [
	{ accountId: 'acc-ar', debit: 1_100_000, credit: 0 },
	{ accountId: 'acc-rev', debit: 0, credit: 1_100_000 },
];

describe('PostingService.post', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});

	test('posts a balanced entry with a JE code and posted status', async () => {
		const { entry, lines, replayed } = await h.service.post(tx, {
			organizationId: ORG,
			entryDate: '2026-01-15',
			sourceModule: 'sales',
			lines: balancedLines,
		});
		expect(replayed).toBe(false);
		expect(entry.status).toBe('posted');
		expect(entry.code).toMatch(/^journal_entry-\d{6}$/);
		expect(entry.totalDebit).toBe(1_100_000);
		expect(entry.totalCredit).toBe(1_100_000);
		expect(lines).toHaveLength(2);
	});

	test('rejects an unbalanced entry', async () => {
		await expect(
			h.service.post(tx, {
				organizationId: ORG,
				entryDate: '2026-01-15',
				sourceModule: 'sales',
				lines: [
					{ accountId: 'acc-ar', debit: 100, credit: 0 },
					{ accountId: 'acc-rev', debit: 0, credit: 90 },
				],
			}),
		).rejects.toThrow(JournalUnbalancedError);
	});

	test('rejects a line with both sides (or neither) positive', async () => {
		await expect(
			h.service.post(tx, {
				organizationId: ORG,
				entryDate: '2026-01-15',
				sourceModule: 'sales',
				lines: [
					{ accountId: 'acc-ar', debit: 100, credit: 100 },
					{ accountId: 'acc-rev', debit: 0, credit: 100 },
				],
			}),
		).rejects.toThrow(JournalLineSideError);
	});

	test('rejects an unknown account', async () => {
		await expect(
			h.service.post(tx, {
				organizationId: ORG,
				entryDate: '2026-01-15',
				sourceModule: 'sales',
				lines: [
					{ accountId: 'acc-nope', debit: 100, credit: 0 },
					{ accountId: 'acc-rev', debit: 0, credit: 100 },
				],
			}),
		).rejects.toThrow(AccountNotFoundError);
	});

	test('rejects a non-postable (header) account', async () => {
		await expect(
			h.service.post(tx, {
				organizationId: ORG,
				entryDate: '2026-01-15',
				sourceModule: 'sales',
				lines: [
					{ accountId: 'acc-head', debit: 100, credit: 0 },
					{ accountId: 'acc-rev', debit: 0, credit: 100 },
				],
			}),
		).rejects.toThrow(AccountNotPostableError);
	});

	test('rejects an inactive account', async () => {
		await expect(
			h.service.post(tx, {
				organizationId: ORG,
				entryDate: '2026-01-15',
				sourceModule: 'sales',
				lines: [
					{ accountId: 'acc-off', debit: 100, credit: 0 },
					{ accountId: 'acc-rev', debit: 0, credit: 100 },
				],
			}),
		).rejects.toThrow(AccountInactiveError);
	});

	test('resolves accountCode lines against the COA', async () => {
		const { lines } = await h.service.post(tx, {
			organizationId: ORG,
			entryDate: '2026-01-15',
			sourceModule: 'sales',
			lines: [
				{ accountCode: '1-1200', debit: 500, credit: 0 },
				{ accountCode: '4-1000', debit: 0, credit: 500 },
			],
		});
		expect(lines.every((l) => l.accountId.startsWith('acc-'))).toBe(true);
	});

	test('rejects posting into a closed period', async () => {
		await expect(
			h.service.post(tx, {
				organizationId: ORG,
				entryDate: '2025-12-15',
				sourceModule: 'sales',
				lines: balancedLines,
			}),
		).rejects.toThrow(PeriodLockedError);
	});

	test('rejects posting into a locked period', async () => {
		await expect(
			h.service.post(tx, {
				organizationId: ORG,
				entryDate: '2025-11-20',
				sourceModule: 'sales',
				lines: balancedLines,
			}),
		).rejects.toThrow(PeriodLockedError);
	});

	test('rejects posting into a month with no period', async () => {
		await expect(
			h.service.post(tx, {
				organizationId: ORG,
				entryDate: '2030-07-15',
				sourceModule: 'sales',
				lines: balancedLines,
			}),
		).rejects.toThrow(PeriodNotFoundError);
	});

	test('rejects an unknown source module (posting service guard)', async () => {
		await expect(
			h.service.post(tx, {
				organizationId: ORG,
				entryDate: '2026-01-15',
				sourceModule: 'not-a-module',
				lines: balancedLines,
			}),
		).rejects.toThrow(JournalTransitionError);
	});

	test('replays the original entry for a repeated idempotency key', async () => {
		const first = await h.service.post(tx, {
			organizationId: ORG,
			entryDate: '2026-01-15',
			sourceModule: 'sales',
			idempotencyKey: 'sales-inv-42',
			lines: balancedLines,
		});
		const second = await h.service.post(tx, {
			organizationId: ORG,
			entryDate: '2026-01-20',
			sourceModule: 'sales',
			idempotencyKey: 'sales-inv-42',
			lines: balancedLines,
		});
		expect(first.replayed).toBe(false);
		expect(second.replayed).toBe(true);
		expect(second.entry.id).toBe(first.entry.id);
		expect(h.entries.size).toBe(1);
	});
});

describe('PostingService.reverse', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});

	test('writes a mirrored entry and marks the original reversed', async () => {
		const posted = await h.service.post(tx, {
			organizationId: ORG,
			entryDate: '2026-01-15',
			sourceModule: 'sales',
			lines: balancedLines,
		});
		const reversal = await h.service.reverse(
			tx,
			ORG,
			posted.entry.id,
			'user-1',
		);
		expect(reversal.entry.status).toBe('posted');
		expect(reversal.entry.sourceType).toBe('journal_reversal');
		expect(reversal.entry.idempotencyKey).toBe(`reversal:${posted.entry.id}`);
		// sides swapped
		expect(reversal.lines[0].debit).toBe(0);
		expect(reversal.lines[0].credit).toBe(1_100_000);

		const original = h.entries.get(posted.entry.id)!;
		expect(original.status).toBe('reversed');
		expect(original.reversedByEntryId).toBe(reversal.entry.id);
	});

	test('refuses a second reversal (once-only, append-only)', async () => {
		const posted = await h.service.post(tx, {
			organizationId: ORG,
			entryDate: '2026-01-15',
			sourceModule: 'sales',
			lines: balancedLines,
		});
		await h.service.reverse(tx, ORG, posted.entry.id, 'user-1');
		await expect(
			h.service.reverse(tx, ORG, posted.entry.id, 'user-1'),
		).rejects.toThrow(JournalAlreadyReversedError);
	});

	test('refuses to reverse a draft entry', async () => {
		await expect(
			h.service.reverse(tx, ORG, 'je-nope', 'user-1'),
		).rejects.toThrow(JournalTransitionError);
	});
});
