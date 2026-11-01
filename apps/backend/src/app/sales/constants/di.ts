/**
 * Injection tokens for the sales module's repositories and service.
 *
 * @remarks
 * Kept in a standalone constants module so services and the composition
 * root can both import them without a circular dependency.
 */

/** Token resolving to the {@link SalesService} implementation. */
export const SALES_SERVICE_TOKEN = Symbol('SALES_SERVICE_TOKEN');

/** Token resolving to the quotation repository implementation. */
export const QUOTATION_REPOSITORY_TOKEN = Symbol('QUOTATION_REPOSITORY_TOKEN');

/** Token resolving to the payment repository implementation. */
export const PAYMENT_REPOSITORY_TOKEN = Symbol('PAYMENT_REPOSITORY_TOKEN');
