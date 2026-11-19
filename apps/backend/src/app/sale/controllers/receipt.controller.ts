import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { ok, okPaginated } from '@http/response';
import {
	invoiceIdParamSchema,
	reasonSchema,
	receiptListQuerySchema,
} from '../contracts/invoice.contract';
import type { InvoiceService } from '../services/invoice.service';
import { INVOICE_SERVICE_TOKEN } from '../constants/ar-di';

/**
 * REST controller for receipts (kwitansi, `/receipts`).
 *
 * @remarks
 * `receipt:read` and `receipt:reverse` are enforced by the `erp` guard.
 * Codes are minted by the numbering authority (`KW-…`). Recording a receipt
 * is exposed as `POST /invoices/:id/receipts` on the invoice controller.
 */
export class ReceiptController {
	/** Builds the Elysia plugin mounting `/receipts`. */
	static plugin() {
		const invoices = container.resolve<InvoiceService>(INVOICE_SERVICE_TOKEN);

		const ctxOf = (erp: ErpContext) => ({
			organizationId: erp.organizationId,
			actorUserId: erp.session.user.id,
		});

		return domainPlugin({
			name: 'receipts',
			prefix: '/sales/receipts',
			tags: ['Sales'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(
						await invoices.listReceipts(
							erp.organizationId,
							receiptListQuerySchema.parse(query),
						),
					),
				{
					erp: { permission: ['receipt:read'] },
					detail: {
						description:
							'Paginated receipts with their invoice and customer',
					},
				},
			)
			.post(
				'/:id/reverse',
				async ({ params, body, erp }) =>
					ok(
						await invoices.reverseReceipt(
							ctxOf(erp),
							invoiceIdParamSchema.parse(params).id,
							reasonSchema.parse(body).reason,
						),
					),
				{
					erp: { permission: ['receipt:reverse'] },
					detail: { description: 'Reverses a receipt with a reason' },
				},
			);
	}
}
