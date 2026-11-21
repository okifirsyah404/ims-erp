/**
 * Public entry point of the payment module.
 *
 * @remarks
 * Owns the `payment` Postgres schema (ADR-0023, ADR-0024 Q18): the single
 * payment ledger with its polymorphic allocations, the gateway configuration
 * with encrypted write-only secrets, and online invoice checkouts (ERP-0020).
 * Provider webhooks are served by the `webhook` module from P7; the payment
 * module publishes `ExportedPaymentWebhookService` for it.
 *
 * `src/app/app.ts` mounts `paymentModule()`; `src/index.ts` calls
 * `registerPayment(container)` after `registerSale` and `registerFinance`,
 * whose ports this module consumes.
 */
import Elysia from 'elysia';

import { PaymentCodeNumberingController } from './controllers/code-numbering.controller';
import { GatewayCheckoutController, GatewayConfigController } from './controllers/gateway.controller';
import { PaymentLedgerController } from './controllers/payment-ledger.controller';

export { registerPayment } from './container';
export {
	EXPORTED_PAYMENT_WEBHOOK_SERVICE_TOKEN,
	GATEWAY_CHECKOUT_SERVICE_TOKEN,
	GATEWAY_CONFIG_SERVICE_TOKEN,
	PAYMENT_LEDGER_GATEWAY_TOKEN,
	PAYMENT_SERVICE_TOKEN,
} from './constants/di';
export type { IPaymentLedgerGateway } from './contracts/payment-ledger.gateway.interface';
export type { IPaymentService } from './contracts/payment.service.interface';
export { ExportedPaymentWebhookService } from './services/exported-payment-webhook.service';
export type { TWebhookDelivery, TWebhookOutcome } from './contracts/payment-gateway.contract';
export {
	PaymentAllocationMismatchError,
	PaymentCashAccountRequiredError,
	PaymentInvalidTransitionError,
	PaymentNotFoundError,
	PaymentOverAllocationError,
	PaymentTargetNotIssuedError,
	PaymentVoidNotAllowedError,
} from './errors/payment.errors';

/** Elysia instance mounting the payment controllers, in route order. */
export function paymentModule() {
	return new Elysia({ name: 'payment' })
		// Static `/code-numberings` routes: settings of this module's series.
		.use(PaymentCodeNumberingController.plugin())
		// The ledger CRUD/actions first; the checkout and admin paths have their
		// own prefixes and never collide with `/payments/:id`.
		.use(PaymentLedgerController.plugin())
		.use(GatewayCheckoutController.plugin())
		.use(GatewayConfigController.plugin());
}
