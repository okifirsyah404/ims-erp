import type { InjectionToken } from 'tsyringe';
import type { InvoiceService } from '../services/invoice.service';

/** Token resolving to the {@link InvoiceService} (M09 F4). */
export const INVOICE_SERVICE_TOKEN: InjectionToken<InvoiceService> = Symbol(
	'INVOICE_SERVICE_TOKEN',
);
