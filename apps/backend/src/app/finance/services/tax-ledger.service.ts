import type { TTx } from '@drizzle/types';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import {
	ACCOUNTING_PERIOD_REPOSITORY_TOKEN,
	CASH_BANK_SERVICE_TOKEN,
	JOURNAL_REPOSITORY_TOKEN,
	POSTING_RULE_SERVICE_TOKEN,
	POSTING_SERVICE_TOKEN,
} from '../constants/di';
import type { IAccountingPeriodRepository } from '../contracts/accounting-period.repository.interface';
import type { IJournalRepository } from '../contracts/journal.repository.interface';
import { PeriodNotFoundError, TaxPaymentAmountError } from '../errors/ledger.errors';
import type { CashBankService } from './cash-bank.service';
import type { PostingRuleService } from './posting-rule.service';
import type { PostingService } from './posting.service';

/** Tax liabilities finance pays to the state (ERP-0140). */
export const TAX_PAYMENT_ROLES = ['vat_payable', 'wht_payable', 'pph21_payable', 'pph25_payable'] as const;
export type TTaxPaymentRole = (typeof TAX_PAYMENT_ROLES)[number];

export type TPpnSettlementResult = {
	period: string;
	output: number;
	input: number;
	/** > 0: PPN to pay (Utang PPN); < 0: overpaid (PPN Lebih Bayar); 0: nothing. */
	net: number;
	journalEntryId: string | null;
};

/**
 * PPN period close and tax payments (ERP-0140, grill decision 2).
 *
 * @remarks
 * Settling a month moves that month's PPN movement out of the output and
 * input accounts: Dr PPN output / Cr PPN input, the difference to Utang PPN
 * (or PPN Lebih Bayar when input exceeds output), dated the period's last day
 * and idempotent per month. The figures come from the general ledger (the
 * single source of truth); the tax module's working papers are compared, not
 * posted. A tax payment is a cash/bank movement out against the liability the
 * posting rules give for its role (PPh by tax code through the `tax`
 * discriminator).
 */
@injectable()
export class TaxLedgerService {
	constructor(
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
		@inject(ACCOUNTING_PERIOD_REPOSITORY_TOKEN)
		private readonly periods: Pick<IAccountingPeriodRepository, 'findPeriodByMonth'>,
		@inject(JOURNAL_REPOSITORY_TOKEN) private readonly journal: Pick<
			IJournalRepository,
			'listAccountActivity' | 'findPostedEntryByIdempotencyKey' | 'findLinesByEntryId'
		>,
		@inject(POSTING_RULE_SERVICE_TOKEN) private readonly rules: Pick<PostingRuleService, 'resolveAccountId'>,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: Pick<PostingService, 'post'>,
		@inject(CASH_BANK_SERVICE_TOKEN) private readonly cashBank: Pick<CashBankService, 'postMovement'>,
	) {}

	async settlePpn(ctx: { organizationId: string; actorUserId: string }, year: number, month: number): Promise<TPpnSettlementResult> {
		const period = await this.periods.findPeriodByMonth(ctx.organizationId, year, month);
		if (!period) throw new PeriodNotFoundError();
		const code = `${year}-${String(month).padStart(2, '0')}`;
		return this.transactions.run(async (tx: TTx) => {
			const lookup = (role: string) =>
				this.rules.resolveAccountId(ctx.organizationId, { eventType: 'finance.ppn_settled', role }, tx);
			const outputAccount = await lookup('vat_output');
			const inputAccount = await lookup('vat_input');
			const idempotencyKey = `ppn_settlement:${code}`;
			// A settled month answers with its journal: its own lines already
			// zero the period's output and input activity, so recomputing would
			// report nothing. PPN booked after settlement needs a reversal and a
			// fresh settlement.
			const settled = await this.journal.findPostedEntryByIdempotencyKey(ctx.organizationId, idempotencyKey, tx);
			if (settled) {
				const posted = await this.journal.findLinesByEntryId(ctx.organizationId, settled.id, tx);
				const output = posted.filter((line) => line.accountId === outputAccount).reduce((sum, line) => sum + line.debit, 0);
				const input = posted.filter((line) => line.accountId === inputAccount).reduce((sum, line) => sum + line.credit, 0);
				return { period: code, output, input, net: output - input, journalEntryId: settled.id };
			}
			const activity = await this.journal.listAccountActivity(ctx.organizationId, period.startDate, period.endDate, tx);
			const out = activity.find((row) => row.accountId === outputAccount);
			const inp = activity.find((row) => row.accountId === inputAccount);
			const output = Math.max(0, (out?.credit ?? 0) - (out?.debit ?? 0));
			const input = Math.max(0, (inp?.debit ?? 0) - (inp?.credit ?? 0));
			const net = output - input;
			if (output === 0 && input === 0) return { period: code, output, input, net, journalEntryId: null };
			const lines = [
				{ accountId: outputAccount, debit: output, credit: 0 },
				{ accountId: inputAccount, debit: 0, credit: input },
				net > 0
					? { accountId: await lookup('vat_payable'), debit: 0, credit: net }
					: { accountId: await lookup('vat_overpaid'), debit: -net, credit: 0 },
			].filter((line) => line.debit > 0 || line.credit > 0);
			const { entry } = await this.posting.post(tx, {
				organizationId: ctx.organizationId,
				entryDate: period.endDate,
				sourceModule: 'finance',
				sourceType: 'ppn_settlement',
				sourceId: period.id,
				idempotencyKey,
				eventType: 'finance.ppn_settled',
				description: `PPN settlement ${code}`,
				actorUserId: ctx.actorUserId,
				lines,
			});
			return { period: code, output, input, net, journalEntryId: entry.id };
		});
	}

	/** Pays a tax liability to the state from a cash/bank account. */
	async payTax(
		ctx: { organizationId: string; actorUserId: string },
		input: {
			role: TTaxPaymentRole;
			taxCode: string | null;
			cashBankAccountId: string;
			paymentDate: string;
			amount: number;
			reference: string;
		},
	) {
		if (input.amount <= 0) throw new TaxPaymentAmountError();
		return this.transactions.run(async (tx: TTx) => {
			const liability = await this.rules.resolveAccountId(
				ctx.organizationId,
				{
					eventType: 'finance.tax_paid',
					role: input.role,
					discriminatorType: input.taxCode ? 'tax' : null,
					discriminatorValue: input.taxCode,
				},
				tx,
			);
			return this.cashBank.postMovement(
				ctx,
				{
					cashBankAccountId: input.cashBankAccountId,
					transactionDate: input.paymentDate,
					direction: 'out',
					amount: input.amount,
					description: `Tax payment ${input.reference}`,
					referenceNumber: input.reference,
					counterpartAccountId: liability,
					sourceType: 'tax_payment',
					sourceId: null,
				},
				tx,
			);
		});
	}
}
