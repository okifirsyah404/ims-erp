import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	invoiceCreateSchema,
	invoiceIdParamSchema,
	invoiceListQuerySchema,
	invoiceSummaryQuerySchema,
	invoiceUpdateSchema,
	createReceiptSchema,
} from '../contracts/invoice.contract';
import type { InvoiceService } from '../services/invoice.service';
import { INVOICE_SERVICE_TOKEN } from '../constants/ar-di';

/**
 * REST controller for the sales invoice slice (M09 F4).
 *
 * @remarks
 * `invoice:read/create/update` guard the draft lifecycle; `invoice:issue`
 * guards the ledger event (posting + AR sub-ledger). Codes are minted by the
 * numbering authority (`INV-<YYYYMM>-<#5>`, D8).
 */
export class InvoiceController {
	/** Builds the Elysia plugin mounting `/invoices`. */
	static plugin() {
		const invoices = container.resolve<InvoiceService>(INVOICE_SERVICE_TOKEN);

		const ctxOf = (erp: ErpContext) => ({
			organizationId: erp.organizationId,
			actorUserId: erp.session.user.id,
		});

		return domainPlugin({
			name: 'invoices',
			prefix: '',
			tags: ['Sales'],
			guards: 'erp',
		})
			.get(
				'/invoices',
				async ({ query, erp }) =>
					okPaginated(
						await invoices.list(
							erp.organizationId,
							invoiceListQuerySchema.parse(query),
							invoiceListQuerySchema.parse(query),
						),
					),
				{
					erp: { permission: ['invoice:read'] },
					detail: { description: 'Paginated invoice list' },
				},
			)
			.get(
				'/invoices/summary',
				async ({ query, erp }) =>
					ok(
						await invoices.summary(
							erp.organizationId,
							invoiceSummaryQuerySchema.parse(query),
						),
					),
				{
					erp: { permission: ['invoice:read'] },
					detail: {
						description:
							'Invoiced totals per period (M01 dashboard). Draft, void and cancelled invoices never count.',
					},
				},
			)
			.get(
				'/invoices/:id',
				async ({ params, erp }) =>
					ok(
						await invoices.get(
							erp.organizationId,
							invoiceIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['invoice:read'] },
					detail: { description: 'One invoice with its line items' },
				},
			)
			.post(
				'/invoices',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await invoices.create(
								ctxOf(erp),
								invoiceCreateSchema.parse(body),
							),
						),
					),
				{
					erp: { permission: ['invoice:create'] },
					detail: {
						description:
							'Creates a draft invoice; totals are recomputed server-side from the items',
					},
				},
			)
			.patch(
				'/invoices/:id',
				async ({ params, body, erp }) =>
					ok(
						await invoices.update(
							ctxOf(erp),
							invoiceIdParamSchema.parse(params).id,
							invoiceUpdateSchema.parse(body),
						),
					),
				{
					erp: { permission: ['invoice:update'] },
					detail: { description: 'Edits a draft invoice (items replaced wholesale)' },
				},
			)
			.post(
				'/invoices/:id/cancel',
				async ({ params, erp }) =>
					ok(
						await invoices.cancel(
							ctxOf(erp),
							invoiceIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['invoice:update'] },
					detail: { description: 'Cancels a draft invoice (no journal impact)' },
				},
			)
			.post(
				'/invoices/:id/issue',
				async ({ params, erp }) =>
					ok(
						await invoices.issue(
							ctxOf(erp),
							invoiceIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['invoice:issue'] },
					detail: {
						description:
							'draft → issued: posts DR AR / CR revenue (+ CR tax payable) and opens the AR sub-ledger row',
					},
				},
			)
			.post(
				'/invoices/:id/receipts',
				async ({ params, body, erp, status }) =>
					status(
						201,
						created(
							await invoices.addReceipt(
								ctxOf(erp),
								invoiceIdParamSchema.parse(params).id,
								createReceiptSchema.parse(body),
							),
						),
					),
				{
					erp: { permission: ['receipt:create'] },
					detail: { description: 'Records money received (kwitansi)' },
				},
			);
	}
}
