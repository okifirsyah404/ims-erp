import type { DependencyContainer } from 'tsyringe';
import {
	INVOICE_LOOKUP_SERVICE_TOKEN,
	INVOICE_REPOSITORY_TOKEN,
	INVOICE_SERVICE_TOKEN,
} from './constants/di';
import { InvoiceRepository } from './repositories/invoice.repository';
import { InvoiceLookupService } from './services/invoice-lookup.service';
import { InvoiceService } from './services/invoice.service';

export * from './constants/di';

/** Registers the Finance module's repositories and services. */
export function registerFinance(container: DependencyContainer): void {
	container.register(INVOICE_REPOSITORY_TOKEN, { useClass: InvoiceRepository });
	container.register(INVOICE_SERVICE_TOKEN, { useClass: InvoiceService });
	container.register(INVOICE_LOOKUP_SERVICE_TOKEN, { useClass: InvoiceLookupService });
}
