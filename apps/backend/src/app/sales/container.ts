import { QuotationRepository } from './repositories/quotation.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { QuotationService } from './services/quotation.service';
import { SalesService } from './services/sales.service';
import {
	QUOTATION_REPOSITORY_TOKEN,
	PAYMENT_REPOSITORY_TOKEN,
	QUOTATION_SERVICE_TOKEN,
	SALES_SERVICE_TOKEN,
} from './constants/di';
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
	container.register(SALES_SERVICE_TOKEN, {
		useClass: SalesService,
	});
	container.register(QUOTATION_SERVICE_TOKEN, {
		useClass: QuotationService,
	});
}
