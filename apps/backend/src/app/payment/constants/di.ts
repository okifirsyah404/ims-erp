import type { InjectionToken } from 'tsyringe';
import type { GatewayPaymentService } from '../services/gateway-payment.service';
import type { IGatewayPaymentRepository, IPaymentGatewayRegistry } from '../contracts/payment-gateway.contract';

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
