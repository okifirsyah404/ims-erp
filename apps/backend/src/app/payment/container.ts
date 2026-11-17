import type { DependencyContainer } from 'tsyringe';
import { GatewayPaymentRepository } from './repositories/gateway-payment.repository';
import { GatewayPaymentService } from './services/gateway-payment.service';
import { PaymentGatewayRegistry } from './adapters/payment-gateway-registry';
import {
	GATEWAY_PAYMENT_REPOSITORY_TOKEN,
	GATEWAY_PAYMENT_SERVICE_TOKEN,
	PAYMENT_GATEWAY_REGISTRY_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the payment module's repository, gateway adapters and service.
 *
 * @remarks
 * `payment.gateway_payments` is this module's own table (ADR-0023). Invoices
 * and receipts stay Sales' and are reached through
 * `INVOICE_PAYMENT_PORT_TOKEN`, registered by `registerSales`; that must run
 * first (it does, in `src/index.ts`).
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
}
