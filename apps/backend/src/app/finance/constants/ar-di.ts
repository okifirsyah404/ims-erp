import type { ILedgerSettlementPort } from '../contracts/ledger-settlement.port';
import type { IArLedgerPort } from '../contracts/ar-ledger.port';
import type { InjectionToken } from 'tsyringe';
import * as accountingTokens from './di';
import type { ArAccountResolverService } from '../services/ar-account-resolver.service';
import type { SupplierBillService } from '../services/supplier-bill.service';
import type { ReportService } from '../services/report.service';
import type { BankReconciliationService } from '../services/bank-reconciliation.service';
import type { MonthEndCloseService } from '../services/month-end-close.service';
import type { ReportArchiveRepository } from '../repositories/report-archive.repository';
import type { ReportArchiveService } from '../services/report-archive.service';

/**
 * F4 tokens for the invoice/AR slice.
 *
 * @remarks
 * Aliases re-export the existing ledger/cash tokens so the sales module can
 * depend on them without importing the whole accounting `di.ts`. The
 * resolver, payment, and invoice-repository tokens are new.
 */
export const POSTING_SERVICE_TOKEN = accountingTokens.POSTING_SERVICE_TOKEN;
export const CASH_BANK_SERVICE_TOKEN = accountingTokens.CASH_BANK_SERVICE_TOKEN;
export const AR_ACCOUNT_RESOLVER_TOKEN: InjectionToken<ArAccountResolverService> =
	Symbol('AR_ACCOUNT_RESOLVER_TOKEN');
export const SUPPLIER_BILL_SERVICE_TOKEN: InjectionToken<SupplierBillService> =
	Symbol('SUPPLIER_BILL_SERVICE_TOKEN');
export const REPORT_SERVICE_TOKEN: InjectionToken<ReportService> = Symbol(
	'REPORT_SERVICE_TOKEN',
);
export const BANK_RECONCILIATION_SERVICE_TOKEN: InjectionToken<BankReconciliationService> =
	Symbol('BANK_RECONCILIATION_SERVICE_TOKEN');
export const MONTH_END_CLOSE_SERVICE_TOKEN: InjectionToken<MonthEndCloseService> =
	Symbol('MONTH_END_CLOSE_SERVICE_TOKEN');

export const REPORT_ARCHIVE_REPOSITORY_TOKEN: InjectionToken<ReportArchiveRepository> =
	Symbol('REPORT_ARCHIVE_REPOSITORY_TOKEN');
export const REPORT_ARCHIVE_SERVICE_TOKEN: InjectionToken<ReportArchiveService> =
	Symbol('REPORT_ARCHIVE_SERVICE_TOKEN');

/** ADR-0024: settlement port the payment module calls for AR/AP and cash/bank. */
export const LEDGER_SETTLEMENT_PORT_TOKEN: InjectionToken<ILedgerSettlementPort> =
	Symbol('LEDGER_SETTLEMENT_PORT_TOKEN');

/** Published to Sales: the AR open-item mirror and journal lookup (no repository). */
export const AR_LEDGER_PORT_TOKEN: InjectionToken<IArLedgerPort> = Symbol('AR_LEDGER_PORT_TOKEN');
