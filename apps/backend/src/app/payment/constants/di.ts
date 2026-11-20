import type { InjectionToken } from 'tsyringe';
import type { IGatewayRepository } from '../contracts/gateway.repository.interface';
import type { IPaymentLedgerGateway } from '../contracts/payment-ledger.gateway.interface';
import type { IPaymentRepository } from '../contracts/payment.repository.interface';
import type { IPaymentService } from '../contracts/payment.service.interface';
import type { PaymentCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { ExportedPaymentWebhookService } from '../services/exported-payment-webhook.service';
import type { GatewayCheckoutService } from '../services/gateway-checkout.service';
import type { GatewayConfigService } from '../services/gateway-config.service';
import type { PaymentNumberingService } from '../services/payment-numbering.service';

/** Token resolving to the repository of `payment.gateways` (provider configuration). */
export const GATEWAY_REPOSITORY_TOKEN: InjectionToken<IGatewayRepository> = Symbol('GATEWAY_REPOSITORY_TOKEN');

/** Token resolving to the {@link GatewayConfigService} (encrypted, write-only secrets). */
export const GATEWAY_CONFIG_SERVICE_TOKEN: InjectionToken<GatewayConfigService> = Symbol(
	'GATEWAY_CONFIG_SERVICE_TOKEN',
);

/** Token resolving to the {@link GatewayCheckoutService} (online checkouts of payables). */
export const GATEWAY_CHECKOUT_SERVICE_TOKEN: InjectionToken<GatewayCheckoutService> = Symbol(
	'GATEWAY_CHECKOUT_SERVICE_TOKEN',
);

/** Token resolving to the payment ledger service (ADR-0024). */
export const PAYMENT_SERVICE_TOKEN: InjectionToken<IPaymentService> = Symbol('PAYMENT_SERVICE_TOKEN');

/** Token resolving to the payment ledger repository (`payment.payments`). */
export const PAYMENT_REPOSITORY_TOKEN: InjectionToken<IPaymentRepository> = Symbol('PAYMENT_REPOSITORY_TOKEN');

/** Published to other modules: read/count/stamp payments without touching `payment.*` (ADR-0024). */
export const PAYMENT_LEDGER_GATEWAY_TOKEN: InjectionToken<IPaymentLedgerGateway> = Symbol(
	'PAYMENT_LEDGER_GATEWAY_TOKEN',
);

/** Published to the `webhook` module: verified, idempotent provider notifications (ADR-0024 Q38). */
export const EXPORTED_PAYMENT_WEBHOOK_SERVICE_TOKEN: InjectionToken<ExportedPaymentWebhookService> = Symbol(
	'EXPORTED_PAYMENT_WEBHOOK_SERVICE_TOKEN',
);

/** Token resolving to the repository of `payment.code_numberings`. */
export const PAYMENT_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<PaymentCodeNumberingRepository> = Symbol(
	'PAYMENT_CODE_NUMBERING_REPOSITORY_TOKEN',
);

/** Token resolving to the {@link PaymentNumberingService}. */
export const PAYMENT_NUMBERING_SERVICE_TOKEN: InjectionToken<PaymentNumberingService> = Symbol(
	'PAYMENT_NUMBERING_SERVICE_TOKEN',
);
