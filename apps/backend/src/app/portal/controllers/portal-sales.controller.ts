import { businessDateOf } from '@utils/business-date.util';
import { container } from 'tsyringe';
import { requestBodyDoc } from '@http/openapi';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok } from '@http/response';
import { resolveLanguage, translator } from '@providers/i18n/translator';
import { PORTAL_RFQ_SERVICE_TOKEN, PORTAL_SALES_SERVICE_TOKEN, PORTAL_SERVICE_TOKEN } from '../constants/di';
import {
	portalAcceptQuotationSchema,
	portalCheckoutSchema,
	portalIdParamSchema,
	portalOrderNumberParamSchema,
	portalPayInvoiceSchema,
	portalPlaceOrderSchema,
	portalRevisionSchema,
	portalRfqClaimConfirmSchema,
	portalRfqClaimSchema,
} from '../contracts/portal.contract';
import { PortalNotFoundError, PortalRfqClaimCodeInvalidError, PortalRfqNotClaimableError } from '../errors/portal.errors';
import { rfqSummary } from '../utils/portal-presenter';
import { formPayload } from '../utils/form-payload';
import type { TPresenter } from '../utils/portal-presenter';
import {
	invoiceDetail,
	invoiceList,
	orderDetail,
	orderSummary,
	paymentMethods,
	quotationDetail,
	quotationSummary,
	toMoney,
} from '../utils/portal-sales-presenter';

function presenter(ctx: unknown): TPresenter {
	const { request } = ctx as { request: Request };
	return { t: translator(ctx), language: resolveLanguage(request.headers.get('accept-language')), today: businessDateOf(), now: new Date() };
}

/**
 * Online ordering, quotations, orders, invoices and payment of the signed-in
 * customer (`/portal/v1`, ERP-0070). Every route runs the `portal` guard;
 * responses use the portal's `PortalSource` view shapes (whole rupiah).
 * The website's checkout calls the same routes with the customer's session
 * from the sign-in hand-off.
 */
export class PortalSalesController {
	static plugin() {
		const sales = container.resolve(PORTAL_SALES_SERVICE_TOKEN);
		const portalService = container.resolve(PORTAL_SERVICE_TOKEN);
		const rfqs = container.resolve(PORTAL_RFQ_SERVICE_TOKEN);
		const id = (params: unknown) => {
			const parsed = portalIdParamSchema.safeParse(params);
			if (!parsed.success) throw new PortalNotFoundError();
			return parsed.data.id;
		};

		return domainPlugin({ name: 'portal-sales', prefix: '/portal/v1', tags: ['Customer portal'], guards: 'portal' })
			.get(
				'/rfqs',
				async (ctx) => {
					const p = presenter(ctx);
					return ok((await rfqs.list(ctx.portal)).map((rfq) => rfqSummary(p, rfq)));
				},
				{
					portal: true,
					detail: {
						summary: 'Website RFQs of the account',
						description: 'RFQs submitted on the website while signed in, plus guest RFQs claimed with a code (ERP-0072), newest first, with the SPH sent for each',
					},
				},
			)
			.post(
				'/rfqs/claim',
				async ({ portal, body }) => {
					const challenge = await rfqs.requestClaim(portal, portalRfqClaimSchema.parse(body).reference);
					if (!challenge) throw new PortalRfqNotClaimableError();
					return ok(challenge);
				},
				{
					portal: true,
					detail: {
						summary: 'Start a guest-RFQ claim',
						description:
							'Emails a 6-digit code (15 minutes, 5 attempts) to the address on the RFQ. 404 when the reference is unknown, already in an account, or has no email.',
						...requestBodyDoc(portalRfqClaimSchema),
					},
				},
			)
			.post(
				'/rfqs/claim/confirm',
				async ({ portal, body }) => {
					const input = portalRfqClaimConfirmSchema.parse(body);
					if (!(await rfqs.confirmClaim(portal, input.reference, input.code))) throw new PortalRfqClaimCodeInvalidError();
					return noContent();
				},
				{
					portal: true,
					detail: {
						summary: 'Confirm a guest-RFQ claim',
						description: 'Adds the RFQ to this account when the code matches; 400 when it is wrong or expired',
						...requestBodyDoc(portalRfqClaimConfirmSchema),
					},
				},
			)
			.post('/checkout/quote', async ({ body }) => ok(await sales.quote(portalCheckoutSchema.parse(body))), {
				portal: true,
				detail: {
					summary: 'Price a cart',
					description:
						'List prices of published, fixed-price catalog products plus standard VAT; `available: false` for anything that cannot be ordered online. `quoteId` must be sent back to place the order.',
					...requestBodyDoc(portalCheckoutSchema),
				},
			})
			.post(
				'/checkout/orders',
				async (ctx) => {
					const input = portalPlaceOrderSchema.parse(ctx.body);
					const placed = await sales.placeOrder(ctx.portal, input, input.source === 'web' ? 'website' : 'portal');
					return ctx.status(201, created(placed));
				},
				{
					portal: true,
					detail: {
						summary: 'Place an order',
						description:
							'Creates a draft quotation (SPH) for the customer\'s salesperson to review; nothing is charged now (`paymentStatus: pending_approval`). 409 when prices or availability changed since the quote; 403 for viewers.',
						...requestBodyDoc(portalPlaceOrderSchema),
					},
				},
			)
			.get(
				'/checkout/orders/:orderNumber',
				async (ctx) => {
					const parsed = portalOrderNumberParamSchema.safeParse(ctx.params);
					if (!parsed.success) throw new PortalNotFoundError();
					// Quotation numbers contain "/" (e.g. 0001/QT/…), sent URL-encoded; the router keeps `%2F`.
					let orderNumber: string;
					try {
						orderNumber = decodeURIComponent(parsed.data.orderNumber);
					} catch {
						throw new PortalNotFoundError();
					}
					const { quotation, state } = await sales.orderStatus(ctx.portal, orderNumber);
					const summary = quotationSummary(presenter(ctx), quotation);
					return ok({
						orderNumber: quotation.code,
						status: state,
						statusLabel: summary.meta.slice(0, 80),
						total: toMoney(quotation.grandTotal),
						updatedAt: quotation.updatedAt.toISOString(),
					});
				},
				{ portal: true, detail: { summary: 'Online order status', description: 'Status of an online order by its quotation number' } },
			)
			.get(
				'/quotations',
				async (ctx) => {
					const p = presenter(ctx);
					const rows = await sales.listQuotations(ctx.portal);
					return ok(rows.map((row) => quotationSummary(p, row, row.items.length, row.creator?.name ?? '', row.salesOrder?.code ?? null)));
				},
				{ portal: true, detail: { summary: 'List quotations', description: "The customer's quotations (SPH), including online orders still in review" } },
			)
			.get(
				'/quotations/:id',
				async (ctx) => {
					const [quotation, approvers, customer] = await Promise.all([
						sales.getQuotation(ctx.portal, id(ctx.params)),
						sales.approvers(ctx.portal),
						portalService.customer(ctx.portal),
					]);
					return ok(quotationDetail(presenter(ctx), quotation, { companyName: customer?.name ?? '', approvers }));
				},
				{ portal: true, detail: { summary: 'Quotation detail', description: 'Lines, totals, payment schedule and who may approve' } },
			)
			.post(
				'/quotations/:id/accept',
				async (ctx) => {
					const input = portalAcceptQuotationSchema.parse(ctx.body);
					const order = await sales.acceptQuotation(ctx.portal, id(ctx.params), input);
					return ok({ orderId: order.id, orderNumber: order.code });
				},
				{
					portal: true,
					detail: {
						summary: 'Accept a quotation',
						description:
							'An owner or approver accepts a sent quotation in their own name; the sales order is created. 409 when the quotation is not waiting for an answer, 403 for other roles.',
						...requestBodyDoc(portalAcceptQuotationSchema),
					},
				},
			)
			.post(
				'/quotations/:id/revision',
				async (ctx) => {
					// JSON, or the portal's multipart form (`payload`); an attached file answers 422 like tickets.
					await sales.requestRevision(ctx.portal, id(ctx.params), portalRevisionSchema.parse(formPayload(ctx.body)));
					return noContent();
				},
				{
					portal: true,
					detail: {
						summary: 'Ask for a revision',
						description: 'Sends the topics and message to the salesperson, who opens the revision',
						...requestBodyDoc(portalRevisionSchema, { multipart: true }),
					},
				},
			)
			.get('/orders', async (ctx) => ok((await sales.listOrders(ctx.portal)).map((order) => orderSummary(presenter(ctx), order))), {
				portal: true,
				detail: { summary: 'List orders', description: "The customer's sales orders" },
			})
			.get(
				'/orders/:id',
				async (ctx) => {
					const { order, paidMinor } = await sales.getOrder(ctx.portal, id(ctx.params));
					return ok(orderDetail(presenter(ctx), order, paidMinor));
				},
				{ portal: true, detail: { summary: 'Order detail', description: 'Lines, totals, amount paid and the status timeline' } },
			)
			.get('/invoices', async (ctx) => ok(invoiceList(presenter(ctx), await sales.listInvoices(ctx.portal))), {
				portal: true,
				detail: { summary: 'List invoices', description: 'Issued invoices in every organization with outstanding, overdue and paid-this-year totals' },
			})
			.get('/invoices/:id', async (ctx) => ok(invoiceDetail(presenter(ctx), await sales.getInvoice(ctx.portal, id(ctx.params)))), {
				portal: true,
				detail: { summary: 'Invoice detail', description: 'Lines, totals and recorded payments' },
			})
			.get('/payment-methods', (ctx) => ok(paymentMethods(presenter(ctx), sales.gatewayStatus())), {
				portal: true,
				detail: { summary: 'Payment methods', description: 'The active payment gateway as one online method; empty when none is configured' },
			})
			.post(
				'/invoices/:id/pay',
				async (ctx) => {
					const invoiceId = id(ctx.params);
					const input = portalPayInvoiceSchema.parse(ctx.body);
					const checkout = await sales.payInvoice(ctx.portal, invoiceId, input.methodId);
					return ok({
						invoiceId,
						methodId: input.methodId,
						...(checkout.paymentUrl ? { instructionsUrl: checkout.paymentUrl } : {}),
						reference: checkout.providerReference ?? checkout.id,
					});
				},
				{
					portal: true,
					detail: {
						summary: 'Pay an invoice',
						description:
							'Opens (or reuses) the gateway checkout for the outstanding amount; the browser goes to `instructionsUrl`. Owners and finance members only (403 otherwise).',
						...requestBodyDoc(portalPayInvoiceSchema),
					},
				},
			);
	}
}
