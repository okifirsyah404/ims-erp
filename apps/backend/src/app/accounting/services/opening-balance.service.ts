import type { TTx } from '@drizzle/types';
import type { TOpeningBalanceSelect } from '@drizzle/schemas/accounting.schema';
import { inject, injectable } from 'tsyringe';
import { LEDGER_REPOSITORY_TOKEN, POSTING_SERVICE_TOKEN } from '../constants/di';
import type { LedgerRepository } from '../repositories/ledger.repository';
import type { PostingService } from '../services/posting.service';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { DRIZZLE_TOKEN } from '@di/provider';
import {
	AccountNotFoundError,
	JournalUnbalancedError,
	OpeningBalanceAlreadyPostedError,
	OpeningBalanceLockedError,
} from '../errors/ledger.errors';

export type TOpeningBalanceActionContext = {
	organizationId: string;
	actorUserId: string;
};

export type TOpeningBalanceRowInput = {
	accountId: string;
	asOfDate: string;
	debitBalance: number;
	creditBalance: number;
	description?: string | null;
};

/**
 * Opening-balance application service (M09 F3).
 *
 * @remarks
 * Batch draft + one-shot post (finance plan F3 Q1): rows are drafted and
 * freely edited; a single post action validates that the batch balances
 * (Σdebit = Σcredit), then — inside one transaction — posts ONE journal
 * entry (source `opening_balance`) and stamps `posted_at` on every row.
 * Posted batches are immutable: corrections happen through a regular
 * journal reversal, never by editing the rows.
 */
@injectable()
export class OpeningBalanceService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(LEDGER_REPOSITORY_TOKEN) private readonly repo: LedgerRepository,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: PostingService,
	) {}

	async list(organizationId: string): Promise<TOpeningBalanceSelect[]> {
		return this.repo.listOpeningBalances(organizationId);
	}

	/** Adds (or merges into) a draft row for `(account, asOfDate)`. */
	async addRow(
		ctx: TOpeningBalanceActionContext,
		input: TOpeningBalanceRowInput,
	): Promise<TOpeningBalanceSelect> {
		const account = await this.repo.findAccountById(
			ctx.organizationId,
			input.accountId,
		);
		if (!account) throw new AccountNotFoundError();

		const existing = await this.repo.findOpeningBalanceByAccountAndDate(
			ctx.organizationId,
			input.accountId,
			input.asOfDate,
		);
		if (existing) {
			if (existing.postedAt) throw new OpeningBalanceAlreadyPostedError();
			return (
				(await this.repo.updateOpeningBalance(ctx.organizationId, existing.id, {
					debitBalance: input.debitBalance,
					creditBalance: input.creditBalance,
					description: input.description ?? existing.description,
				})) ?? existing
			);
		}
		return this.repo.insertOpeningBalance({
			organizationId: ctx.organizationId,
			accountId: input.accountId,
			asOfDate: input.asOfDate,
			debitBalance: input.debitBalance,
			creditBalance: input.creditBalance,
			currencyCode: 'IDR',
			description: input.description ?? null,
		});
	}

	/** Edits a draft row. Posted rows are immutable. */
	async updateRow(
		ctx: TOpeningBalanceActionContext,
		id: string,
		patch: {
			debitBalance?: number;
			creditBalance?: number;
			description?: string | null;
		},
	): Promise<TOpeningBalanceSelect> {
		const rows = await this.repo.listOpeningBalances(ctx.organizationId);
		const row = rows.find((r) => r.id === id);
		if (!row) throw new OpeningBalanceLockedError();
		if (row.postedAt) throw new OpeningBalanceAlreadyPostedError();
		const updated = await this.repo.updateOpeningBalance(
			ctx.organizationId,
			id,
			patch,
		);
		if (!updated) throw new OpeningBalanceLockedError();
		return updated;
	}

	async removeRow(ctx: TOpeningBalanceActionContext, id: string): Promise<void> {
		const rows = await this.repo.listOpeningBalances(ctx.organizationId);
		const row = rows.find((r) => r.id === id);
		if (!row) throw new OpeningBalanceLockedError();
		if (row.postedAt) throw new OpeningBalanceAlreadyPostedError();
		await this.repo.deleteOpeningBalance(ctx.organizationId, id);
	}

	/**
	 * Posts the whole draft batch as ONE journal entry.
	 *
	 * @remarks Validations: at least one row, all rows share the same
	 * as-of date (one JE per batch), batch balances. The JE debits/credits
	 * each account its opening amount; the entry date is the batch's as-of
	 * date, so the period for that month must exist and be open.
	 */
	async post(
		ctx: TOpeningBalanceActionContext,
	): Promise<{ entryId: string; rows: number }> {
		const rows = (
			await this.repo.listOpeningBalances(ctx.organizationId)
		).filter((r) => !r.postedAt);
		if (rows.length === 0) {
			throw new OpeningBalanceLockedError();
		}

		const asOfDates = new Set(rows.map((r) => r.asOfDate));
		if (asOfDates.size > 1) {
			throw new OpeningBalanceLockedError();
		}
		const asOfDate = rows[0].asOfDate;

		const totalDebit = rows.reduce((s, r) => s + r.debitBalance, 0);
		const totalCredit = rows.reduce((s, r) => s + r.creditBalance, 0);
		if (totalDebit !== totalCredit || totalDebit <= 0) {
			throw new JournalUnbalancedError();
		}

		return this.database.transaction(async (tx: TTx) => {
			const result = await this.posting.post(tx, {
				organizationId: ctx.organizationId,
				entryDate: asOfDate,
				sourceModule: 'accounting',
				sourceType: 'opening_balance',
				idempotencyKey: `opening-balance:${ctx.organizationId}:${asOfDate}`,
				description: `Opening balances as of ${asOfDate}`,
				lines: rows.map((row) => ({
					accountId: row.accountId,
					debit: row.debitBalance,
					credit: row.creditBalance,
					description: row.description,
				})),
			});

			for (const row of rows) {
				await this.repo.updateOpeningBalance(
					ctx.organizationId,
					row.id,
					{},
					tx,
				);
				await this.repo.stampOpeningBalancePosted(
					ctx.organizationId,
					row.id,
					tx,
				);
			}
			void ctx.actorUserId;
			return { entryId: result.entry.id, rows: rows.length };
		});
	}
}
