import type { InjectionToken } from 'tsyringe';
import * as accountingTokens from './di';
import type { ArAccountResolverService } from '../services/ar-account-resolver.service';
import type { PaymentService } from '../services/payment.service';
import type { SupplierBillService } from '../services/supplier-bill.service';
import type { TInvoiceRepository } from '@app/sales/contracts/invoice.repository.interface';

/**
 * F4 tokens for the invoice/AR slice.
 *
 * @remarks
 * Aliases re-export the existing ledger/cash tokens so the sales module can
 * depend on them without importing the whole accounting `di.ts`. The
 * resolver, payment, and invoice-repository tokens are new.
 */
export const LEDGER_REPOSITORY_TOKEN = accountingTokens.LEDGER_REPOSITORY_TOKEN;
export const POSTING_SERVICE_TOKEN = accountingTokens.POSTING_SERVICE_TOKEN;
export const CASH_BANK_SERVICE_TOKEN = accountingTokens.CASH_BANK_SERVICE_TOKEN;
export const AR_ACCOUNT_RESOLVER_TOKEN: InjectionToken<ArAccountResolverService> =
	Symbol('AR_ACCOUNT_RESOLVER_TOKEN');
export const PAYMENT_SERVICE_TOKEN: InjectionToken<PaymentService> = Symbol(
	'PAYMENT_SERVICE_TOKEN',
);
export const INVOICE_REPOSITORY_TOKEN: InjectionToken<TInvoiceRepository> =
	Symbol('INVOICE_REPOSITORY_TOKEN');
export const SUPPLIER_BILL_SERVICE_TOKEN: InjectionToken<SupplierBillService> =
	Symbol('SUPPLIER_BILL_SERVICE_TOKEN');
