import { InvoiceBillingService } from './services/invoice-billing.service';
import { InvoicePaymentPortService } from './services/invoice-payment.port.service';
import { QuotationRepository } from './repositories/quotation.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { QuotationService } from './services/quotation.service';
import { SalesOrderRepository } from './repositories/sales-order.repository';
import { SalesOrderService } from './services/sales-order.service';
import { SalesBillingService } from './services/sales-billing.service';
import { SalesService } from './services/sales.service';
import { DeliveryNoteRepository } from './repositories/delivery-note.repository';
import { DeliveryNoteService } from './services/delivery-note.service';
import { SalesFulfilmentService } from './services/sales-fulfilment.service';
import { InvoiceRepository } from './repositories/invoice.repository';
import { InvoiceService } from './services/invoice.service';
import { InvoiceLookupService } from './services/invoice-lookup.service';
import {
	QUOTATION_REPOSITORY_TOKEN,
	PAYMENT_REPOSITORY_TOKEN,
	QUOTATION_SERVICE_TOKEN,
	SALES_ORDER_REPOSITORY_TOKEN,
	SALES_ORDER_SERVICE_TOKEN,
	SALES_BILLING_SERVICE_TOKEN,
	SALES_SERVICE_TOKEN,
	DELIVERY_NOTE_REPOSITORY_TOKEN,
	DELIVERY_NOTE_SERVICE_TOKEN,
	SALES_FULFILMENT_SERVICE_TOKEN,
	INVOICE_LOOKUP_SERVICE_TOKEN,
} from './constants/di';
import {
	INVOICE_REPOSITORY_TOKEN,
	INVOICE_SERVICE_TOKEN,
	INVOICE_BILLING_SERVICE_TOKEN,
	INVOICE_PAYMENT_PORT_TOKEN,
} from './constants/ar-di';

import type { DependencyContainer } from 'tsyringe';

export * from './constants/di';

/**
 * Registers the sales module's repositories and service.
 *
 * @remarks
 * All bindings are class registrations on symbol tokens; consumers
 * depend on the repository/service contracts rather than concrete classes.
 *
 * @param container - The tsyringe container to populate
 */
export function registerSales(container: DependencyContainer): void {
	container.register(QUOTATION_REPOSITORY_TOKEN, {
		useClass: QuotationRepository,
	});
	container.register(PAYMENT_REPOSITORY_TOKEN, {
		useClass: PaymentRepository,
	});
	container.register(INVOICE_REPOSITORY_TOKEN, {
		useClass: InvoiceRepository,
	});
	container.register(INVOICE_SERVICE_TOKEN, { useClass: InvoiceService });
	container.register(INVOICE_BILLING_SERVICE_TOKEN, { useClass: InvoiceBillingService });
	// ADR-0023: the payment module records online receipts through this port.
	container.register(INVOICE_PAYMENT_PORT_TOKEN, { useClass: InvoicePaymentPortService });
	container.register(INVOICE_LOOKUP_SERVICE_TOKEN, {
		useClass: InvoiceLookupService,
	});
	container.register(SALES_SERVICE_TOKEN, {
		useClass: SalesService,
	});
	container.register(QUOTATION_SERVICE_TOKEN, {
		useClass: QuotationService,
	});
	container.register(SALES_ORDER_REPOSITORY_TOKEN, { useClass: SalesOrderRepository });
	container.register(SALES_ORDER_SERVICE_TOKEN, { useClass: SalesOrderService });
	container.register(SALES_BILLING_SERVICE_TOKEN, { useClass: SalesBillingService });
	container.register(DELIVERY_NOTE_REPOSITORY_TOKEN, { useClass: DeliveryNoteRepository });
	container.register(DELIVERY_NOTE_SERVICE_TOKEN, { useClass: DeliveryNoteService });
	container.register(SALES_FULFILMENT_SERVICE_TOKEN, { useClass: SalesFulfilmentService });
}
