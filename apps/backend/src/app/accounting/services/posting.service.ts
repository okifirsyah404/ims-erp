import type { TTx } from '@drizzle/types';
import {
	JOURNAL_SOURCE_MODULES,
	type TJournalEntrySelect,
	type TJournalLineSelect,
} from '@drizzle/schemas/accounting.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { DRIZZLE_TOKEN } from '@di/provider';
import { CODE_NUMBER_SERVICE_TOKEN } from '@app/code-number';
import type { CodeNumberService } from '@app/code-number';
import { LEDGER_REPOSITORY_TOKEN } from '../constants/di';
import type { LedgerRepository } from '../repositories/ledger.repository';
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
	ReversalPeriodLockedError,
} from '../errors/ledger.errors';

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
		@inject(LEDGER_REPOSITORY_TOKEN)
		private readonly repo: LedgerRepository,
		@inject(CODE_NUMBER_SERVICE_TOKEN)
		private readonly numbering: CodeNumberService,
	) {}

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
			const existing = await this.repo.findPostedEntryByIdempotencyKey(
				input.organizationId,
				input.idempotencyKey,
				tx,
			);
			if (existing) {
				const lines = await this.repo.findLinesByEntryId(
					input.organizationId,
					existing.id,
					tx,
				);
				return { entry: existing, lines, replayed: true };
			}
		}

		const period = await this.findOpenPeriod(
			input.organizationId,
			input.entryDate,
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

		const entry = await this.repo.insertEntry(
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
				postedBy: null,
				postedAt: new Date(),
			},
			tx,
		);

		const lines = await this.repo.insertLines(
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
			})),
			tx,
		);

		return { entry, lines, replayed: false };
	}

	/* -------------------------------------------------------------- *
	 * HTTP-facing wrappers (manual accountant entries)
	 * -------------------------------------------------------------- */

	/** Lists journal entries for the `/journal` surface. */
	async listEntries(
		organizationId: string,
		pagination: { page: number; limit: number },
		filters: { year?: number; month?: number; status?: string } = {},
	) {
		return this.repo.listEntries(organizationId, pagination, filters);
	}

	/** One journal entry with its lines. */
	async getEntry(organizationId: string, entryId: string) {
		const entry = await this.repo.findEntryById(organizationId, entryId);
		if (!entry) {
			throw new JournalTransitionError();
		}
		const lines = await this.repo.findLinesByEntryId(
			organizationId,
			entryId,
		);
		return { ...entry, lines };
	}

	/**
	 * Manual posting from the `/journal` HTTP surface: opens its own
	 * transaction (unlike {@link post}, which joins the caller's).
	 */
	async postManual(
		ctx: { organizationId: string; actorUserId: string },
		input: Omit<TPostingInput, 'organizationId' | 'sourceModule'>,
	) {
		return this.database.transaction(async (tx) => {
			const result = await this.post(tx, {
				...input,
				organizationId: ctx.organizationId,
				sourceModule: 'accounting',
			});
			if (!result.replayed) {
				await this.repo.stampPostedBy(
					ctx.organizationId,
					result.entry.id,
					ctx.actorUserId,
					tx,
				);
			}
			return result;
		});
	}

	/** Manual reversal from the `/journal` HTTP surface. */
	async reverseManual(
		ctx: { organizationId: string; actorUserId: string },
		entryId: string,
		options: { entryDate?: string; description?: string | null },
	) {
		return this.database.transaction(async (tx) =>
			this.reverse(tx, ctx.organizationId, entryId, ctx.actorUserId, options),
		);
	}

	/**
	 * Reverses a posted entry: a mirrored entry (sides swapped) posted at the
	 * same or a later date, and the original marked `reversed`.
	 *
	 * @remarks Append-only correction — the original entry is never edited.
	 * The reversal is itself a posting, so it also honours the period lock.
	 */
	async reverse(
		tx: TTx,
		organizationId: string,
		entryId: string,
		actorUserId: string,
		options: { entryDate?: string; description?: string | null } = {},
	): Promise<TPostingResult> {
		const original = await this.repo.findEntryById(
			organizationId,
			entryId,
			tx,
		);
		if (!original) {
			throw new JournalTransitionError();
		}
		if (original.reversedByEntryId) {
			throw new JournalAlreadyReversedError();
		}
		if (original.status !== 'posted') {
			throw new JournalTransitionError();
		}

		const originalLines = await this.repo.findLinesByEntryId(
			organizationId,
			entryId,
			tx,
		);

		const reversalDate = options.entryDate ?? original.entryDate;
		if (reversalDate < original.entryDate) {
			throw new ReversalPeriodLockedError();
		}

		const result = await this.post(tx, {
			organizationId,
			entryDate: reversalDate,
			sourceModule: original.sourceModule,
			sourceType: 'journal_reversal',
			sourceId: original.id,
			idempotencyKey: `reversal:${original.id}`,
			description:
				options.description ?? `Reversal of ${original.code}`,
			lines: originalLines.map((line) => ({
				accountId: line.accountId,
				debit: line.credit,
				credit: line.debit,
				description: line.description,
				costCenterId: line.costCenterId,
				projectId: line.projectId,
				partyType: line.partyType,
				partyId: line.partyId,
			})),
		});
		void actorUserId;

		await this.repo.markReversed(organizationId, entryId, result.entry.id, tx);
		return result;
	}

	/**
	 * Resolves the period for `entryDate` and refuses anything not `open`.
	 *
	 * @remarks Server-side period lock (finance plan F7 target): closed and
	 * locked periods reject postings with a date inside them.
	 */
	private async findOpenPeriod(
		organizationId: string,
		entryDate: string,
		tx?: TTx,
	) {
		const [year, month] = entryDate.split('-').map(Number);
		const period = await this.repo.findPeriodByMonth(
			organizationId,
			year,
			month,
			tx,
		);
		if (!period) {
			throw new PeriodNotFoundError();
		}
		if (period.status !== 'open') {
			throw new PeriodLockedError();
		}
		return period;
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
			? await this.repo.findAccountsByCodes(organizationId, codes, tx)
			: new Map<string, Awaited<ReturnType<LedgerRepository['findAccountById']>>>();

		const resolved: Array<TPostingLine & { accountId: string }> = [];
		for (const line of lines) {
			if ((line.debit > 0) === (line.credit > 0)) {
				throw new JournalLineSideError();
			}
			let account = null;
			if (line.accountId) {
				account = await this.repo.findAccountById(
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
			resolved.push({ ...line, accountId: account.id });
		}
		return resolved;
	}
}
