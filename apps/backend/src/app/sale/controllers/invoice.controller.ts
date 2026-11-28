import { z } from 'zod';
import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	invoiceCreateSchema,
	invoiceIdParamSchema,
	invoiceIssueSchema,
	invoiceListQuerySchema,
	invoiceSummaryQuerySchema,
	invoiceTermCreateSchema,
	invoiceUpdateSchema,
	createReceiptSchema,
	reasonSchema,
	salesOrderIdParamSchema,
} from '../contracts/invoice.contract';
import type { InvoiceService } from '../services/invoice.service';
import { INVOICE_BILLING_SERVICE_TOKEN, INVOICE_SERVICE_TOKEN } from '../constants/ar-di';

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
		const billing = container.resolve(INVOICE_BILLING_SERVICE_TOKEN);

		const ctxOf = (erp: ErpContext) => ({
			organizationId: erp.organizationId,
			actorUserId: erp.session.user.id,
		});

		return domainPlugin({
			name: 'invoices',
			prefix: '/sales',
			tags: ['Sales'],
			guards: 'erp',
		})
			.get(
				'/invoices',
				async ({ query, erp }) =>
					okPaginated(
						await invoices.list({
							organizationId: erp.organizationId,
							...invoiceListQuerySchema.parse(query),
						}),
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
				'/invoices/orders/:orderId/summary',
				async ({ params }) => ok(await billing.summary(salesOrderIdParamSchema.parse(params).orderId)),
				{
					erp: { permission: ['invoice:read'] },
					detail: { description: "An order's billing state: invoiced, paid, left to invoice, next planned term" },
				},
			)
			.get(
				'/invoices/customer-options',
				async ({ query }) =>
					ok(await invoices.customerOptions(z.object({ search: z.string().trim().max(100).optional() }).parse(query).search)),
				{
					erp: { permission: ['invoice:create'] },
					detail: {
						description:
							'Active customers for an invoice without a sales order (B-42); gated by invoice:create because finance has no customer:read',
					},
				},
			)
			.get(
				'/invoices/:id',
				async ({ params, erp }) => {
					const id = invoiceIdParamSchema.parse(params).id;
					const [detail, { items }] = await Promise.all([billing.detail(ctxOf(erp), id), invoices.get(erp.organizationId, id)]);
					return ok({ ...detail, items });
				},
				{
					erp: { permission: ['invoice:read'] },
					detail: { description: 'One invoice with its lines, receipts, order and the order billing schedule' },
				},
			)
			.post(
				'/invoices',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							body && typeof body === 'object' && 'term' in body
								? await billing.createFromTerm(ctxOf(erp), invoiceTermCreateSchema.parse(body))
								: await invoices.create(ctxOf(erp), invoiceCreateSchema.parse(body)),
						),
					),
				{
					erp: { permission: ['invoice:create'] },
					detail: {
						description:
							'Creates a draft invoice: one term of a sales order (`term`) or free items; totals are computed server-side',
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
				async ({ params, body, erp }) =>
					ok(
						await invoices.issue(
							ctxOf(erp),
							invoiceIdParamSchema.parse(params).id,
							invoiceIssueSchema.parse(body ?? undefined),
						),
					),
				{
					erp: { permission: ['invoice:issue'] },
					detail: {
						description:
							'draft → issued (optional issueDate / dueDate): posts DR AR / CR revenue (+ CR tax payable) and opens the AR sub-ledger row',
					},
				},
			)
			.post(
				'/invoices/:id/void',
				async ({ params, body, erp }) =>
					ok(await billing.void(ctxOf(erp), invoiceIdParamSchema.parse(params).id, reasonSchema.parse(body).reason)),
				{
					erp: { permission: ['invoice:void'] },
					detail: {
						description: 'Unpaid draft or issued → void with a reason; an issued invoice has its journal reversed and its AR item voided',
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
