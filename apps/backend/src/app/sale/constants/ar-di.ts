import type { ReceiptLedgerService } from '../services/receipt-ledger.service';
import type { InjectionToken } from 'tsyringe';
import type { InvoiceService } from '../services/invoice.service';
import type { InvoiceBillingService } from '../services/invoice-billing.service';
import type { TInvoiceRepository } from '../contracts/invoice.repository.interface';
import type { IExportedInvoiceService } from '../contracts/exported-invoice.contract';
import type { IInvoicePaymentPort } from '../contracts/invoice-payment.port';

/** Token resolving to the {@link InvoiceService} (M09 F4). */
export const INVOICE_SERVICE_TOKEN: InjectionToken<InvoiceService> = Symbol(
	'INVOICE_SERVICE_TOKEN',
);

/** Token resolving to the invoice repository (`sales.invoices`). */
export const INVOICE_REPOSITORY_TOKEN: InjectionToken<TInvoiceRepository> =
	Symbol('INVOICE_REPOSITORY_TOKEN');

/** Billing an order by terms, the invoice page and voiding (M02 web, restored after PR #68). */
export const INVOICE_BILLING_SERVICE_TOKEN: InjectionToken<InvoiceBillingService> = Symbol('INVOICE_BILLING_SERVICE_TOKEN');

/** Token resolving to the `payment.gateway_payments` repository (ERP-0020). */
export const INVOICE_PAYMENT_PORT_TOKEN: InjectionToken<IInvoicePaymentPort> = Symbol(
	'INVOICE_PAYMENT_PORT_TOKEN',
);

/** Published to Accounting: invoice reads, the AR mirror totals write and the draft count. */
export const EXPORTED_INVOICE_SERVICE_TOKEN: InjectionToken<IExportedInvoiceService> =
	Symbol('EXPORTED_INVOICE_SERVICE');

/** Ledger side of a kuitansi: journal + AR open item (ERP-0139). */
export const RECEIPT_LEDGER_SERVICE_TOKEN: InjectionToken<ReceiptLedgerService> = Symbol('RECEIPT_LEDGER_SERVICE_TOKEN');
