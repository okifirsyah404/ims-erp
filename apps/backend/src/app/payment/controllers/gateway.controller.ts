import { container } from 'tsyringe';
import { z } from 'zod';
import { domainPlugin } from '@http/plugin';
import { created, ok } from '@http/response';
import { GATEWAY_CHECKOUT_SERVICE_TOKEN, GATEWAY_CONFIG_SERVICE_TOKEN } from '../constants/di';
import { gatewayCreateSchema, gatewayIdParamSchema, gatewayUpdateSchema } from '../contracts/gateway.contract';

/** `:id` of the invoice being paid (uuid; a malformed id is a 400, never a 500). */
const invoiceIdParamSchema = z.object({ id: z.string().uuid() });

/**
 * Online payment of invoices for staff (ERP-0020, ADR-0024 Q18): whether a
 * gateway is on, the checkouts of an invoice, and opening one to send to the
 * customer. Opening a checkout is receiving a payment, so it takes
 * `receipt:create`.
 */
export class GatewayCheckoutController {
	static plugin() {
		const service = container.resolve(GATEWAY_CHECKOUT_SERVICE_TOKEN);

		return domainPlugin({
			name: 'payment-checkouts',
			prefix: '/payments',
			tags: ['Payment'],
			guards: 'erp',
		})
			.get('/checkouts/status', async ({ erp }) => ok(await service.status(erp.organizationId)), {
				erp: { permission: ['invoice:read'] },
				detail: { description: 'Whether online payment is configured, and its provider' },
			})
			.get(
				'/checkouts/invoices/:id',
				async ({ params, erp }) => ok(await service.list(erp.organizationId, invoiceIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['invoice:read'] },
					detail: { description: 'Online payment checkouts of an invoice, newest first' },
				},
			)
			.post(
				'/checkouts/invoices/:id',
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
						description: 'Opens (or reuses) a hosted checkout of the outstanding amount at the default gateway',
					},
				},
			);
	}
}

/**
 * Gateway configuration (`/admin/payments/gateways`). Secrets are write-only:
 * the API never returns the ciphertext or the plaintext, only `hasSecret` and
 * the last four characters.
 */
export class GatewayConfigController {
	static plugin() {
		const service = container.resolve(GATEWAY_CONFIG_SERVICE_TOKEN);
		const id = (params: unknown) => gatewayIdParamSchema.parse(params).id;

		return domainPlugin({
			name: 'payment-gateways',
			prefix: '/admin/payments/gateways',
			tags: ['Payment'],
			guards: 'erp',
		})
			.get('', async ({ erp }) => ok(await service.list(erp.organizationId)), {
				erp: { permission: ['payment_gateway:read'] },
				detail: { description: 'Configured gateways, without their secrets' },
			})
			.post(
				'',
				async ({ body, erp, status }) =>
					status(
						201,
						created(await service.create(erp.organizationId, gatewayCreateSchema.parse(body), erp.session.user.id)),
					),
				{
					erp: { permission: ['payment_gateway:update'] },
					detail: { description: 'Adds a gateway; its secret is sealed with the payment secret key' },
				},
			)
			.patch(
				'/:id',
				async ({ params, body, erp }) => ok(await service.update(erp.organizationId, id(params), gatewayUpdateSchema.parse(body))),
				{
					erp: { permission: ['payment_gateway:update'] },
					detail: { description: 'Edits a gateway; a new secret is sealed and the old one dropped' },
				},
			)
			.post(
				'/:id/default',
				async ({ params, erp }) => ok(await service.setDefault(erp.organizationId, id(params))),
				{
					erp: { permission: ['payment_gateway:update'] },
					detail: { description: 'Makes this gateway the one that opens new checkouts' },
				},
			);
	}
}
