import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { TTx } from '@drizzle/types';
import { DRIZZLE_TOKEN } from '@di/provider';
import type { TPaginationResult } from '@ims-erp/common';
import { CODE_NUMBER_SERVICE_TOKEN } from '@app/code-number';
import type { CodeNumberService } from '@app/code-number';
import { BANK_RECONCILIATION_REPOSITORY_TOKEN, CASH_BANK_REPOSITORY_TOKEN } from '../constants/di';
import {
	BankReconciliationNotFoundError,
	BankReconciliationStateError,
	CashBankAccountNotFoundError,
} from '../errors/ledger.errors';
import type { IBankReconciliationRepository, ICashBankRepository } from '../contracts/ledger.repositories';

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
		@inject(CODE_NUMBER_SERVICE_TOKEN)
		private readonly numbering: CodeNumberService,
	) {}

	async list(
		organizationId: string,
		filters: { cashBankAccountId?: string; status?: string },
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<unknown>> {
		return this.reconciliations.listBankReconciliations(organizationId, filters, pagination);
	}

	async get(organizationId: string, id: string): Promise<unknown> {
		const reconciliation = await this.reconciliations.findBankReconciliationById(
			organizationId,
			id,
		);
		if (!reconciliation) throw new BankReconciliationNotFoundError();
		return reconciliation;
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
		itemId: string,
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
				itemId,
				{ isMatched: true, cashBankTransactionId },
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
			const matchedTotal = items.reduce(
				(s, item) => s + (item.statementAmount ?? 0),
				0,
			);
			// The statement balance must equal the book balance; the matched
			// items explain the movements that got us there.
			if (matchedTotal !== reconciliation.statementBalance) {
				throw new BankReconciliationStateError(
					'matched statement items do not add up to the statement balance',
				);
			}
			return this.reconciliations.updateBankReconciliation(
				ctx.organizationId,
				id,
				{
					status: 'reconciled',
					reconciledBy: ctx.actorUserId,
					reconciledAt: new Date(),
					difference: reconciliation.statementBalance - reconciliation.bookBalance,
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
