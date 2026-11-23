/**
 * DI tokens for the accounting module (tax + ledger slices).
 *
 * @remarks
 * Every token carries the `InjectionToken<T>` annotation. A bare `Symbol()`
 * would make `container.resolve()` return `unknown`.
 *
 * The ledger is split per table (`contracts/*.repository.interface.ts`): a service
 * injects the repositories it actually queries instead of one god repository.
 */
import type { InjectionToken } from 'tsyringe';
import type { IEmployeeBankAccountRepository } from '../contracts/employee-bank-account.contract';
import type { EmployeeBankAccountService } from '../services/employee-bank-account.service';
import type { ExportedFinanceService } from '../services/exported-finance.service';
import type { IDepreciationRepository } from '../contracts/depreciation.repository.interface';
import type { DepreciationService } from '../services/depreciation.service';
import type { FinanceCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { FinanceNumberingService } from '../services/finance-numbering.service';
import type { IAccountingPeriodRepository } from '../contracts/accounting-period.repository.interface';
import type { IAccountBalanceRepository } from '../contracts/account-balance.repository.interface';
import type { IApOpenItemRepository } from '../contracts/ap-open-item.repository.interface';
import type { IArOpenItemRepository } from '../contracts/ar-open-item.repository.interface';
import type { IBankAccountLinkRepository } from '../contracts/bank-account-link.repository.interface';
import type { IBankReconciliationRepository } from '../contracts/bank-reconciliation.repository.interface';
import type { IChartOfAccountRepository } from '../contracts/chart-of-account.repository.interface';
import type { ICashBankRepository } from '../contracts/cash-bank.repository.interface';
import type { ICloseChecklistRepository } from '../contracts/close-checklist.repository.interface';
import type { IJournalRepository } from '../contracts/journal.repository.interface';
import type { IOpeningBalanceRepository } from '../contracts/opening-balance.repository.interface';
import type { ISupplierBillRepository } from '../contracts/supplier-bill.repository.interface';
import type { ISupplierBillItemRepository } from '../contracts/supplier-bill-item.repository.interface';
import type { PostingService } from '../services/posting.service';
import type { AccountService } from '../services/account.service';
import type { PeriodService } from '../services/period.service';
import type { OpeningBalanceService } from '../services/opening-balance.service';
import type { CashBankService } from '../services/cash-bank.service';


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
export const SUPPLIER_BILL_ITEM_REPOSITORY_TOKEN: InjectionToken<ISupplierBillItemRepository> = Symbol(
	'SUPPLIER_BILL_ITEM_REPOSITORY',
);
export const SUPPLIER_BILL_REPOSITORY_TOKEN: InjectionToken<ISupplierBillRepository> = Symbol(
	'SUPPLIER_BILL_REPOSITORY',
);
export const BANK_RECONCILIATION_REPOSITORY_TOKEN: InjectionToken<IBankReconciliationRepository> =
	Symbol('BANK_RECONCILIATION_REPOSITORY');
export const ACCOUNT_BALANCE_REPOSITORY_TOKEN: InjectionToken<IAccountBalanceRepository> = Symbol(
	'ACCOUNT_BALANCE_REPOSITORY',
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

/** Token resolving to the repository of `finance.code_numberings`. */
export const FINANCE_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<FinanceCodeNumberingRepository> = Symbol('FINANCE_CODE_NUMBERING_REPOSITORY');

/** Token resolving to the {@link FinanceNumberingService}. */
export const FINANCE_NUMBERING_SERVICE_TOKEN: InjectionToken<FinanceNumberingService> = Symbol('FINANCE_NUMBERING_SERVICE');

/** Token resolving to the repository of `finance.asset_depreciations`. */
export const DEPRECIATION_REPOSITORY_TOKEN: InjectionToken<IDepreciationRepository> = Symbol('DEPRECIATION_REPOSITORY');

/** Token resolving to the {@link DepreciationService}. */
export const DEPRECIATION_SERVICE_TOKEN: InjectionToken<DepreciationService> = Symbol('DEPRECIATION_SERVICE');

/** Employees' salary payee accounts in cash_bank_accounts (ERP-0119). */
export const EMPLOYEE_BANK_ACCOUNT_REPOSITORY_TOKEN: InjectionToken<IEmployeeBankAccountRepository> = Symbol(
	'EMPLOYEE_BANK_ACCOUNT_REPOSITORY',
);
export const EMPLOYEE_BANK_ACCOUNT_SERVICE_TOKEN: InjectionToken<EmployeeBankAccountService> = Symbol(
	'EMPLOYEE_BANK_ACCOUNT_SERVICE',
);

/** Repository-only facade for other modules (ERP-0122: the payslip's payee account). */
export const EXPORTED_FINANCE_SERVICE_TOKEN: InjectionToken<ExportedFinanceService> = Symbol('EXPORTED_FINANCE_SERVICE');
