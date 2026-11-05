import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { ok, okPaginated } from '@http/response';
import { INVOICE_SERVICE_TOKEN } from '../constants/di';
import { idParamSchema, reasonSchema, receiptListQuerySchema } from '../contracts/invoice.contract';

/** REST controller for receipts (kwitansi, `/receipts`, ADR-0011 step 3d-2). */
export class ReceiptController {
	static plugin() {
		const service = container.resolve(INVOICE_SERVICE_TOKEN);

		return domainPlugin({ name: 'finance-receipts', prefix: '/receipts', tags: ['Finance'], guards: 'erp' })
			.get('', async ({ query }) => okPaginated(await service.listReceipts(receiptListQuerySchema.parse(query))), {
				erp: { permission: ['receipt:read'] },
				detail: { description: 'Paginated receipts with their invoice and customer' },
			})
			.post(
				'/:id/reverse',
				async ({ params, body, erp }) =>
					ok(
						await service.reverseReceipt(
							erp.session.user.id,
							idParamSchema.parse(params).id,
							reasonSchema.parse(body).reason,
						),
					),
				{ erp: { permission: ['receipt:reverse'] }, detail: { description: 'Reverses a receipt with a reason' } },
			);
	}
}
