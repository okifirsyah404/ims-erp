import type { TTx } from '@drizzle/types';
import type { TReceiptSelect } from '@drizzle/schemas/sale.schema';
import { AR_LEDGER_PORT_TOKEN } from '@app/finance/constants/ar-di';
import { POSTING_SERVICE_TOKEN } from '@app/finance/constants/di';
import type { IArLedgerPort } from '@app/finance/contracts/ar-ledger.port';
import type { PostingService } from '@app/finance/services/posting.service';
import { inject, injectable } from 'tsyringe';
import { businessDateOf } from '@utils/business-date.util';

/**
 * Ledger side of a kuitansi (ERP-0139).
 *
 * @remarks
 * Before ERP-0139 a receipt only raised the invoice's paid total: neither the
 * general ledger nor finance's AR open item moved. Now, inside the receipt's
 * transaction: Dr cash (`cash_receipt`, refined by the receipt method through
 * the posting rules) or Dr gateway clearing for an online payment / Cr
 * receivable, and the open item takes the payment. A reversal reverses that
 * journal and gives the amount back to the open item.
 */
@injectable()
export class ReceiptLedgerService {
	constructor(
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: Pick<PostingService, 'postBusinessEvent' | 'reverse'>,
		@inject(AR_LEDGER_PORT_TOKEN)
		private readonly arLedger: Pick<IArLedgerPort, 'applyReceipt' | 'findPostedEntryForSource'>,
	) {}

	async post(
		tx: TTx,
		receipt: TReceiptSelect,
		invoice: { id: string; code: string | null; customerId: string | null },
		viaGateway: boolean,
	): Promise<void> {
		const organizationId = receipt.organizationId ?? '';
		const party = { partyType: 'customer', partyId: invoice.customerId };
		await this.posting.postBusinessEvent(tx, {
			organizationId,
			entryDate: receipt.receivedDate ?? businessDateOf(),
			sourceModule: 'sale',
			sourceType: 'receipt',
			sourceId: receipt.id,
			idempotencyKey: `receipt:${receipt.id}`,
			eventType: 'sale.receipt_posted',
			description: `Receipt ${receipt.code ?? ''} for invoice ${invoice.code ?? ''}`.trim(),
			actorUserId: receipt.receivedBy,
			lines: [
				viaGateway
					? { role: 'gateway_clearing', debit: receipt.amount, credit: 0 }
					: {
							role: 'cash_receipt',
							discriminatorType: 'payment_method',
							discriminatorValue: receipt.method,
							debit: receipt.amount,
							credit: 0,
						},
				{ role: 'receivable', debit: 0, credit: receipt.amount, ...party },
			],
		});
		await this.arLedger.applyReceipt(organizationId, invoice.id, receipt.amount, tx);
	}

	async reverse(tx: TTx, receipt: TReceiptSelect, actorUserId: string, reason: string): Promise<void> {
		const organizationId = receipt.organizationId ?? '';
		const entry = await this.arLedger.findPostedEntryForSource(organizationId, 'receipt', receipt.id, tx);
		// Receipts recorded before ERP-0139 have no journal; only the open item moves.
		if (entry && entry.status === 'posted' && !entry.reversedByEntryId) {
			await this.posting.reverse(tx, organizationId, entry.id, actorUserId, {
				description: `Receipt ${receipt.code ?? ''} reversed: ${reason}`.slice(0, 500),
			});
			await this.arLedger.applyReceipt(organizationId, receipt.invoiceId, -receipt.amount, tx);
		}
	}
}
