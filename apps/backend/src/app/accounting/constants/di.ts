/**
 * DI tokens for the accounting module (tax + ledger slices).
 *
 * @remarks
 * Every token carries the `InjectionToken<T>` annotation. A bare `Symbol()`
 * would make `container.resolve()` return `unknown`.
 *
 * The ledger is split per table (`contracts/ledger.repositories.ts`): a service
 * injects the repositories it actually queries instead of one god repository.
 */
import type { InjectionToken } from 'tsyringe';
import type { TTaxRepository } from '../contracts/tax.repository.interface';
import type {
	IAccountingPeriodRepository,
	IAccountBalanceRepository,
	IApOpenItemRepository,
	IArOpenItemRepository,
	IBankAccountLinkRepository,
	IBankReconciliationRepository,
	IChartOfAccountRepository,
	ICashBankRepository,
	ICloseChecklistRepository,
	IInvoiceMirrorRepository,
	IJournalRepository,
	IOpeningBalanceRepository,
	ISupplierBillRepository,
} from '../contracts/ledger.repositories';
import type { TaxService } from '../services/tax.service';
import type { PostingService } from '../services/posting.service';
import type { AccountService } from '../services/account.service';
import type { PeriodService } from '../services/period.service';
import type { OpeningBalanceService } from '../services/opening-balance.service';
import type { CashBankService } from '../services/cash-bank.service';

export const TAX_REPOSITORY_TOKEN: InjectionToken<TTaxRepository> = Symbol('TAX_REPOSITORY');
export const TAX_SERVICE_TOKEN: InjectionToken<TaxService> = Symbol('TAX_SERVICE');

/* --------------------------- ledger repositories --------------------------- */

export const CHART_OF_ACCOUNT_REPOSITORY_TOKEN: InjectionToken<IChartOfAccountRepository> = Symbol(
	'CHART_OF_ACCOUNT_REPOSITORY',
);
export const ACCOUNTING_PERIOD_REPOSITORY_TOKEN: InjectionToken<IAccountingPeriodRepository> =
	Symbol('ACCOUNTING_PERIOD_REPOSITORY');
export const JOURNAL_REPOSITORY_TOKEN: InjectionToken<IJournalRepository> =
	Symbol('JOURNAL_REPOSITORY');
export const OPENING_BALANCE_REPOSITORY_TOKEN: InjectionToken<IOpeningBalanceRepository> = Symbol(
	'OPENING_BALANCE_REPOSITORY',
);
export const BANK_ACCOUNT_LINK_REPOSITORY_TOKEN: InjectionToken<IBankAccountLinkRepository> =
	Symbol('BANK_ACCOUNT_LINK_REPOSITORY');
export const CASH_BANK_REPOSITORY_TOKEN: InjectionToken<ICashBankRepository> = Symbol(
	'CASH_BANK_REPOSITORY',
);
export const AR_OPEN_ITEM_REPOSITORY_TOKEN: InjectionToken<IArOpenItemRepository> = Symbol(
	'AR_OPEN_ITEM_REPOSITORY',
);
export const AP_OPEN_ITEM_REPOSITORY_TOKEN: InjectionToken<IApOpenItemRepository> = Symbol(
	'AP_OPEN_ITEM_REPOSITORY',
);
export const SUPPLIER_BILL_REPOSITORY_TOKEN: InjectionToken<ISupplierBillRepository> = Symbol(
	'SUPPLIER_BILL_REPOSITORY',
);
export const BANK_RECONCILIATION_REPOSITORY_TOKEN: InjectionToken<IBankReconciliationRepository> =
	Symbol('BANK_RECONCILIATION_REPOSITORY');
export const ACCOUNT_BALANCE_REPOSITORY_TOKEN: InjectionToken<IAccountBalanceRepository> = Symbol(
	'ACCOUNT_BALANCE_REPOSITORY',
);
export const INVOICE_MIRROR_REPOSITORY_TOKEN: InjectionToken<IInvoiceMirrorRepository> = Symbol(
	'INVOICE_MIRROR_REPOSITORY',
);
export const CLOSE_CHECKLIST_REPOSITORY_TOKEN: InjectionToken<ICloseChecklistRepository> = Symbol(
	'CLOSE_CHECKLIST_REPOSITORY',
);

/* --------------------------------- services --------------------------------- */

export const POSTING_SERVICE_TOKEN: InjectionToken<PostingService> = Symbol('POSTING_SERVICE');
export const ACCOUNT_SERVICE_TOKEN: InjectionToken<AccountService> = Symbol('ACCOUNT_SERVICE');
export const PERIOD_SERVICE_TOKEN: InjectionToken<PeriodService> = Symbol('PERIOD_SERVICE');
export const OPENING_BALANCE_SERVICE_TOKEN: InjectionToken<OpeningBalanceService> = Symbol(
	'OPENING_BALANCE_SERVICE',
);
export const CASH_BANK_SERVICE_TOKEN: InjectionToken<CashBankService> = Symbol('CASH_BANK_SERVICE');
