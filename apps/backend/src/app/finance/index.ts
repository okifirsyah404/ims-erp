/**
 * Public entry point of the Finance module: composition-root registration,
 * the HTTP controllers, and the contract exported to Sales.
 */
export { registerFinance } from './container';
export { InvoiceController } from './controllers/invoice.controller';
export { ReceiptController } from './controllers/receipt.controller';
export { INVOICE_LOOKUP_SERVICE_TOKEN } from './constants/di';
export type { InvoiceLookupService } from './services/invoice-lookup.service';
