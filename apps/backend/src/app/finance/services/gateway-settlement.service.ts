import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { CASH_BANK_SERVICE_TOKEN, POSTING_RULE_SERVICE_TOKEN, POSTING_SERVICE_TOKEN } from '../constants/di';
import { GatewaySettlementAmountError } from '../errors/ledger.errors';
import type { CashBankService } from './cash-bank.service';
import type { PostingRuleService } from './posting-rule.service';
import type { PostingService } from './posting.service';

export type TGatewaySettlementInput = {
	cashBankAccountId: string;
	settlementDate: string;
	/** What the provider collected (gross, IDR minor units). */
	grossAmount: number;
	/** The provider's fee deducted from the payout. */
	feeAmount: number;
	reference: string;
};

/**
 * Payment-gateway settlement (ERP-0139, ADR-0030; M09 plan "gateway
 * accounting split").
 *
 * @remarks
 * A paid online checkout posts Dr gateway clearing / Cr receivable (sale
 * receipt). When the provider pays out, finance records the settlement:
 * a cash/bank movement for the net amount against gateway clearing (so bank
 * reconciliation sees it), and Dr gateway fees / Cr gateway clearing for the
 * fee. The clearing balance is what is still awaiting settlement.
 */
@injectable()
export class GatewaySettlementService {
	constructor(
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
		@inject(CASH_BANK_SERVICE_TOKEN) private readonly cashBank: Pick<CashBankService, 'postMovement'>,
		@inject(POSTING_RULE_SERVICE_TOKEN) private readonly rules: Pick<PostingRuleService, 'resolveAccountId'>,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: Pick<PostingService, 'postBusinessEvent'>,
	) {}

	async record(ctx: { organizationId: string; actorUserId: string }, input: TGatewaySettlementInput) {
		const net = input.grossAmount - input.feeAmount;
		if (input.grossAmount <= 0 || input.feeAmount < 0 || net <= 0) throw new GatewaySettlementAmountError();
		return this.transactions.run(async (tx) => {
			const clearing = await this.rules.resolveAccountId(
				ctx.organizationId,
				{ eventType: 'payment.gateway_settled', role: 'gateway_clearing' },
				tx,
			);
			const movement = await this.cashBank.postMovement(
				ctx,
				{
					cashBankAccountId: input.cashBankAccountId,
					transactionDate: input.settlementDate,
					direction: 'in',
					amount: net,
					description: `Gateway settlement ${input.reference}`,
					referenceNumber: input.reference,
					counterpartAccountId: clearing,
					sourceType: 'gateway_settlement',
					sourceId: null,
				},
				tx,
			);
			if (input.feeAmount > 0) {
				await this.posting.postBusinessEvent(tx, {
					organizationId: ctx.organizationId,
					entryDate: input.settlementDate,
					sourceModule: 'finance',
					sourceType: 'gateway_settlement_fee',
					sourceId: movement.id,
					idempotencyKey: `gateway_fee:${movement.id}`,
					eventType: 'payment.gateway_settled',
					description: `Gateway fee ${input.reference}`,
					actorUserId: ctx.actorUserId,
					lines: [
						{ role: 'gateway_fee', debit: input.feeAmount, credit: 0 },
						{ role: 'gateway_clearing', debit: 0, credit: input.feeAmount },
					],
				});
			}
			return { movement, net, fee: input.feeAmount };
		});
	}
}
