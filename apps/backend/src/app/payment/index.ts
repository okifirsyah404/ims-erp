/**
 * Public entry point of the payment module.
 *
 * @remarks
 * Owns the `payment` Postgres schema (ADR-0023, ADR-0024): the single payment
 * ledger with its allocations, plus online invoice checkouts through a
 * provider-neutral gateway (ERP-0020).
 *
 * `src/app/app.ts` mounts `paymentModule()`; `src/index.ts` calls
 * `registerPayment(container)` after `registerSales` and `registerAccounting`,
 * whose ports this module consumes.
 */
import Elysia from 'elysia';

import { GatewayPaymentController, GatewayWebhookController } from './controllers/gateway-payment.controller';
import { PaymentLedgerController } from './controllers/payment-ledger.controller';

export { registerPayment } from './container';
export {
	GATEWAY_PAYMENT_SERVICE_TOKEN,
	PAYMENT_LEDGER_GATEWAY_TOKEN,
	PAYMENT_SERVICE_TOKEN,
} from './constants/di';
export type { IPaymentLedgerGateway } from './contracts/payment-ledger.gateway.interface';
export type { IPaymentService } from './contracts/payment.service.interface';
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
		// The ledger CRUD/actions first; the gateway's own paths
		// (`/gateway-payments/status`, `/invoices/:id/gateway-payments`,
		// `/payments/gateway/:provider/webhook`) never collide with `/payments/:id`
		// (different segment count), and the public webhook stays last so a
		// guarded route is never shadowed by it.
		.use(PaymentLedgerController.plugin())
		.use(GatewayPaymentController.plugin())
		.use(GatewayWebhookController.plugin());
}
