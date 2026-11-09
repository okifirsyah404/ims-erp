import type { InjectionToken } from 'tsyringe';
import type { InvoiceService } from '../services/invoice.service';
import type { TInvoiceRepository } from '../contracts/invoice.repository.interface';

/** Token resolving to the {@link InvoiceService} (M09 F4). */
export const INVOICE_SERVICE_TOKEN: InjectionToken<InvoiceService> = Symbol(
	'INVOICE_SERVICE_TOKEN',
);

/** Token resolving to the invoice repository (`sales.invoices`). */
export const INVOICE_REPOSITORY_TOKEN: InjectionToken<TInvoiceRepository> =
	Symbol('INVOICE_REPOSITORY_TOKEN');
