/**
 * Public entry point of the payment module (ERP-0020, ADR-0023).
 *
 * @remarks
 * Online checkout of sales invoices through a provider-neutral gateway.
 * `src/app/app.ts` mounts `paymentModule()`; `src/index.ts` calls
 * `registerPayment(container)` after `registerSales` (the invoice/receipt port
 * comes from Sales).
 */
import Elysia from 'elysia';

import { GatewayPaymentController, GatewayWebhookController } from './controllers/gateway-payment.controller';

export { registerPayment } from './container';
export { GATEWAY_PAYMENT_SERVICE_TOKEN } from './constants/di';

/** Elysia instance mounting the payment controllers. */
export function paymentModule() {
	return new Elysia({ name: 'payment' })
		.use(GatewayPaymentController.plugin())
		.use(GatewayWebhookController.plugin());
}
