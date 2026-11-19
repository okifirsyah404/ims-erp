import type { DependencyContainer } from 'tsyringe';
import { ExportedPaymentWebhookService } from './services/exported-payment-webhook.service';
import { GatewayCheckoutService } from './services/gateway-checkout.service';
import { GatewayConfigService } from './services/gateway-config.service';
import { PaymentNumberingService } from './services/payment-numbering.service';
import { PaymentService } from './services/payment.service';
import { ExportedPaymentService } from './services/exported-payment.service';
import { GatewayRepository } from './repositories/gateway.repository';
import { PaymentCodeNumberingRepository } from './repositories/code-numbering.repository';
import { PaymentRepository } from './repositories/payment.repository';
import {
	EXPORTED_PAYMENT_WEBHOOK_SERVICE_TOKEN,
	GATEWAY_CHECKOUT_SERVICE_TOKEN,
	GATEWAY_CONFIG_SERVICE_TOKEN,
	GATEWAY_REPOSITORY_TOKEN,
	PAYMENT_CODE_NUMBERING_REPOSITORY_TOKEN,
	PAYMENT_LEDGER_GATEWAY_TOKEN,
	PAYMENT_NUMBERING_SERVICE_TOKEN,
	PAYMENT_REPOSITORY_TOKEN,
	PAYMENT_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the payment module (ADR-0024 Q18): the single payment ledger
 * (`payment.payments` with its polymorphic allocations), the gateway
 * configuration (`payment.gateways`, encrypted write-only secrets) and the
 * online checkouts, which are payment rows too.
 *
 * @remarks
 * Invoices and receipts stay Sale's and are reached through
 * `INVOICE_PAYMENT_PORT_TOKEN` (registered by `registerSales`); the AR/AP
 * mirrors and the cash/bank movement are Finance's, through
 * `LEDGER_SETTLEMENT_PORT_TOKEN` (registered by `registerFinance`). Both run
 * before this in `src/index.ts`.
 *
 * `PAYMENT_LEDGER_GATEWAY_TOKEN` is the only way other modules read or stamp a
 * payment, and `EXPORTED_PAYMENT_WEBHOOK_SERVICE_TOKEN` the only way the
 * `webhook` module hands a provider notification in - the repository itself
 * never leaves this module.
 *
 * @param container - The tsyringe container to populate
 */
export function registerPayment(container: DependencyContainer): void {
	container.register(GATEWAY_REPOSITORY_TOKEN, { useClass: GatewayRepository });
	container.register(GATEWAY_CONFIG_SERVICE_TOKEN, { useClass: GatewayConfigService });
	container.register(GATEWAY_CHECKOUT_SERVICE_TOKEN, { useClass: GatewayCheckoutService });

	container.register(PAYMENT_CODE_NUMBERING_REPOSITORY_TOKEN, { useClass: PaymentCodeNumberingRepository });
	container.register(PAYMENT_NUMBERING_SERVICE_TOKEN, { useClass: PaymentNumberingService });

	// The payment ledger and its published gateways.
	container.register(PAYMENT_REPOSITORY_TOKEN, { useClass: PaymentRepository });
	container.register(PAYMENT_SERVICE_TOKEN, { useClass: PaymentService });
	container.register(PAYMENT_LEDGER_GATEWAY_TOKEN, { useClass: ExportedPaymentService });
	container.register(EXPORTED_PAYMENT_WEBHOOK_SERVICE_TOKEN, { useClass: ExportedPaymentWebhookService });
}
