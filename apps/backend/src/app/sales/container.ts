import { QuotationRepository } from './repositories/quotation.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { SalesService } from './services/sales.service';
import {
	QUOTATION_REPOSITORY_TOKEN,
	PAYMENT_REPOSITORY_TOKEN,
	SALES_SERVICE_TOKEN,
} from './constants/di';
import type { DependencyContainer } from 'tsyringe';

export * from './constants/di';

/**
 * Registers the sales module's repositories and service.
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
}
