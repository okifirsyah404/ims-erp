import type {
	TCashBankAccountSelect,
	TCashBankTransactionSelect,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { TTx } from '@drizzle/types';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { DRIZZLE_TOKEN } from '@di/provider';
import { CODE_NUMBER_SERVICE_TOKEN } from '@app/code-number';
import type { CodeNumberService } from '@app/code-number';
import {
	BANK_ACCOUNT_LINK_REPOSITORY_TOKEN,
	CASH_BANK_REPOSITORY_TOKEN,
	POSTING_SERVICE_TOKEN,
} from '../constants/di';
import type { PostingService } from '../services/posting.service';
import {
	CashBankAccountCodeTakenError,
	CashBankAccountInactiveError,
	CashBankAccountNotFoundError,
	CashBankInsufficientFundsError,
	CashBankLinkRequiredError,
} from '../errors/ledger.errors';
import type { ICashBankRepository } from '../contracts/cash-bank.repository.interface';
import type { IBankAccountLinkRepository } from '../contracts/bank-account-link.repository.interface';

export type TCashBankActionContext = {
	organizationId: string;
	actorUserId: string;
};

export type TCreateCashBankAccountInput = {
	code: string;
	name: string;
	accountType: string;
	bankName?: string | null;
	accountNumber?: string | null;
	accountHolder?: string | null;
	/** Informasional saja (finance plan F3 Q3) — kebenaran GL tetap dari JE. */
	openingBalance?: number;
	/** Opsional saat create; WAJIB sebelum transaksi pertama (Q4). */
	glAccountId?: string | null;
};

export type TUpdateCashBankAccountInput = {
	name?: string;
	bankName?: string | null;
	accountNumber?: string | null;
	accountHolder?: string | null;
	isActive?: boolean;
	glAccountId?: string | null;
};

export type TCashBankMovementInput = {
	cashBankAccountId: string;
	transactionDate: string;
	direction: 'in' | 'out';
	amount: number;
	description?: string | null;
	referenceNumber?: string | null;
	/**
	 * The GL account debited (money out) or credited (money in) as the
	 * counterpart of the cash movement. Required on manual movements.
	 */
	counterpartAccountId: string;
	/**
	 * Journal provenance override: executed `finance.payments` (F4) pass
	 * `sourceType: 'payment'` (+ `sourceId`) so the JE points back at the
	 * payment document. Manual movements keep the default.
	 */
	sourceType?: string;
	sourceId?: string | null;
};

/**
 * Cash/bank application service (M09 F3).
 *
 * @remarks
 * Manual cash movements post through the shared posting service: money in =
 * DR cash GL / CR counterpart; money out = DR counterpart / CR cash GL.
 * Executed `finance.payments` (F4) will call {@link postMovement} too — one
 * code path, two producers. The account's `current_balance` is maintained
 * transactionally; its `opening_balance` column is informational only (Q3)
 * so the GL stays the single source of truth.
 */
@injectable()
export class CashBankService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CASH_BANK_REPOSITORY_TOKEN) private readonly cashAccounts: ICashBankRepository,
		@inject(BANK_ACCOUNT_LINK_REPOSITORY_TOKEN) private readonly links: IBankAccountLinkRepository,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: PostingService,
		@inject(CODE_NUMBER_SERVICE_TOKEN)
		private readonly numbering: CodeNumberService,
	) {}

	/* ----------------------------- accounts ----------------------------- */

	async createAccount(
		ctx: TCashBankActionContext,
		input: TCreateCashBankAccountInput,
	): Promise<TCashBankAccountSelect> {
		const existing = await this.cashAccounts.findCashBankAccountByCode(
			ctx.organizationId,
			input.code,
		);
		if (existing) throw new CashBankAccountCodeTakenError();

		const account = await this.cashAccounts.insertCashBankAccount({
			organizationId: ctx.organizationId,
			code: input.code,
			name: input.name,
			accountType: input.accountType,
			bankName: input.bankName ?? null,
			accountNumber: input.accountNumber ?? null,
			accountHolder: input.accountHolder ?? null,
			openingBalance: input.openingBalance ?? 0,
			currentBalance: 0,
		});

		if (input.glAccountId) {
			await this.links.upsertBankAccountLink({
				organizationId: ctx.organizationId,
				cashBankAccountId: account.id,
				chartOfAccountId: input.glAccountId,
				isActive: true,
			});
		}
		return account;
	}

	async listAccounts(
		organizationId: string,
	): Promise<TCashBankAccountSelect[]> {
		return this.cashAccounts.listCashBankAccounts(organizationId);
	}

	async getAccount(
		organizationId: string,
		id: string,
	): Promise<TCashBankAccountSelect> {
		const account = await this.cashAccounts.findCashBankAccountById(organizationId, id);
		if (!account) throw new CashBankAccountNotFoundError();
		return account;
	}

	async updateAccount(
		ctx: TCashBankActionContext,
		id: string,
		patch: TUpdateCashBankAccountInput,
	): Promise<TCashBankAccountSelect> {
		await this.getAccount(ctx.organizationId, id);
		const updated = await this.cashAccounts.updateCashBankAccount(
			ctx.organizationId,
			id,
			patch,
		);
		if (!updated) throw new CashBankAccountNotFoundError();

		if (patch.glAccountId !== undefined) {
			if (patch.glAccountId === null) {
				await this.links.deactivateBankAccountLink(ctx.organizationId, id);
			} else {
				await this.links.upsertBankAccountLink({
					organizationId: ctx.organizationId,
					cashBankAccountId: id,
					chartOfAccountId: patch.glAccountId,
					isActive: true,
				});
			}
		}
		return updated;
	}

	/* ----------------------------- movements ----------------------------- */

	/**
	 * Posts one cash/bank movement with its auto-journal, following the
	 * caller-tx contract (D9): pass a transaction to join it, or none to run
	 * in its own. Everything — cash ledger row, journal entry (via the
	 * posting service), balance update — commits or rolls back together.
	 */
	async postMovement(
		ctx: TCashBankActionContext,
		input: TCashBankMovementInput,
		outerTx?: TTx,
	): Promise<TCashBankTransactionSelect> {
		const run = async (tx: TTx): Promise<TCashBankTransactionSelect> => {
			const account = await this.cashAccounts.findCashBankAccountById(
				ctx.organizationId,
				input.cashBankAccountId,
				tx,
			);
			if (!account) throw new CashBankAccountNotFoundError();
			if (!account.isActive) throw new CashBankAccountInactiveError();

			// Q4: GL link becomes mandatory at posting time, not at create.
			const link = await this.links.findBankAccountLinkByCashAccount(
				ctx.organizationId,
				account.id,
			);
			if (!link) throw new CashBankLinkRequiredError();

			const delta = input.direction === 'in' ? input.amount : -input.amount;
			const balanceAfter = account.currentBalance + delta;
			if (balanceAfter < 0) throw new CashBankInsufficientFundsError();

			const code = await this.numbering.next('cash_bank_transaction', {
				date: new Date(`${input.transactionDate}T12:00:00+07:00`),
				tx,
			});

			// Auto-journal: the cash GL account vs the counterpart.
			// in:  DR cash / CR counterpart
			// out: DR counterpart / CR cash
			const isCashDebit = input.direction === 'in';
			await this.posting.post(tx, {
				organizationId: ctx.organizationId,
				entryDate: input.transactionDate,
				sourceModule: 'finance',
				sourceType: input.sourceType ?? 'cash_bank_transaction',
				sourceId: input.sourceId ?? null,
				idempotencyKey: `cb:${account.id}:${code}`,
				description:
					input.description ?? `${isCashDebit ? 'Cash in' : 'Cash out'} ${account.name}`,
				lines: [
					{
						accountId: link.chartOfAccountId,
						debit: isCashDebit ? input.amount : 0,
						credit: isCashDebit ? 0 : input.amount,
					},
					{
						accountId: input.counterpartAccountId,
						debit: isCashDebit ? 0 : input.amount,
						credit: isCashDebit ? input.amount : 0,
					},
				],
			});

			const movement = await this.cashAccounts.insertCashBankTransaction(
				{
					organizationId: ctx.organizationId,
					code,
					cashBankAccountId: account.id,
					transactionDate: input.transactionDate,
					direction: input.direction,
					amount: input.amount,
					description: input.description ?? null,
					referenceNumber: input.referenceNumber ?? null,
					status: 'posted',
					balanceAfter,
					postedBy: ctx.actorUserId,
					postedAt: new Date(),
				},
				tx,
			);

			await this.cashAccounts.updateCashBankAccount(
				ctx.organizationId,
				account.id,
				{ currentBalance: balanceAfter },
				tx,
			);
			return movement;
		};
		return outerTx ? run(outerTx) : this.database.transaction(run);
	}

	async listMovements(
		organizationId: string,
		cashBankAccountId: string | undefined,
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TCashBankTransactionSelect>> {
		return this.cashAccounts.listCashBankTransactions(
			organizationId,
			cashBankAccountId,
			pagination,
		);
	}
}
