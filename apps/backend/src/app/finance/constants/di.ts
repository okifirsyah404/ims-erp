/**
 * Injection tokens of the Finance module (ADR-0011 step 3d-2).
 *
 * @remarks
 * `INVOICE_LOOKUP_SERVICE_TOKEN` is the module's exported contract for
 * Sales (has an order been billed?).
 */
import type { InjectionToken } from 'tsyringe';
import type { IInvoiceRepository } from '../contracts/invoice.repository.interface';
import type { InvoiceLookupService } from '../services/invoice-lookup.service';
import type { InvoiceService } from '../services/invoice.service';

export const INVOICE_REPOSITORY_TOKEN: InjectionToken<IInvoiceRepository> = Symbol('INVOICE_REPOSITORY');
export const INVOICE_SERVICE_TOKEN: InjectionToken<InvoiceService> = Symbol('INVOICE_SERVICE');
export const INVOICE_LOOKUP_SERVICE_TOKEN: InjectionToken<InvoiceLookupService> = Symbol('INVOICE_LOOKUP_SERVICE');
