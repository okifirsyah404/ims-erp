import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { INVOICE_SERVICE_TOKEN } from '../constants/di';
import {
	createInvoiceSchema,
	createReceiptSchema,
	idParamSchema,
	invoiceListQuerySchema,
	issueInvoiceSchema,
	orderParamSchema,
	reasonSchema,
} from '../contracts/invoice.contract';

/**
 * REST controller for customer invoices (`/invoices`, ADR-0011 step 3d-2).
 *
 * @remarks
 * HTTP concerns only; `invoice:*` and `receipt:create` are enforced by the
 * `erp` guard. Billing staff see every invoice (company-wide).
 */
export class InvoiceController {
	static plugin() {
		const service = container.resolve(INVOICE_SERVICE_TOKEN);
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'finance-invoices', prefix: '/invoices', tags: ['Finance'], guards: 'erp' })
			.get('', async ({ query }) => okPaginated(await service.list(invoiceListQuerySchema.parse(query))), {
				erp: { permission: ['invoice:read'] },
				detail: { description: 'Paginated invoices' },
			})
			.get(
				'/orders/:orderId/summary',
				async ({ params }) => ok(await service.summary(orderParamSchema.parse(params).orderId)),
				{ erp: { permission: ['invoice:read'] }, detail: { description: 'Billing state of a sales order' } },
			)
			.get('/:id', async ({ params }) => ok(await service.get(id(params))), {
				erp: { permission: ['invoice:read'] },
				detail: { description: 'One invoice with its receipts and the order as printed' },
			})
			.post(
				'',
				async ({ body, erp, status }) =>
					status(201, created(await service.createDraft(erp.session.user.id, createInvoiceSchema.parse(body)))),
				{ erp: { permission: ['invoice:create'] }, detail: { description: 'Drafts the invoice of one billing term' } },
			)
			.post(
				'/:id/issue',
				async ({ params, body, erp }) =>
					ok(await service.issue(erp.session.user.id, id(params), issueInvoiceSchema.parse(body ?? {}))),
				{ erp: { permission: ['invoice:issue'] }, detail: { description: 'Issues a draft (numbers it)' } },
			)
			.post(
				'/:id/void',
				async ({ params, body, erp }) =>
					ok(await service.void(erp.session.user.id, id(params), reasonSchema.parse(body).reason)),
				{ erp: { permission: ['invoice:void'] }, detail: { description: 'Voids an unpaid invoice' } },
			)
			.post(
				'/:id/receipts',
				async ({ params, body, erp, status }) =>
					status(
						201,
						created(await service.addReceipt(erp.session.user.id, id(params), createReceiptSchema.parse(body))),
					),
				{ erp: { permission: ['receipt:create'] }, detail: { description: 'Records money received (kwitansi)' } },
			);
	}
}
