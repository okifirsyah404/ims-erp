import { container } from 'tsyringe';
import { z } from 'zod';
import { domainPlugin } from '@http/plugin';
import { created, ok } from '@http/response';
import { gatewayProviderParamSchema } from '../contracts/payment-gateway.contract';
import { GATEWAY_PAYMENT_SERVICE_TOKEN } from '../constants/di';

/** `:id` of the invoice being paid (uuid; a malformed id is a 400, never a 500). */
const invoiceIdParamSchema = z.object({ id: z.string().uuid() });

/**
 * Online payment of invoices for staff (ERP-0020): whether a gateway is on,
 * the checkouts of an invoice, and opening one to send to the customer.
 * Opening a checkout is receiving a payment, so it takes `receipt:create`.
 */
export class GatewayPaymentController {
	static plugin() {
		const service = container.resolve(GATEWAY_PAYMENT_SERVICE_TOKEN);

		return domainPlugin({
			name: 'gateway-payments',
			prefix: '',
			tags: ['Sales'],
			guards: 'erp',
		})
			.get('/gateway-payments/status', () => ok(service.status()), {
				erp: { permission: ['invoice:read'] },
				detail: { description: 'Whether online payment is configured, and its provider' },
			})
			.get(
				'/invoices/:id/gateway-payments',
				async ({ params, erp }) =>
					ok(await service.list(erp.organizationId, invoiceIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['invoice:read'] },
					detail: { description: 'Online payment checkouts of an invoice, newest first' },
				},
			)
			.post(
				'/invoices/:id/gateway-payments',
				async ({ params, erp, status }) =>
					status(
						201,
						created(
							await service.open(
								{ organizationId: erp.organizationId, actorUserId: erp.session.user.id },
								invoiceIdParamSchema.parse(params).id,
							),
						),
					),
				{
					erp: { permission: ['receipt:create'] },
					detail: {
						description:
							'Opens (or reuses) a hosted checkout of the outstanding amount at the configured provider',
					},
				},
			);
	}
}

/**
 * Payment gateway webhooks (`/payments/gateway/:provider/webhook`). Public:
 * no session; authenticity is the provider adapter's token or signature check
 * (401 otherwise). Always answers 200 with an outcome once verified, so the
 * provider stops retrying; a redirect back from the checkout is never trusted.
 */
export class GatewayWebhookController {
	static plugin() {
		const service = container.resolve(GATEWAY_PAYMENT_SERVICE_TOKEN);

		return domainPlugin({
			name: 'gateway-webhooks',
			prefix: '/payments/gateway',
			tags: ['Payment gateway'],
		}).post(
			'/:provider/webhook',
			async ({ params, request, body }) => {
				const url = new URL(request.url);
				const outcome = await service.handleWebhook(gatewayProviderParamSchema.parse(params).provider, {
					method: request.method,
					path: `${url.pathname}${url.search}`,
					headers: request.headers,
					body,
				});
				return ok({ outcome });
			},
			{ detail: { description: 'Verified provider notification; a paid checkout records a receipt once' } },
		);
	}
}
