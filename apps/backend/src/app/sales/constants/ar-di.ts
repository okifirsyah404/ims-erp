import type { InjectionToken } from 'tsyringe';
import type { InvoiceService } from '../services/invoice.service';
import type { InvoiceBillingService } from '../services/invoice-billing.service';
import type { TInvoiceRepository } from '../contracts/invoice.repository.interface';
import type { IGatewayPaymentRepository, IPaymentGatewayRegistry } from '../contracts/payment-gateway.contract';
import type { GatewayPaymentService } from '../services/gateway-payment.service';

/** Token resolving to the {@link InvoiceService} (M09 F4). */
export const INVOICE_SERVICE_TOKEN: InjectionToken<InvoiceService> = Symbol(
	'INVOICE_SERVICE_TOKEN',
);

/** Token resolving to the invoice repository (`sales.invoices`). */
export const INVOICE_REPOSITORY_TOKEN: InjectionToken<TInvoiceRepository> =
	Symbol('INVOICE_REPOSITORY_TOKEN');

/** Billing an order by terms, the invoice page and voiding (M02 web, restored after PR #68). */
export const INVOICE_BILLING_SERVICE_TOKEN: InjectionToken<InvoiceBillingService> = Symbol('INVOICE_BILLING_SERVICE_TOKEN');

/** Token resolving to the `sales.gateway_payments` repository (ERP-0020). */
export const GATEWAY_PAYMENT_REPOSITORY_TOKEN: InjectionToken<IGatewayPaymentRepository> = Symbol(
	'GATEWAY_PAYMENT_REPOSITORY_TOKEN',
);

/** Token resolving to the configured payment gateways (ADR-0019 port). */
export const PAYMENT_GATEWAY_REGISTRY_TOKEN: InjectionToken<IPaymentGatewayRegistry> = Symbol(
	'PAYMENT_GATEWAY_REGISTRY_TOKEN',
);

/** Token resolving to the {@link GatewayPaymentService}. */
export const GATEWAY_PAYMENT_SERVICE_TOKEN: InjectionToken<GatewayPaymentService> = Symbol(
	'GATEWAY_PAYMENT_SERVICE_TOKEN',
);
