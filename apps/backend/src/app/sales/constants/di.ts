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
import type { SalesService } from '../services/sales.service';
import type { IQuotationRepository } from '../contracts/quotation.repository.interface';
import type { QuotationService } from '../services/quotation.service';
import type { ISalesOrderRepository } from '../contracts/sales-order.repository.interface';
import type { SalesOrderService } from '../services/sales-order.service';
import type { TPaymentRepository } from '../contracts/payment.repository.interface';

/** Token resolving to the {@link SalesService} implementation. */
export const SALES_SERVICE_TOKEN: InjectionToken<SalesService> = Symbol(
	'SALES_SERVICE_TOKEN',
);

/** Token resolving to the quotation repository implementation. */
export const QUOTATION_REPOSITORY_TOKEN: InjectionToken<IQuotationRepository> =
	Symbol('QUOTATION_REPOSITORY_TOKEN');

/** Token resolving to the payment repository implementation. */
export const PAYMENT_REPOSITORY_TOKEN: InjectionToken<TPaymentRepository> =
	Symbol('PAYMENT_REPOSITORY_TOKEN');

/** Token resolving to the {@link QuotationService} implementation. */
export const QUOTATION_SERVICE_TOKEN: InjectionToken<QuotationService> = Symbol('QUOTATION_SERVICE_TOKEN');

/** Token resolving to the sales order repository implementation. */
export const SALES_ORDER_REPOSITORY_TOKEN: InjectionToken<ISalesOrderRepository> = Symbol('SALES_ORDER_REPOSITORY_TOKEN');

/** Token resolving to the {@link SalesOrderService} implementation. */
export const SALES_ORDER_SERVICE_TOKEN: InjectionToken<SalesOrderService> = Symbol('SALES_ORDER_SERVICE_TOKEN');
