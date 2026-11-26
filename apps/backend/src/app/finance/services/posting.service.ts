import type { TTx } from '@drizzle/types';
import {
	JOURNAL_SOURCE_MODULES,
	type TJournalEntrySelect,
	type TJournalLineSelect,
} from '@drizzle/schemas/finance.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { DRIZZLE_TOKEN } from '@di/provider';
import { FINANCE_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { FinanceNumberingService } from './finance-numbering.service';
import {
	CHART_OF_ACCOUNT_REPOSITORY_TOKEN,
	JOURNAL_REPOSITORY_TOKEN,
	ACCOUNTING_PERIOD_REPOSITORY_TOKEN,
	COST_CENTER_REPOSITORY_TOKEN,
	POSTING_RULE_SERVICE_TOKEN,
} from '../constants/di';
import type { ICostCenterRepository } from '../contracts/cost-center.repository.interface';
import type { PostingRuleService } from './posting-rule.service';
import type { TAccountingPeriodSelect } from '@drizzle/schemas/finance.schema';
import {
	AccountInactiveError,
	CostCenterInactiveError,
	CostCenterNotFoundError,
	NoOpenPeriodForReversalError,
	AccountNotPostableError,
	AccountNotFoundError,
	JournalAlreadyReversedError,
	JournalLineSideError,
	JournalTransitionError,
	JournalUnbalancedError,
	PeriodLockedError,
	PeriodNotFoundError,
	ReversalPeriodLockedError,
} from '../errors/ledger.errors';
import type { IAccountingPeriodRepository } from '../contracts/accounting-period.repository.interface';
import type { IChartOfAccountRepository } from '../contracts/chart-of-account.repository.interface';
import type {
	IJournalRepository,
	TJournalEntryPaginationRequest,
} from '../contracts/journal.repository.interface';
import type { TChartOfAccountSelect } from '@drizzle/schemas/finance.schema';

/**
 * One journal line as accepted by the posting service.
 *
 * @remarks
 * Either `accountId` (already resolved) or `accountCode` (resolved here
 * against the chart of accounts) is required.
 */
export type TPostingLine = {
	accountId?: string;
	accountCode?: string;
	debit: number;
	credit: number;
	description?: string | null;
	costCenterId?: string | null;
	projectId?: string | null;
	partyType?: string | null;
	partyId?: string | null;
	/** Logical reference to product.products.id, validated by the caller. */
	productId?: string | null;
};

export type TPostingInput = {
	organizationId: string;
	/** Business date, `YYYY-MM-DD`. Selects the accounting period. */
	entryDate: string;
	/** Producing module; must be a member of `JOURNAL_SOURCE_MODULES`. */
	sourceModule: string;
	sourceType?: string | null;
	sourceId?: string | null;
	/** Client-supplied idempotency key; replayed posts return the original. */
	idempotencyKey?: string | null;
	description?: string | null;
	lines: TPostingLine[];
	/** Business event behind the entry (set by {@link PostingService.postBusinessEvent}). */
	eventType?: string | null;
	/** Manual adjusting entry: allowed into a soft-closed period (finance only). */
	isAdjusting?: boolean;
	/** On a reversal, the original entry. */
	reversesEntryId?: string | null;
	/** Actor stamped as preparer and poster (manual paths). */
	actorUserId?: string | null;
};

/**
 * One line of a business-event posting: a semantic role instead of an
 * account. Finance resolves the account through `finance.posting_rules`.
 */
export type TBusinessEventLine = Omit<TPostingLine, 'accountId' | 'accountCode'> & {
	role: string;
	discriminatorType?: string | null;
	discriminatorValue?: string | null;
};

export type TBusinessEventInput = Omit<TPostingInput, 'lines' | 'eventType'> & {
	/** e.g. `sale.invoice_issued`; rules for `'*'` act as defaults. */
	eventType: string;
	lines: TBusinessEventLine[];
};

export type TPostingResult = {
	entry: TJournalEntrySelect;
	lines: TJournalLineSelect[];
	/** True when an identical posted entry already existed (idempotent replay). */
	replayed: boolean;
};

/**
 * THE single ledger entry point (M09 F2, finance plan D9/D1).
 *
 * @remarks
 * Every journal row in the ERP is written through this service — other
 * modules never touch `journal_entries`/`journal_lines` directly. The caller
 * owns the transaction (D9): `post(tx, input)` receives the caller's handle,
 * validates balance/period/idempotency, and writes header + lines inside it,
 * so the business document and its journal commit or roll back as one unit.
 *
 * Enforced rules:
 * - the caller's `sourceModule` is a known module (posting service guard);
 * - every line resolves to an active, postable account;
 * - exactly one side per line is positive, and the entry balances;
 * - the entry date's period exists and is `open` (closed/locked reject);
 * - a posted entry with the same idempotency key short-circuits to a replay.
 *
 * Posted entries are corrected only by {@link reverse} — an append-only
 * mirrored entry, never an edit (D4 ledger-first, DBML note).
 */
@injectable()
export class PostingService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
				@inject(CHART_OF_ACCOUNT_REPOSITORY_TOKEN) private readonly accounts: IChartOfAccountRepository,
		@inject(JOURNAL_REPOSITORY_TOKEN) private readonly journal: IJournalRepository,
		@inject(ACCOUNTING_PERIOD_REPOSITORY_TOKEN) private readonly periods: IAccountingPeriodRepository,
		@inject(FINANCE_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: FinanceNumberingService,
		@inject(COST_CENTER_REPOSITORY_TOKEN)
		private readonly costCenters?: Pick<ICostCenterRepository, 'findById'>,
		@inject(POSTING_RULE_SERVICE_TOKEN)
		private readonly rules?: Pick<PostingRuleService, 'resolveAccountId'>,
	) {}

	/**
	 * Posts a business event (ERP-0128, ADR-0030): THE contract for source
	 * modules. Each line names a role; the account comes from the most
	 * specific active posting rule. A missing rule throws
	 * `PostingRuleNotFoundError`, which rolls back the caller's transaction.
	 */
	async postBusinessEvent(tx: TTx, input: TBusinessEventInput): Promise<TPostingResult> {
		if (!this.rules) throw new JournalTransitionError();
		const lines: TPostingLine[] = [];
		for (const line of input.lines) {
			const { role, discriminatorType, discriminatorValue, ...rest } = line;
			const accountId = await this.rules.resolveAccountId(
				input.organizationId,
				{ eventType: input.eventType, role, discriminatorType, discriminatorValue },
				tx,
			);
			lines.push({ ...rest, accountId });
		}
		return this.post(tx, { ...input, lines });
	}

	/**
	 * Posts a balanced journal entry inside the caller's transaction.
	 *
	 * @param tx - The caller's transaction handle (D9): the business document
	 *   being posted commits together with its journal.
	 * @param input - Entry header + lines; `accountCode` lines are resolved
	 *   against the chart of accounts inside `tx`.
	 * @returns The posted entry with its lines, or the original entry on a
	 *   idempotent replay (`replayed: true`).
	 */
	async post(tx: TTx, input: TPostingInput): Promise<TPostingResult> {
		if (
			!JOURNAL_SOURCE_MODULES.includes(
				input.sourceModule as (typeof JOURNAL_SOURCE_MODULES)[number],
			)
		) {
			throw new JournalTransitionError();
		}

		// Idempotency: an identical already-posted entry short-circuits. The
		// partial unique index is the backstop if two callers race.
		if (input.idempotencyKey) {
			const existing = await this.journal.findPostedEntryByIdempotencyKey(
				input.organizationId,
				input.idempotencyKey,
				tx,
			);
			if (existing) {
				const lines = await this.journal.findLinesByEntryId(
					input.organizationId,
					existing.id,
					tx,
				);
				return { entry: existing, lines, replayed: true };
			}
		}

		const period = await this.findPostablePeriod(
			input.organizationId,
			input.entryDate,
			{ isAdjusting: input.isAdjusting === true, sourceModule: input.sourceModule },
			tx,
		);

		const resolvedLines = await this.resolveAndValidateLines(
			input.organizationId,
			input.lines,
			tx,
		);

		const totalDebit = resolvedLines.reduce((sum, l) => sum + l.debit, 0);
		const totalCredit = resolvedLines.reduce((sum, l) => sum + l.credit, 0);
		if (totalDebit !== totalCredit || totalDebit <= 0) {
			throw new JournalUnbalancedError();
		}

		const code = await this.numbering.next('journal_entry', {
			date: new Date(`${input.entryDate}T12:00:00+07:00`),
			tx,
		});

		const entry = await this.journal.insertEntry(
			{
				organizationId: input.organizationId,
				code,
				accountingPeriodId: period.id,
				entryDate: input.entryDate,
				description: input.description ?? null,
				sourceType: input.sourceType ?? null,
				sourceId: input.sourceId ?? null,
				idempotencyKey: input.idempotencyKey ?? null,
				sourceModule: input.sourceModule,
				status: 'posted',
				totalDebit,
				totalCredit,
				currencyCode: 'IDR',
				postedBy: input.actorUserId ?? null,
				postedAt: new Date(),
				eventType: input.eventType ?? null,
				isAdjusting: input.isAdjusting === true,
				reversesEntryId: input.reversesEntryId ?? null,
			},
			tx,
		);

		const lines = await this.journal.insertLines(
			resolvedLines.map((line, index) => ({
				organizationId: input.organizationId,
				journalEntryId: entry.id,
				lineNo: index + 1,
				accountId: line.accountId!,
				debit: line.debit,
				credit: line.credit,
				currencyCode: 'IDR',
				description: line.description ?? null,
				costCenterId: line.costCenterId ?? null,
				projectId: line.projectId ?? null,
				partyType: line.partyType ?? null,
				partyId: line.partyId ?? null,
				productId: line.productId ?? null,
			})),
			tx,
		);

		return { entry, lines, replayed: false };
	}

	/* -------------------------------------------------------------- *
	 * HTTP-facing wrappers (manual accountant entries)
	 * -------------------------------------------------------------- */

	/** Lists journal entries for the `/journal` surface. */
	async listEntries(request: TJournalEntryPaginationRequest) {
		return this.journal.paginateEntries(request);
	}

	/** One journal entry with its lines. */
	async getEntry(organizationId: string, entryId: string) {
		const entry = await this.journal.findEntryById(organizationId, entryId);
		if (!entry) {
			throw new JournalTransitionError();
		}
		const lines = await this.journal.findLinesByEntryId(
			organizationId,
			entryId,
		);
		return { ...entry, lines };
	}

	/**
	 * Posts an approved manual draft in place (ERP-0129): re-validates its
	 * lines and period, assigns the journal number and stamps approver and
	 * poster. Maker-checker is enforced by the caller.
	 */
	async postDraft(
		tx: TTx,
		organizationId: string,
		entry: TJournalEntrySelect,
		approverUserId: string,
	): Promise<TJournalEntrySelect> {
		const lines = await this.journal.findLinesByEntryId(organizationId, entry.id, tx);
		const resolved = await this.resolveAndValidateLines(organizationId, lines, tx);
		const totalDebit = resolved.reduce((sum, l) => sum + l.debit, 0);
		const totalCredit = resolved.reduce((sum, l) => sum + l.credit, 0);
		if (totalDebit !== totalCredit || totalDebit <= 0) {
			throw new JournalUnbalancedError();
		}
		const period = await this.findPostablePeriod(
			organizationId,
			entry.entryDate,
			{ isAdjusting: entry.isAdjusting, sourceModule: entry.sourceModule },
			tx,
		);
		const code = await this.numbering.next('journal_entry', {
			date: new Date(`${entry.entryDate}T12:00:00+07:00`),
			tx,
		});
		const now = new Date();
		const posted = await this.journal.updateEntry(
			organizationId,
			entry.id,
			{
				status: 'posted',
				code,
				accountingPeriodId: period.id,
				totalDebit,
				totalCredit,
				approvedBy: approverUserId,
				approvedAt: now,
				postedBy: approverUserId,
				postedAt: now,
			},
			tx,
		);
		if (!posted) throw new JournalTransitionError();
		return posted;
	}

	/**
	 * Reverses a posted entry: a mirrored entry (sides swapped), and the
	 * original marked `reversed` (append-only, never an edit).
	 *
	 * @remarks Date rule (ERP-0129, grill Q54): when the original's period is
	 * still open, the reversal takes the original date or a later date the
	 * caller chooses; when it is closed or locked, the reversal lands on the
	 * first day of the first open period after it (or on the caller's date).
	 * The reversal is itself a posting, so it honours the period rules.
	 */
	async reverse(
		tx: TTx,
		organizationId: string,
		entryId: string,
		actorUserId: string,
		options: { entryDate?: string; description?: string | null } = {},
	): Promise<TPostingResult> {
		const original = await this.journal.findEntryById(organizationId, entryId, tx);
		if (!original) {
			throw new JournalTransitionError();
		}
		if (original.reversedByEntryId) {
			throw new JournalAlreadyReversedError();
		}
		if (original.status !== 'posted') {
			throw new JournalTransitionError();
		}
		if (options.entryDate && options.entryDate < original.entryDate) {
			throw new ReversalPeriodLockedError();
		}

		const originalLines = await this.journal.findLinesByEntryId(organizationId, entryId, tx);
		const reversalDate = await this.reversalDate(organizationId, original, options.entryDate, tx);

		const result = await this.post(tx, {
			organizationId,
			entryDate: reversalDate,
			sourceModule: original.sourceModule,
			sourceType: 'journal_reversal',
			sourceId: original.id,
			idempotencyKey: `reversal:${original.id}`,
			description: options.description ?? `Reversal of ${original.code}`,
			reversesEntryId: original.id,
			eventType: original.eventType,
			actorUserId: actorUserId === 'system' ? null : actorUserId,
			lines: originalLines.map((line) => ({
				accountId: line.accountId,
				debit: line.credit,
				credit: line.debit,
				description: line.description,
				costCenterId: line.costCenterId,
				projectId: line.projectId,
				partyType: line.partyType,
				partyId: line.partyId,
				productId: line.productId,
			})),
		});

		await this.journal.markReversed(organizationId, entryId, result.entry.id, tx);
		return result;
	}

	private async reversalDate(
		organizationId: string,
		original: TJournalEntrySelect,
		requested: string | undefined,
		tx: TTx,
	): Promise<string> {
		const [year, month] = original.entryDate.split('-').map(Number);
		const originalPeriod = await this.periods.findPeriodByMonth(organizationId, year, month, tx);
		if (!originalPeriod || originalPeriod.status === 'open') {
			return requested ?? original.entryDate;
		}
		if (requested) return requested;
		const next = await this.periods.findFirstOpenPeriodFrom(organizationId, original.entryDate, tx);
		if (!next) throw new NoOpenPeriodForReversalError();
		return next.startDate > original.entryDate ? next.startDate : original.entryDate;
	}

	/**
	 * Resolves the period for `entryDate` and applies the period rules
	 * (ERP-0130): `open` accepts everything, `closed` (soft close) accepts
	 * only finance's adjusting manual entries, `locked` accepts nothing.
	 */
	private async findPostablePeriod(
		organizationId: string,
		entryDate: string,
		entry: { isAdjusting: boolean; sourceModule: string },
		tx?: TTx,
	): Promise<TAccountingPeriodSelect> {
		const [year, month] = entryDate.split('-').map(Number);
		const period = await this.periods.findPeriodByMonth(organizationId, year, month, tx);
		if (!period) {
			throw new PeriodNotFoundError();
		}
		if (period.status === 'open') return period;
		if (period.status === 'closed' && entry.isAdjusting && entry.sourceModule === 'finance') {
			return period;
		}
		throw new PeriodLockedError();
	}

	/**
	 * Validates lines for a draft (ERP-0129): accounts exist, are active and
	 * postable, one side per line, cost centres are live, and the period of
	 * the date accepts this kind of entry.
	 */
	async validateDraft(
		organizationId: string,
		input: { entryDate: string; isAdjusting: boolean; lines: TPostingLine[] },
		tx?: TTx,
	): Promise<{
		period: TAccountingPeriodSelect;
		lines: Array<TPostingLine & { accountId: string }>;
		total: number;
	}> {
		const period = await this.findPostablePeriod(
			organizationId,
			input.entryDate,
			{ isAdjusting: input.isAdjusting, sourceModule: 'finance' },
			tx,
		);
		const lines = await this.resolveAndValidateLines(organizationId, input.lines, tx);
		const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
		const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
		if (totalDebit !== totalCredit || totalDebit <= 0) {
			throw new JournalUnbalancedError();
		}
		return { period, lines, total: totalDebit };
	}

	/**
	 * Resolves `accountCode` lines against the COA and validates every line:
	 * account exists, is active and postable, and carries exactly one side.
	 */
	private async resolveAndValidateLines(
		organizationId: string,
		lines: TPostingLine[],
		tx?: TTx,
	) {
		if (lines.length < 2) {
			throw new JournalUnbalancedError();
		}

		const codes = lines
			.map((line) => line.accountCode)
			.filter((code): code is string => Boolean(code));
		const byCode = codes.length
			? await this.accounts.findAccountsByCodes(organizationId, codes, tx)
			: new Map<string, TChartOfAccountSelect>();

		const resolved: Array<TPostingLine & { accountId: string }> = [];
		for (const line of lines) {
			if ((line.debit > 0) === (line.credit > 0)) {
				throw new JournalLineSideError();
			}
			let account = null;
			if (line.accountId) {
				account = await this.accounts.findAccountById(
					organizationId,
					line.accountId,
					tx,
				);
			} else if (line.accountCode) {
				account = byCode.get(line.accountCode) ?? null;
			}
			if (!account) {
				throw new AccountNotFoundError();
			}
			if (!account.isActive) {
				throw new AccountInactiveError();
			}
			if (!account.isPostable) {
				throw new AccountNotPostableError();
			}
			if (line.costCenterId) {
				const costCenter = this.costCenters
					? await this.costCenters.findById(organizationId, line.costCenterId, tx)
					: null;
				if (!costCenter) throw new CostCenterNotFoundError();
				if (!costCenter.isActive) throw new CostCenterInactiveError();
			}
			resolved.push({ ...line, accountId: account.id });
		}
		return resolved;
	}
}
