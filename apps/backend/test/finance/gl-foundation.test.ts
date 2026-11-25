/**
 * GL foundation (ERP-0127..ERP-0133, ADR-0030) unit tests.
 *
 * In-memory doubles stand in for the repositories; under test are the
 * rules: posting-rule specificity and business-event posting, soft/hard
 * period close, reversal dating, maker-checker on manual journals,
 * chart-of-account locking, the period lock gate, cost-centre validation and
 * the trial-balance / general-ledger arithmetic.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type {
	TAccountingPeriodSelect,
	TChartOfAccountSelect,
	TCostCenterSelect,
	TJournalEntrySelect,
	TJournalLineSelect,
	TPostingRuleSelect,
} from '@drizzle/schemas/finance.schema';
import { PostingService } from '../../src/app/finance/services/posting.service';
import { pickPostingRule, PostingRuleService } from '../../src/app/finance/services/posting-rule.service';
import { ManualJournalService } from '../../src/app/finance/services/manual-journal.service';
import { AccountService } from '../../src/app/finance/services/account.service';
import { PeriodService } from '../../src/app/finance/services/period.service';
import { ReportService } from '../../src/app/finance/services/report.service';
import {
	AccountBalanceNotZeroError,
	AccountInUseError,
	AccountLockedError,
	CostCenterInactiveError,
	CostCenterNotFoundError,
	JournalSelfApprovalError,
	JournalTransitionError,
	NoOpenPeriodForReversalError,
	PeriodLockBlockedError,
	PeriodLockedError,
	PostingRuleNotFoundError,
} from '../../src/app/finance/errors/ledger.errors';

const ORG = 'org-1';
const tx = {} as never;

function account(overrides: Partial<TChartOfAccountSelect> = {}): TChartOfAccountSelect {
	return {
		id: 'acc-cash',
		organizationId: ORG,
		code: '1-1110',
		name: 'Kas',
		accountType: 'asset',
		normalBalance: 'debit',
		parentAccountId: null,
		level: 3,
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

function period(overrides: Partial<TAccountingPeriodSelect>): TAccountingPeriodSelect {
	return {
		id: 'per',
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

function rule(overrides: Partial<TPostingRuleSelect>): TPostingRuleSelect {
	return {
		id: `rule-${Math.random()}`,
		organizationId: ORG,
		eventType: '*',
		role: 'revenue',
		discriminatorType: '',
		discriminatorValue: '',
		accountId: 'acc-rev',
		isActive: true,
		description: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		...overrides,
	} as TPostingRuleSelect;
}

function makeHarness() {
	const accounts = new Map<string, TChartOfAccountSelect>([
		['acc-cash', account()],
		['acc-ar', account({ id: 'acc-ar', code: '1-1310', name: 'Piutang Usaha' })],
		['acc-rev', account({ id: 'acc-rev', code: '4-1100', name: 'Penjualan Perangkat', accountType: 'revenue', normalBalance: 'credit' })],
		['acc-rev-sw', account({ id: 'acc-rev-sw', code: '4-1200', name: 'Pendapatan Lisensi', accountType: 'revenue', normalBalance: 'credit' })],
		['acc-vat', account({ id: 'acc-vat', code: '2-1410', name: 'PPN Keluaran', accountType: 'liability', normalBalance: 'credit' })],
	]);
	const periods = new Map<string, TAccountingPeriodSelect>([
		['per-2026-01', period({ id: 'per-2026-01' })],
		['per-2026-02', period({ id: 'per-2026-02', code: '2026-02', periodMonth: 2, startDate: '2026-02-01', endDate: '2026-02-28' })],
		['per-2025-12', period({ id: 'per-2025-12', code: '2025-12', periodYear: 2025, periodMonth: 12, startDate: '2025-12-01', endDate: '2025-12-31', status: 'closed' })],
		['per-2025-11', period({ id: 'per-2025-11', code: '2025-11', periodYear: 2025, periodMonth: 11, startDate: '2025-11-01', endDate: '2025-11-30', status: 'locked' })],
	]);
	const costCenters = new Map<string, TCostCenterSelect>([
		['cc-ops', { id: 'cc-ops', organizationId: ORG, code: 'OPS', name: 'Operasional', parentCostCenterId: null, isActive: true, description: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null }],
		['cc-old', { id: 'cc-old', organizationId: ORG, code: 'OLD', name: 'Lama', parentCostCenterId: null, isActive: false, description: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null }],
	]);
	const rules: TPostingRuleSelect[] = [
		rule({ role: 'receivable', accountId: 'acc-ar' }),
		rule({ role: 'revenue', accountId: 'acc-rev' }),
		rule({ role: 'revenue', discriminatorType: 'product_category', discriminatorValue: 'software', accountId: 'acc-rev-sw' }),
		rule({ role: 'vat_output', accountId: 'acc-vat' }),
	];
	const entries = new Map<string, TJournalEntrySelect>();
	const lines: TJournalLineSelect[] = [];
	const audits: Array<{ action: string; targetId: string; meta?: Record<string, unknown> }> = [];
	let entrySeq = 0;
	let lineSeq = 0;
	let codeSeq = 0;

	const repo = {
		findAccountById: async (_o: string, id: string) => accounts.get(id) ?? null,
		findAccountByCode: async (_o: string, code: string) => [...accounts.values()].find((a) => a.code === code) ?? null,
		findAccountsByCodes: async () => new Map(),
		listAccountsMap: async () => new Map(accounts),
		findPeriodByMonth: async (_o: string, y: number, m: number) =>
			[...periods.values()].find((p) => p.periodYear === y && p.periodMonth === m) ?? null,
		findPeriodById: async (_o: string, id: string) => periods.get(id) ?? null,
		findFirstOpenPeriodFrom: async (_o: string, date: string) =>
			[...periods.values()]
				.filter((p) => p.status === 'open' && p.endDate >= date)
				.sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null,
		updatePeriodStatus: async (_o: string, id: string, patch: Partial<TAccountingPeriodSelect>) => {
			const p = periods.get(id)!;
			Object.assign(p, patch);
			return p;
		},
		findEntryById: async (_o: string, id: string) => entries.get(id) ?? null,
		findPostedEntryByIdempotencyKey: async (_o: string, key: string) =>
			[...entries.values()].find((e) => e.idempotencyKey === key) ?? null,
		findLinesByEntryId: async (_o: string, entryId: string) =>
			lines.filter((l) => l.journalEntryId === entryId && !l.deletedAt),
		insertEntry: async (row: Record<string, unknown>) => {
			const created = {
				id: `je-${++entrySeq}`,
				reversedByEntryId: null,
				reversesEntryId: null,
				eventType: null,
				isAdjusting: false,
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
		insertLines: async (rows: Array<Record<string, unknown>>) =>
			rows.map((row) => {
				const created = { id: `jl-${++lineSeq}`, createdAt: new Date(), updatedAt: new Date(), deletedAt: null, ...row } as TJournalLineSelect;
				lines.push(created);
				return created;
			}),
		updateEntry: async (_o: string, id: string, patch: Partial<TJournalEntrySelect>) => {
			const entry = entries.get(id);
			if (!entry) return null;
			Object.assign(entry, patch);
			return entry;
		},
		softDeleteLines: async (_o: string, entryId: string) => {
			for (const l of lines) if (l.journalEntryId === entryId) l.deletedAt = new Date();
		},
		markReversed: async (_o: string, id: string, by: string) => {
			const entry = entries.get(id)!;
			entry.status = 'reversed';
			entry.reversedByEntryId = by;
		},
		countUnpostedInPeriod: async (_o: string, periodId: string) =>
			[...entries.values()].filter(
				(e) => e.accountingPeriodId === periodId && ['draft', 'submitted', 'approved'].includes(e.status),
			).length,
		accountTotalsForPeriod: async () => [],
	};
	const costCenterRepo = { findById: async (_o: string, id: string) => costCenters.get(id) ?? null };
	const ruleRepo = {
		findCandidates: async (_o: string, role: string, eventType: string) =>
			rules.filter((r) => r.role === role && (r.eventType === eventType || r.eventType === '*') && r.isActive),
		isAccountReferenced: async (_o: string, accountId: string) => rules.some((r) => r.accountId === accountId && r.isActive),
	};
	const audit = {
		record: async (input: { action: string; targetId: string; meta?: Record<string, unknown> }) => {
			audits.push(input);
		},
	};
	const numbering = { next: async () => `JE-${String(++codeSeq).padStart(5, '0')}` } as never;
	const ruleService = new PostingRuleService(ruleRepo as never, repo as never, audit as never);
	const posting = new PostingService(
		{} as unknown as BunSQLDatabase,
		repo as never,
		repo as never,
		repo as never,
		numbering,
		costCenterRepo as never,
		ruleService,
	);
	const runner = { run: <T>(work: (t: never) => Promise<T>) => work(tx) };
	const manual = new ManualJournalService(runner as never, repo as never, posting, audit as never);
	return { posting, manual, ruleService, repo, entries, lines, periods, rules, audits, accounts };
}

describe('pickPostingRule (ERP-0128)', () => {
	const rules = [
		rule({ id: 'any', eventType: '*' }),
		rule({ id: 'any-disc', eventType: '*', discriminatorType: 'product_category', discriminatorValue: 'sw' }),
		rule({ id: 'event', eventType: 'sale.invoice_issued' }),
		rule({ id: 'event-disc', eventType: 'sale.invoice_issued', discriminatorType: 'product_category', discriminatorValue: 'sw' }),
		rule({ id: 'other-disc', eventType: 'sale.invoice_issued', discriminatorType: 'product_category', discriminatorValue: 'hw' }),
	];

	test('event + discriminator beats everything', () => {
		const picked = pickPostingRule(rules, {
			eventType: 'sale.invoice_issued',
			role: 'revenue',
			discriminatorType: 'product_category',
			discriminatorValue: 'sw',
		});
		expect(picked?.id).toBe('event-disc');
	});

	test('falls back to event, then any-event + discriminator, then any-event', () => {
		expect(pickPostingRule(rules, { eventType: 'sale.invoice_issued', role: 'revenue' })?.id).toBe('event');
		expect(
			pickPostingRule(rules.filter((r) => !r.id.startsWith('event')), {
				eventType: 'sale.invoice_issued',
				role: 'revenue',
				discriminatorType: 'product_category',
				discriminatorValue: 'sw',
			})?.id,
		).toBe('any-disc');
		expect(pickPostingRule([rules[0]], { eventType: 'x.y', role: 'revenue' })?.id).toBe('any');
	});

	test('a rule for another discriminator value never matches', () => {
		expect(pickPostingRule([rules[4]], { eventType: 'sale.invoice_issued', role: 'revenue' })).toBeNull();
	});
});

describe('PostingService.postBusinessEvent (ERP-0128)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});

	test('resolves each role through the rules and records the event type', async () => {
		const { entry, lines } = await h.posting.postBusinessEvent(tx, {
			organizationId: ORG,
			entryDate: '2026-01-10',
			sourceModule: 'sale',
			eventType: 'sale.invoice_issued',
			idempotencyKey: 'invoice:1',
			lines: [
				{ role: 'receivable', debit: 1_332_000, credit: 0 },
				{ role: 'revenue', debit: 0, credit: 1_000_000 },
				{ role: 'revenue', discriminatorType: 'product_category', discriminatorValue: 'software', debit: 0, credit: 200_000 },
				{ role: 'vat_output', debit: 0, credit: 132_000 },
			],
		});
		expect(entry.eventType).toBe('sale.invoice_issued');
		expect(lines.map((l) => l.accountId)).toEqual(['acc-ar', 'acc-rev', 'acc-rev-sw', 'acc-vat']);
		expect(entry.totalDebit).toBe(entry.totalCredit);
	});

	test('a role without an active rule fails the posting', async () => {
		await expect(
			h.posting.postBusinessEvent(tx, {
				organizationId: ORG,
				entryDate: '2026-01-10',
				sourceModule: 'sale',
				eventType: 'sale.invoice_issued',
				lines: [
					{ role: 'receivable', debit: 100, credit: 0 },
					{ role: 'deferred_revenue', debit: 0, credit: 100 },
				],
			}),
		).rejects.toThrow(PostingRuleNotFoundError);
		expect(h.entries.size).toBe(0);
	});
});

describe('period rules and cost centres (ERP-0127, ERP-0130)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});
	const lines = [
		{ accountId: 'acc-cash', debit: 500, credit: 0 },
		{ accountId: 'acc-rev', debit: 0, credit: 500 },
	];

	test('a soft-closed period refuses system postings but accepts finance adjusting entries', async () => {
		await expect(
			h.posting.post(tx, { organizationId: ORG, entryDate: '2025-12-20', sourceModule: 'sale', lines }),
		).rejects.toThrow(PeriodLockedError);
		await expect(
			h.posting.post(tx, { organizationId: ORG, entryDate: '2025-12-20', sourceModule: 'sale', isAdjusting: true, lines }),
		).rejects.toThrow(PeriodLockedError);
		const { entry } = await h.posting.post(tx, {
			organizationId: ORG,
			entryDate: '2025-12-20',
			sourceModule: 'finance',
			isAdjusting: true,
			lines,
		});
		expect(entry.isAdjusting).toBe(true);
	});

	test('a locked period refuses even adjusting entries', async () => {
		await expect(
			h.posting.post(tx, { organizationId: ORG, entryDate: '2025-11-20', sourceModule: 'finance', isAdjusting: true, lines }),
		).rejects.toThrow(PeriodLockedError);
	});

	test('unknown and inactive cost centres are refused', async () => {
		await expect(
			h.posting.post(tx, {
				organizationId: ORG,
				entryDate: '2026-01-05',
				sourceModule: 'finance',
				lines: [{ ...lines[0], costCenterId: 'cc-missing' }, lines[1]],
			}),
		).rejects.toThrow(CostCenterNotFoundError);
		await expect(
			h.posting.post(tx, {
				organizationId: ORG,
				entryDate: '2026-01-05',
				sourceModule: 'finance',
				lines: [{ ...lines[0], costCenterId: 'cc-old' }, lines[1]],
			}),
		).rejects.toThrow(CostCenterInactiveError);
		const { lines: posted } = await h.posting.post(tx, {
			organizationId: ORG,
			entryDate: '2026-01-05',
			sourceModule: 'finance',
			lines: [{ ...lines[0], costCenterId: 'cc-ops' }, lines[1]],
		});
		expect(posted[0].costCenterId).toBe('cc-ops');
	});
});

describe('reversal dating (ERP-0129, grill Q54)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});
	const lines = [
		{ accountId: 'acc-cash', debit: 700, credit: 0 },
		{ accountId: 'acc-rev', debit: 0, credit: 700 },
	];

	test('open original period: the reversal keeps the original date and links back', async () => {
		const { entry } = await h.posting.post(tx, { organizationId: ORG, entryDate: '2026-01-12', sourceModule: 'sale', lines });
		const reversal = await h.posting.reverse(tx, ORG, entry.id, 'user-a', { description: 'salah input' });
		expect(reversal.entry.entryDate).toBe('2026-01-12');
		expect(reversal.entry.reversesEntryId).toBe(entry.id);
		expect(reversal.entry.description).toBe('salah input');
		expect(h.entries.get(entry.id)?.status).toBe('reversed');
	});

	test('closed original period: the reversal lands on the first day of the next open period', async () => {
		const { entry } = await h.posting.post(tx, { organizationId: ORG, entryDate: '2026-01-12', sourceModule: 'sale', lines });
		h.periods.get('per-2026-01')!.status = 'closed';
		const reversal = await h.posting.reverse(tx, ORG, entry.id, 'user-a', {});
		expect(reversal.entry.entryDate).toBe('2026-02-01');
		expect(reversal.entry.accountingPeriodId).toBe('per-2026-02');
	});

	test('no open period after the original refuses the reversal', async () => {
		const { entry } = await h.posting.post(tx, { organizationId: ORG, entryDate: '2026-02-03', sourceModule: 'sale', lines });
		h.periods.get('per-2026-01')!.status = 'locked';
		h.periods.get('per-2026-02')!.status = 'closed';
		await expect(h.posting.reverse(tx, ORG, entry.id, 'user-a', {})).rejects.toThrow(NoOpenPeriodForReversalError);
	});
});

describe('manual journals with maker-checker (ERP-0129)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});
	const input = {
		entryDate: '2026-01-20',
		description: 'Koreksi pendapatan',
		isAdjusting: false,
		lines: [
			{ accountId: 'acc-cash', debit: 250_000, credit: 0 },
			{ accountId: 'acc-rev', debit: 0, credit: 250_000 },
		],
	};

	test('draft -> submitted -> approved posts with a number; drafts have none', async () => {
		const maker = { organizationId: ORG, actorUserId: 'maker' };
		const checker = { organizationId: ORG, actorUserId: 'checker' };
		const draft = await h.manual.createDraft(maker, input);
		expect(draft.status).toBe('draft');
		expect(draft.code).toBeNull();
		expect(draft.preparedBy).toBe('maker');

		await h.manual.submit(maker, draft.id);
		await expect(h.manual.approve(maker, draft.id)).rejects.toThrow(JournalSelfApprovalError);

		const posted = await h.manual.approve(checker, draft.id);
		expect(posted.status).toBe('posted');
		expect(posted.code).toBe('JE-00001');
		expect(posted.approvedBy).toBe('checker');
		expect(h.audits.map((a) => a.action)).toEqual(['journal.drafted', 'journal.submitted', 'journal.approved']);
	});

	test('reject returns to draft, edits replace the lines, void discards', async () => {
		const maker = { organizationId: ORG, actorUserId: 'maker' };
		const draft = await h.manual.createDraft(maker, input);
		await h.manual.submit(maker, draft.id);
		const rejected = await h.manual.reject({ organizationId: ORG, actorUserId: 'checker' }, draft.id, 'akun salah');
		expect(rejected.status).toBe('draft');

		const edited = await h.manual.updateDraft(maker, draft.id, {
			...input,
			lines: [
				{ accountId: 'acc-ar', debit: 90_000, credit: 0 },
				{ accountId: 'acc-rev', debit: 0, credit: 90_000 },
			],
		});
		expect(edited.lines.map((l) => l.accountId)).toEqual(['acc-ar', 'acc-rev']);
		expect(h.lines.filter((l) => l.journalEntryId === draft.id && !l.deletedAt)).toHaveLength(2);

		const voided = await h.manual.void(maker, draft.id);
		expect(voided.status).toBe('void');
		await expect(h.manual.submit(maker, draft.id)).rejects.toThrow(JournalTransitionError);
	});

	test('a draft cannot be approved without being submitted', async () => {
		const draft = await h.manual.createDraft({ organizationId: ORG, actorUserId: 'maker' }, input);
		await expect(h.manual.approve({ organizationId: ORG, actorUserId: 'checker' }, draft.id)).rejects.toThrow(
			JournalTransitionError,
		);
	});
});

describe('chart-of-account locking (ERP-0127, grill Q55)', () => {
	function accountsHarness(opts: { hasLines: boolean; balance: number; referenced: boolean; isSystem?: boolean }) {
		const row = account({ id: 'acc-x', isSystem: opts.isSystem ?? false });
		const repo = {
			findAccountById: async () => row,
			accountHasJournalLines: async () => opts.hasLines,
			accountNetBalance: async () => opts.balance,
			updateAccount: async (_o: string, _id: string, patch: Partial<TChartOfAccountSelect>) => ({ ...row, ...patch }),
		};
		const rules = { isAccountReferenced: async () => opts.referenced };
		return new AccountService(repo as never, rules, undefined);
	}

	test('the postable flag freezes once the account has postings', async () => {
		await expect(
			accountsHarness({ hasLines: true, balance: 0, referenced: false }).updateAccount(ORG, 'acc-x', { isPostable: false }),
		).rejects.toThrow(AccountLockedError);
		const ok = await accountsHarness({ hasLines: false, balance: 0, referenced: false }).updateAccount(ORG, 'acc-x', {
			isPostable: false,
		});
		expect(ok.isPostable).toBe(false);
	});

	test('deactivation needs a zero balance, no active rule and a non-system account', async () => {
		await expect(
			accountsHarness({ hasLines: true, balance: 10, referenced: false }).archiveAccount(ORG, 'acc-x'),
		).rejects.toThrow(AccountBalanceNotZeroError);
		await expect(
			accountsHarness({ hasLines: true, balance: 0, referenced: true }).archiveAccount(ORG, 'acc-x'),
		).rejects.toThrow(AccountInUseError);
		await expect(
			accountsHarness({ hasLines: false, balance: 0, referenced: false, isSystem: true }).archiveAccount(ORG, 'acc-x'),
		).rejects.toThrow(AccountInUseError);
		const archived = await accountsHarness({ hasLines: true, balance: 0, referenced: false }).archiveAccount(ORG, 'acc-x');
		expect(archived.isActive).toBe(false);
		expect(archived.isPostable).toBe(true);
	});
});

describe('period lock gate (ERP-0130)', () => {
	test('locking is refused while manual journals are unposted, and audited when it succeeds', async () => {
		const h = makeHarness();
		h.periods.get('per-2026-01')!.status = 'closed';
		const service = new PeriodService(h.repo as never, h.repo as never, { upsertAccountBalance: async () => {} } as never, {
			record: async (input: { action: string; targetId: string }) => {
				h.audits.push(input);
			},
		} as never);
		await h.manual.createDraft({ organizationId: ORG, actorUserId: 'maker' }, {
			entryDate: '2026-01-25',
			description: null,
			isAdjusting: true,
			lines: [
				{ accountId: 'acc-cash', debit: 1, credit: 0 },
				{ accountId: 'acc-rev', debit: 0, credit: 1 },
			],
		});
		await expect(
			service.transition(ORG, 'per-2026-01', 'locked', { organizationId: ORG, actorUserId: 'acc' }),
		).rejects.toThrow(PeriodLockBlockedError);

		for (const entry of h.entries.values()) entry.status = 'void';
		const locked = await service.transition(ORG, 'per-2026-01', 'locked', { organizationId: ORG, actorUserId: 'acc' });
		expect(locked.status).toBe('locked');
		expect(h.audits[h.audits.length - 1]?.action).toBe('accounting_period.locked');
	});
});

describe('trial balance and general ledger (ERP-0133)', () => {
	const accounts = new Map<string, TChartOfAccountSelect>([
		['acc-cash', account()],
		['acc-rev', account({ id: 'acc-rev', code: '4-1100', accountType: 'revenue', normalBalance: 'credit' })],
		['acc-cap', account({ id: 'acc-cap', code: '3-1000', accountType: 'equity', normalBalance: 'credit' })],
	]);
	const journal = {
		accountTotalsBefore: async () => [
			{ accountId: 'acc-cash', debit: 1_000, credit: 0 },
			{ accountId: 'acc-cap', debit: 0, credit: 1_000 },
		],
		listAccountActivity: async () => [
			{ accountId: 'acc-cash', debit: 500, credit: 200 },
			{ accountId: 'acc-rev', debit: 200, credit: 500 },
		],
		listLedgerLines: async () => [
			{ lineId: 'l1', entryId: 'e1', entryCode: 'JE-1', entryDate: '2026-01-02', sourceModule: 'sale', sourceType: null, entryDescription: 'Penjualan', lineDescription: null, debit: 500, credit: 0, costCenterId: null, projectId: null },
			{ lineId: 'l2', entryId: 'e2', entryCode: 'JE-2', entryDate: '2026-01-03', sourceModule: 'sale', sourceType: 'journal_reversal', entryDescription: 'Pembalik', lineDescription: null, debit: 0, credit: 200, costCenterId: null, projectId: null },
		],
	};
	const accountRepo = {
		listAccountsMap: async () => accounts,
		findAccountById: async (_o: string, id: string) => accounts.get(id) ?? null,
	};
	const reports = new ReportService(journal as never, accountRepo as never);

	test('opening + movement = closing, and the columns tie', async () => {
		const tb = await reports.trialBalance({ organizationId: ORG }, '2026-01-01', '2026-01-31');
		const cash = tb.rows.find((r) => r.accountId === 'acc-cash')!;
		expect(cash).toMatchObject({ openingDebit: 1_000, periodDebit: 500, periodCredit: 200, closingDebit: 1_300 });
		const rev = tb.rows.find((r) => r.accountId === 'acc-rev')!;
		expect(rev).toMatchObject({ closingCredit: 300, closingDebit: 0 });
		expect(tb.totals.closingDebit).toBe(1_300);
		expect(tb.totals.closingCredit).toBe(1_300);
		expect(tb.balanced).toBe(true);
		expect(tb.rows.map((r) => r.code)).toEqual(['1-1110', '3-1000', '4-1100']);
	});

	test('the general ledger carries a running balance from the opening', async () => {
		const gl = await reports.generalLedger({ organizationId: ORG }, 'acc-cash', '2026-01-01', '2026-01-31');
		expect(gl.openingBalance).toBe(1_000);
		expect(gl.lines.map((l) => l.balance)).toEqual([1_500, 1_300]);
		expect(gl.closingBalance).toBe(1_300);
		expect(gl.totalDebit).toBe(500);
		expect(gl.totalCredit).toBe(200);
	});
});
