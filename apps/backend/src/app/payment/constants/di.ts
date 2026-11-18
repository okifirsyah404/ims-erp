import type { InjectionToken } from 'tsyringe';
import type { GatewayPaymentService } from '../services/gateway-payment.service';
import type { IGatewayPaymentRepository, IPaymentGatewayRegistry } from '../contracts/payment-gateway.contract';
import type { IPaymentRepository } from '../contracts/payment.repository.interface';
import type { IPaymentService } from '../contracts/payment.service.interface';
import type { IPaymentLedgerGateway } from '../contracts/payment-ledger.gateway.interface';

/** Token resolving to the `payment.gateway_payments` repository (ERP-0020). */
export const GATEWAY_PAYMENT_REPOSITORY_TOKEN: InjectionToken<IGatewayPaymentRepository> = Symbol(
	'GATEWAY_PAYMENT_REPOSITORY_TOKEN',
);

/** Token resolving to the configured payment gateways (ADR-0021 port). */
export const PAYMENT_GATEWAY_REGISTRY_TOKEN: InjectionToken<IPaymentGatewayRegistry> = Symbol(
	'PAYMENT_GATEWAY_REGISTRY_TOKEN',
);

/** Token resolving to the {@link GatewayPaymentService}. */
export const GATEWAY_PAYMENT_SERVICE_TOKEN: InjectionToken<GatewayPaymentService> = Symbol(
	'GATEWAY_PAYMENT_SERVICE_TOKEN',
);

/** Token resolving to the payment ledger service (ADR-0024). */
export const PAYMENT_SERVICE_TOKEN: InjectionToken<IPaymentService> = Symbol('PAYMENT_SERVICE_TOKEN');

/** Token resolving to the payment ledger repository (`payment.payments`). */
export const PAYMENT_REPOSITORY_TOKEN: InjectionToken<IPaymentRepository> = Symbol('PAYMENT_REPOSITORY_TOKEN');

/** Published to other modules: read/count/stamp payments without touching `payment.*` (ADR-0024). */
export const PAYMENT_LEDGER_GATEWAY_TOKEN: InjectionToken<IPaymentLedgerGateway> = Symbol(
	'PAYMENT_LEDGER_GATEWAY_TOKEN',
);
