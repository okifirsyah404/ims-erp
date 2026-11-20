/**
 * Injection tokens for the sales module's repositories and service.
 *
 * @remarks
 * Kept in a standalone constants module so services and the composition
 * root can both import them without a circular dependency.
 *
 * Every token carries an `InjectionToken<T>` annotation, so
 * `container.register(TOKEN, { useClass })` type-checks the implementation
 * against the contract it must satisfy and
 * `container.resolve<T>(TOKEN)` can infer `T` instead of `unknown`. Without
 * the annotation a mistyped token still compiles and only fails at runtime
 * with a tsyringe "cannot resolve" error.
 */
import type { InjectionToken } from 'tsyringe';
import type { SaleCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { ExportedOrderService } from '../services/exported-order.service';
import type { SaleNumberingService } from '../services/sale-numbering.service';
import type { IQuotationRepository } from '../contracts/quotation.repository.interface';
import type { QuotationService } from '../services/quotation.service';
import type { ISalesOrderRepository } from '../contracts/sales-order.repository.interface';
import type { SalesOrderService } from '../services/sales-order.service';
import type { ISalesReturnRepository } from '../contracts/sales-return.repository.interface';
import type { SalesReturnService } from '../services/sales-return.service';
import type { SalesBillingService } from '../services/sales-billing.service';
import type { IDeliveryNoteRepository } from '../contracts/delivery-note.repository.interface';
import type { DeliveryNoteService } from '../services/delivery-note.service';
import type { SalesFulfilmentService } from '../services/sales-fulfilment.service';
import type { InvoiceLookupService } from '../services/invoice-lookup.service';
import type { QuotationDeliveryService } from '../services/quotation-delivery.service';
import type { IQuotationSentDispatcher } from '../queues/quotation-sent.queue';

/**
 * Sales contract for other modules (licensing, paid totals): whether an order
 * has been billed, and money received on its live invoices.
 */
export const INVOICE_LOOKUP_SERVICE_TOKEN: InjectionToken<InvoiceLookupService> = Symbol(
	'INVOICE_LOOKUP_SERVICE',
);

/** Token resolving to the quotation repository implementation. */
export const QUOTATION_REPOSITORY_TOKEN: InjectionToken<IQuotationRepository> =
	Symbol('QUOTATION_REPOSITORY_TOKEN');

/** Token resolving to the {@link QuotationService} implementation. */
export const QUOTATION_SERVICE_TOKEN: InjectionToken<QuotationService> = Symbol('QUOTATION_SERVICE_TOKEN');

/** Token resolving to the sales order repository implementation. */
export const SALES_ORDER_REPOSITORY_TOKEN: InjectionToken<ISalesOrderRepository> = Symbol('SALES_ORDER_REPOSITORY_TOKEN');

/** Token resolving to the {@link SalesOrderService} implementation. */
export const SALES_ORDER_SERVICE_TOKEN: InjectionToken<SalesOrderService> = Symbol('SALES_ORDER_SERVICE_TOKEN');

/** Token resolving to the {@link SalesBillingService} (Sales contract for Finance). */
export const SALES_BILLING_SERVICE_TOKEN: InjectionToken<SalesBillingService> = Symbol('SALES_BILLING_SERVICE_TOKEN');

/** Token resolving to the delivery note repository implementation. */
export const DELIVERY_NOTE_REPOSITORY_TOKEN: InjectionToken<IDeliveryNoteRepository> = Symbol('DELIVERY_NOTE_REPOSITORY_TOKEN');

/** Token resolving to the {@link DeliveryNoteService} implementation. */
export const DELIVERY_NOTE_SERVICE_TOKEN: InjectionToken<DeliveryNoteService> = Symbol('DELIVERY_NOTE_SERVICE_TOKEN');

/** Token resolving to the sales return repository implementation (ERP-0065). */
export const SALES_RETURN_REPOSITORY_TOKEN: InjectionToken<ISalesReturnRepository> = Symbol('SALES_RETURN_REPOSITORY_TOKEN');

/** Token resolving to the {@link SalesReturnService} implementation (ERP-0065). */
export const SALES_RETURN_SERVICE_TOKEN: InjectionToken<SalesReturnService> = Symbol('SALES_RETURN_SERVICE_TOKEN');

/** Token resolving to the {@link SalesFulfilmentService} (Sales contract for Projects). */
export const SALES_FULFILMENT_SERVICE_TOKEN: InjectionToken<SalesFulfilmentService> = Symbol('SALES_FULFILMENT_SERVICE_TOKEN');

/** Token resolving to the {@link QuotationDeliveryService} (SPH PDF + `quotation.sent`, ERP-0067). */
export const QUOTATION_DELIVERY_SERVICE_TOKEN: InjectionToken<QuotationDeliveryService> = Symbol('QUOTATION_DELIVERY_SERVICE_TOKEN');

/** Token resolving to the queue that delivers sent quotations (ERP-0067). */
export const QUOTATION_SENT_DISPATCHER_TOKEN: InjectionToken<IQuotationSentDispatcher> = Symbol('QUOTATION_SENT_DISPATCHER_TOKEN');

/** Token resolving to the repository of `sale.code_numberings`. */
export const SALE_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<SaleCodeNumberingRepository> = Symbol('SALE_CODE_NUMBERING_REPOSITORY_TOKEN');

/** Token resolving to the {@link SaleNumberingService}. */
export const SALE_NUMBERING_SERVICE_TOKEN: InjectionToken<SaleNumberingService> = Symbol('SALE_NUMBERING_SERVICE_TOKEN');

/** Token resolving to the {@link ExportedOrderService} (repository-only facade for project). */
export const EXPORTED_ORDER_SERVICE_TOKEN: InjectionToken<ExportedOrderService> = Symbol('EXPORTED_ORDER_SERVICE_TOKEN');
