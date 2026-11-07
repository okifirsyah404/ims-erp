import { QuotationRepository } from './repositories/quotation.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { InvoiceRepository } from './repositories/invoice.repository';
import { SalesService } from './services/sales.service';
import { InvoiceService } from './services/invoice.service';
import {
	QUOTATION_REPOSITORY_TOKEN,
	PAYMENT_REPOSITORY_TOKEN,
	SALES_SERVICE_TOKEN,
} from './constants/di';
import { INVOICE_SERVICE_TOKEN } from './constants/ar-di';
import { INVOICE_REPOSITORY_TOKEN } from '../accounting/constants/ar-di';
import type { DependencyContainer } from 'tsyringe';

export * from './constants/di';

/**
 * Registers the sales module's repositories and service.
 *
 * @remarks
 * All three bindings are class registrations on symbol tokens; consumers
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
	container.register(SALES_SERVICE_TOKEN, {
		useClass: SalesService,
	});
}
