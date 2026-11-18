import type { DependencyContainer } from 'tsyringe';
import { GatewayPaymentRepository } from './repositories/gateway-payment.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { GatewayPaymentService } from './services/gateway-payment.service';
import { PaymentService } from './services/payment.service';
import { ExportedPaymentService } from './services/exported-payment.service';
import { PaymentGatewayRegistry } from './adapters/payment-gateway-registry';
import {
	GATEWAY_PAYMENT_REPOSITORY_TOKEN,
	GATEWAY_PAYMENT_SERVICE_TOKEN,
	PAYMENT_GATEWAY_REGISTRY_TOKEN,
	PAYMENT_LEDGER_GATEWAY_TOKEN,
	PAYMENT_REPOSITORY_TOKEN,
	PAYMENT_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the payment module: the single payment ledger (`payment.payments`
 * with its allocations, ADR-0024) and the online gateway checkouts
 * (`payment.gateway_payments`, ERP-0020).
 *
 * @remarks
 * Invoices and receipts stay Sales' and are reached through
 * `INVOICE_PAYMENT_PORT_TOKEN` (registered by `registerSales`); the AR/AP
 * mirrors and the cash/bank movement are Accounting's, through
 * `LEDGER_SETTLEMENT_PORT_TOKEN` (registered by `registerAccounting`). Both run
 * before this in `src/index.ts`.
 *
 * `PAYMENT_LEDGER_GATEWAY_TOKEN` is the only way other modules read or stamp a
 * payment — the repository itself never leaves this module.
 *
 * @param container - The tsyringe container to populate
 */
export function registerPayment(container: DependencyContainer): void {
	// ERP-0020: providers are built from configuration once (cached token, etc.).
	container.register(PAYMENT_GATEWAY_REGISTRY_TOKEN, {
		useValue: new PaymentGatewayRegistry(),
	});
	container.register(GATEWAY_PAYMENT_REPOSITORY_TOKEN, { useClass: GatewayPaymentRepository });
	container.register(GATEWAY_PAYMENT_SERVICE_TOKEN, { useClass: GatewayPaymentService });

	// ADR-0024: the payment ledger and its published gateway.
	container.register(PAYMENT_REPOSITORY_TOKEN, { useClass: PaymentRepository });
	container.register(PAYMENT_SERVICE_TOKEN, { useClass: PaymentService });
	container.register(PAYMENT_LEDGER_GATEWAY_TOKEN, { useClass: ExportedPaymentService });
}
