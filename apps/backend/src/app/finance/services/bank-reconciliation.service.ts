import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { TTx } from '@drizzle/types';
import { DRIZZLE_TOKEN } from '@di/provider';
import type { TPaginationResult } from '@ims-erp/common';
import { FINANCE_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { FinanceNumberingService } from './finance-numbering.service';
import { BANK_RECONCILIATION_REPOSITORY_TOKEN, CASH_BANK_REPOSITORY_TOKEN, CASH_BANK_SERVICE_TOKEN } from '../constants/di';
import type { CashBankService } from './cash-bank.service';
import { matchStatement, parseStatement, statementMappingSchema, type TStatementError, type TStatementMapping } from '../utils/bank-statement';
import {
	BankReconciliationNotFoundError,
	BankReconciliationStateError,
	CashBankAccountNotFoundError,
	StatementFileError,
	StatementMappingMissingError,
} from '../errors/ledger.errors';
import type {
	IBankReconciliationRepository,
	TBankReconciliationPaginationRequest,
} from '../contracts/bank-reconciliation.repository.interface';
import type { ICashBankRepository } from '../contracts/cash-bank.repository.interface';

export type TReconciliationActionContext = {
	organizationId: string;
	actorUserId: string;
};

export type TCreateReconciliationInput = {
	cashBankAccountId: string;
	reconciliationDate: string;
	statementBalance: number;
	notes: string | null;
};

export type TReconciliationItemInput = {
	cashBankTransactionId: string | null;
	statementReference: string | null;
	statementAmount: number | null;
	notes: string | null;
};

/**
 * Bank reconciliation application service (M09 F6).
 *
 * @remarks
 * Workflow `draft → in_progress → reconciled → closed`. The statement lines
 * are entered as items; a reconciliation can only be marked reconciled when
 * every item is matched, and the closing check reconciles the books: book
 * balance minus outstanding (unmatched) statement items must equal the
 * statement balance within zero tolerance — integer minor units, so the
 * difference must be exactly 0. The `book_balance` is read from the cash
 * account's transactionally-maintained current balance (the GL remains the
 * deeper truth; this flow is an operational control).
 */
@injectable()
export class BankReconciliationService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(BANK_RECONCILIATION_REPOSITORY_TOKEN) private readonly reconciliations: IBankReconciliationRepository,
		@inject(CASH_BANK_REPOSITORY_TOKEN) private readonly cashBank: ICashBankRepository,
		@inject(FINANCE_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: FinanceNumberingService,
		/** ERP-0143: turns an unmatched statement line into a cash/bank movement. */
		@inject(CASH_BANK_SERVICE_TOKEN) private readonly movements?: Pick<CashBankService, 'postMovement'>,
	) {}

	/** Fetches one page of the tenant's reconciliations. */
	async list(
		request: TBankReconciliationPaginationRequest,
	): Promise<TPaginationResult<unknown>> {
		return this.reconciliations.paginate(request);
	}

	/** The reconciliation with its statement lines (ERP-0143). */
	async get(organizationId: string, id: string): Promise<unknown> {
		const reconciliation = await this.reconciliations.findBankReconciliationById(
			organizationId,
			id,
		);
		if (!reconciliation) throw new BankReconciliationNotFoundError();
		const items = await this.reconciliations.listBankReconciliationItems(organizationId, id);
		return { ...(reconciliation as object), items };
	}

	/** Saves the bank's CSV layout on a cash/bank account (ERP-0143). */
	async setStatementMapping(ctx: TReconciliationActionContext, cashBankAccountId: string, mapping: unknown): Promise<TStatementMapping> {
		const parsed = statementMappingSchema.parse(mapping);
		const account = await this.cashBank.findCashBankAccountById(ctx.organizationId, cashBankAccountId);
		if (!account) throw new CashBankAccountNotFoundError();
		await this.cashBank.updateCashBankAccount(ctx.organizationId, cashBankAccountId, { statementMapping: parsed });
		return parsed;
	}

	/**
	 * Imports a bank statement CSV into a draft or in-progress reconciliation
	 * with the account's mapping. All rows or none; lines already present
	 * (same date, direction, amount and text) are skipped, so re-importing an
	 * overlapping export is safe.
	 */
	async importStatement(
		ctx: TReconciliationActionContext,
		id: string,
		file: unknown,
	): Promise<{ imported: number; skipped: number; errors: TStatementError[] }> {
		if (!(file instanceof File) || !/\.(csv|txt)$/i.test(file.name)) throw new StatementFileError('type');
		if (file.size === 0) throw new StatementFileError('empty');
		if (file.size > 5 * 1024 * 1024) throw new StatementFileError('size');
		const reconciliation = (await this.mustFind(ctx.organizationId, id)) as unknown as {
			status: string;
			cashBankAccountId: string;
			reconciliationDate: string;
		};
		if (reconciliation.status !== 'draft' && reconciliation.status !== 'in_progress') throw new BankReconciliationStateError();
		const account = (await this.cashBank.findCashBankAccountById(ctx.organizationId, reconciliation.cashBankAccountId)) as {
			statementMapping?: unknown;
		} | null;
		if (!account) throw new CashBankAccountNotFoundError();
		const mapping = statementMappingSchema.safeParse(account.statementMapping ?? undefined);
		if (!account.statementMapping || !mapping.success) throw new StatementMappingMissingError();
		const { lines, errors } = parseStatement(await file.text(), mapping.data, Number(reconciliation.reconciliationDate.slice(0, 4)));
		if (errors.length > 0) return { imported: 0, skipped: 0, errors };
		if (lines.length === 0) throw new StatementFileError('empty');
		const existing = (await this.reconciliations.listBankReconciliationItems(ctx.organizationId, id)) as Array<{
			statementDate: string | null;
			direction: string | null;
			statementAmount: number | null;
			description: string | null;
		}>;
		const key = (date: string | null, direction: string | null, amount: number | null, text: string | null) =>
			`${date}|${direction}|${amount}|${(text ?? '').trim().toUpperCase()}`;
		const seen = new Set(existing.map((item) => key(item.statementDate, item.direction, item.statementAmount, item.description)));
		const fresh = lines.filter((line) => {
			const k = key(line.date, line.direction, line.amount, line.description);
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
		await this.reconciliations.insertBankReconciliationItems(
			fresh.map((line) => ({
				organizationId: ctx.organizationId,
				bankReconciliationId: id,
				cashBankTransactionId: null,
				statementReference: line.reference,
				statementAmount: line.amount,
				statementDate: line.date,
				description: line.description,
				direction: line.direction,
				isMatched: false,
				notes: null,
			})),
		);
		return { imported: fresh.length, skipped: lines.length - fresh.length, errors: [] };
	}

	/** Matches the unmatched imported lines against the account's book movements. */
	async autoMatch(ctx: TReconciliationActionContext, id: string): Promise<{ matched: number; unmatched: number }> {
		return this.database.transaction(async (tx) => {
			const reconciliation = (await this.mustFind(ctx.organizationId, id, tx)) as unknown as {
				status: string;
				cashBankAccountId: string;
			};
			if (reconciliation.status !== 'draft' && reconciliation.status !== 'in_progress') throw new BankReconciliationStateError();
			const open = (
				(await this.reconciliations.listBankReconciliationItems(ctx.organizationId, id, tx)) as Array<{
					id: string;
					isMatched: boolean;
					statementDate: string | null;
					direction: 'in' | 'out' | null;
					statementAmount: number | null;
					statementReference: string | null;
					description: string | null;
				}>
			).filter((item) => !item.isMatched && item.statementDate && item.direction && item.statementAmount);
			if (open.length === 0) return { matched: 0, unmatched: 0 };
			const dates = open.map((item) => item.statementDate as string).sort();
			const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
			const candidates = await this.reconciliations.listMatchCandidates(
				ctx.organizationId,
				reconciliation.cashBankAccountId,
				shift(dates[0]!, -3),
				shift(dates[dates.length - 1]!, 3),
				tx,
			);
			const pairs = matchStatement(
				open.map((item) => ({
					id: item.id,
					date: item.statementDate as string,
					direction: item.direction as 'in' | 'out',
					amount: item.statementAmount as number,
					text: `${item.statementReference ?? ''} ${item.description ?? ''}`,
				})),
				candidates.map((c) => ({
					id: c.id,
					date: c.transactionDate,
					direction: c.direction,
					amount: c.amount,
					references: [c.code, c.referenceNumber ?? ''].filter(Boolean),
				})),
			);
			for (const pair of pairs) {
				await this.reconciliations.updateBankReconciliationItem(
					ctx.organizationId,
					pair.lineId,
					{ isMatched: true, cashBankTransactionId: pair.transactionId, matchMethod: 'auto' },
					tx,
				);
			}
			if (pairs.length > 0 && reconciliation.status === 'draft') {
				await this.reconciliations.updateBankReconciliation(ctx.organizationId, id, { status: 'in_progress' }, tx);
			}
			return { matched: pairs.length, unmatched: open.length - pairs.length };
		});
	}

	/**
	 * Books an unmatched statement line (bank fee, interest, a transfer never
	 * entered) as a cash/bank movement against `counterpartAccountId` and
	 * matches the line to it.
	 */
	async createTransaction(
		ctx: TReconciliationActionContext,
		id: string,
		itemId: string,
		counterpartAccountId: string,
	): Promise<unknown> {
		if (!this.movements) throw new BankReconciliationStateError();
		return this.database.transaction(async (tx) => {
			const reconciliation = (await this.mustFind(ctx.organizationId, id, tx)) as unknown as {
				status: string;
				cashBankAccountId: string;
			};
			if (reconciliation.status !== 'draft' && reconciliation.status !== 'in_progress') throw new BankReconciliationStateError();
			const item = (
				(await this.reconciliations.listBankReconciliationItems(ctx.organizationId, id, tx)) as Array<{
					id: string;
					isMatched: boolean;
					statementDate: string | null;
					direction: 'in' | 'out' | null;
					statementAmount: number | null;
					statementReference: string | null;
					description: string | null;
				}>
			).find((row) => row.id === itemId);
			if (!item) throw new BankReconciliationNotFoundError();
			if (item.isMatched || !item.statementDate || !item.direction || !item.statementAmount) {
				throw new BankReconciliationStateError('only an unmatched imported line can become a transaction');
			}
			const movement = (await this.movements!.postMovement(
				ctx,
				{
					cashBankAccountId: reconciliation.cashBankAccountId,
					transactionDate: item.statementDate,
					direction: item.direction,
					amount: item.statementAmount,
					description: item.description ?? 'Bank statement line',
					referenceNumber: item.statementReference,
					counterpartAccountId,
					sourceType: 'bank_statement',
					sourceId: item.id,
				},
				tx,
			)) as { id: string };
			const updated = await this.reconciliations.updateBankReconciliationItem(
				ctx.organizationId,
				itemId,
				{ isMatched: true, cashBankTransactionId: movement.id, matchMethod: 'created' },
				tx,
			);
			if (reconciliation.status === 'draft') {
				await this.reconciliations.updateBankReconciliation(ctx.organizationId, id, { status: 'in_progress' }, tx);
			}
			return updated;
		});
	}

	async create(
		ctx: TReconciliationActionContext,
		input: TCreateReconciliationInput,
	): Promise<unknown> {
		return this.database.transaction(async (tx) => {
			const account = await this.cashBank.findCashBankAccountById(
				ctx.organizationId,
				input.cashBankAccountId,
				tx,
			);
			if (!account) throw new CashBankAccountNotFoundError();

			const code = await this.numbering.next('bank_reconciliation', {
				date: new Date(`${input.reconciliationDate}T12:00:00+07:00`),
				tx,
			});
			const bookBalance = account.currentBalance;
			return this.reconciliations.insertBankReconciliation(
				{
					organizationId: ctx.organizationId,
					code,
					cashBankAccountId: input.cashBankAccountId,
					reconciliationDate: input.reconciliationDate,
					statementBalance: input.statementBalance,
					bookBalance,
					difference: input.statementBalance - bookBalance,
					status: 'draft',
					notes: input.notes,
				},
				tx,
			);
		});
	}

	/** Appends statement items; drafts only. */
	async addItems(
		ctx: TReconciliationActionContext,
		id: string,
		items: TReconciliationItemInput[],
	): Promise<unknown> {
		return this.database.transaction(async (tx) => {
			const reconciliation = await this.mustFind(ctx.organizationId, id, tx);
			if (reconciliation.status !== 'draft') {
				throw new BankReconciliationStateError();
			}
			return this.reconciliations.insertBankReconciliationItems(
				items.map((item) => ({
					organizationId: ctx.organizationId,
					bankReconciliationId: id,
					cashBankTransactionId: item.cashBankTransactionId,
					statementReference: item.statementReference,
					statementAmount: item.statementAmount,
					isMatched: false,
					notes: item.notes,
				})),
				tx,
			);
		});
	}

	/** Marks one statement item matched against a cash/bank transaction. */
	async matchItem(
		ctx: TReconciliationActionContext,
		reconciliationId: string,
		productId: string,
		cashBankTransactionId: string | null,
	): Promise<unknown> {
		return this.database.transaction(async (tx) => {
			const reconciliation = await this.mustFind(ctx.organizationId, reconciliationId, tx);
			if (
				reconciliation.status !== 'draft' &&
				reconciliation.status !== 'in_progress'
			) {
				throw new BankReconciliationStateError();
			}
			const updated = await this.reconciliations.updateBankReconciliationItem(
				ctx.organizationId,
				productId,
				{ isMatched: true, cashBankTransactionId, matchMethod: 'manual' },
				tx,
			);
			if (!updated) throw new BankReconciliationNotFoundError();
			if (reconciliation.status === 'draft') {
				await this.reconciliations.updateBankReconciliation(
					ctx.organizationId,
					reconciliationId,
					{ status: 'in_progress' },
					tx,
				);
			}
			return updated;
		});
	}

	/**
	 * draft/in_progress → reconciled: requires every item matched and the
	 * statement balance to equal the book balance (integer minor units).
	 */
	async reconcile(
		ctx: TReconciliationActionContext,
		id: string,
	): Promise<unknown> {
		return this.database.transaction(async (tx) => {
			const reconciliation = await this.mustFind(ctx.organizationId, id, tx);
			if (
				reconciliation.status !== 'draft' &&
				reconciliation.status !== 'in_progress'
			) {
				throw new BankReconciliationStateError();
			}
			const items = (await this.reconciliations.listBankReconciliationItems(
				ctx.organizationId,
				id,
				tx,
			)) as Array<{
				isMatched: boolean;
				statementAmount: number | null;
			}>;
			const unmatched = items.filter((item) => !item.isMatched);
			if (unmatched.length > 0) {
				throw new BankReconciliationStateError(
					`${unmatched.length} statement item(s) are still unmatched`,
				);
			}
			// ERP-0143: statement lines are movements, so the closing check is the
			// statement balance against the book balance on the statement date
			// (recomputed now: lines turned into transactions moved it).
			const detail = reconciliation as unknown as { cashBankAccountId?: string; reconciliationDate?: string };
			const bookBalance =
				typeof this.reconciliations.balanceAsOf === 'function' && detail.cashBankAccountId && detail.reconciliationDate
					? await this.reconciliations.balanceAsOf(ctx.organizationId, detail.cashBankAccountId, detail.reconciliationDate, tx)
					: reconciliation.bookBalance;
			const difference = reconciliation.statementBalance - bookBalance;
			if (difference !== 0) {
				throw new BankReconciliationStateError(
					`statement balance differs from the book balance by ${difference / 100}`,
				);
			}
			return this.reconciliations.updateBankReconciliation(
				ctx.organizationId,
				id,
				{
					status: 'reconciled',
					reconciledBy: ctx.actorUserId,
					reconciledAt: new Date(),
					bookBalance,
					difference,
				},
				tx,
			);
		});
	}

	/** reconciled → closed (terminal; typically by the month-end close). */
	async close(ctx: TReconciliationActionContext, id: string): Promise<unknown> {
		return this.database.transaction(async (tx) => {
			const reconciliation = await this.mustFind(ctx.organizationId, id, tx);
			if (reconciliation.status !== 'reconciled') {
				throw new BankReconciliationStateError();
			}
			return this.reconciliations.updateBankReconciliation(
				ctx.organizationId,
				id,
				{ status: 'closed' },
				tx,
			);
		});
	}

	private async mustFind(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<{
		id: string;
		status: string;
		statementBalance: number;
		bookBalance: number;
	}> {
		const reconciliation = await this.reconciliations.findBankReconciliationById(
			organizationId,
			id,
			tx,
		);
		if (!reconciliation) throw new BankReconciliationNotFoundError();
		return reconciliation as never;
	}
}
