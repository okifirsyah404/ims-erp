import type { ICashForecastRepository } from '../contracts/cash-forecast.contract';
import type { CashForecastService } from '../services/cash-forecast.service';
import type { IStatementRepository } from '../contracts/statement.contract';
import type { StatementService } from '../services/statement.service';
import type { ICostReportRepository } from '../contracts/cost-report.contract';
import type { CostReportService } from '../services/cost-report.service';
import type { IProjectBudgetRepository } from '../contracts/project-budget.contract';
import type { ProjectBudgetService } from '../services/project-budget.service';
import type { IFixedAssetBookRepository } from '../contracts/fixed-asset.contract';
import type { FixedAssetService } from '../services/fixed-asset.service';
import type { IEmployeeAdvanceRepository } from '../contracts/employee-advance.contract';
import type { EmployeeAdvanceService } from '../services/employee-advance.service';
import type { IOpeningSubledgerRepository } from '../contracts/opening-subledger.contract';
import type { OpeningSubledgerService } from '../services/opening-subledger.service';
import type { PayrollLedgerService } from '../services/payroll-ledger.service';
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
import type { AuditWriter } from '@shared/audit';
import type { ICostCenterRepository } from '../contracts/cost-center.repository.interface';
import type { IPostingRuleRepository } from '../contracts/posting-rule.repository.interface';
import type { CostCenterService } from '../services/cost-center.service';
import type { PostingRuleService } from '../services/posting-rule.service';
import type { ManualJournalService } from '../services/manual-journal.service';
import type { ICreditMemoRepository } from '../contracts/credit-memo.repository.interface';
import type { IDeferredRevenueRepository } from '../contracts/deferred-revenue.repository.interface';
import type { IDeferredRevenuePort } from '../contracts/deferred-revenue.port';
import type { DeferredRevenueService } from '../services/deferred-revenue.service';
import type { ReceivableAdjustmentService } from '../services/receivable-adjustment.service';
import type { GatewaySettlementService } from '../services/gateway-settlement.service';
import type { TaxLedgerService } from '../services/tax-ledger.service';
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
import type { IExpenseClaimRepository } from '../contracts/expense-claim.repository.interface';
import type { ExpenseClaimService } from '../services/expense-claim.service';
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
/** Token resolving to the repository of `finance.expense_claims(._items)`. */
export const EXPENSE_CLAIM_REPOSITORY_TOKEN: InjectionToken<IExpenseClaimRepository> =
	Symbol('EXPENSE_CLAIM_REPOSITORY');

/* --------------------------------- services --------------------------------- */

export const POSTING_SERVICE_TOKEN: InjectionToken<PostingService> = Symbol('POSTING_SERVICE');
export const ACCOUNT_SERVICE_TOKEN: InjectionToken<AccountService> = Symbol('ACCOUNT_SERVICE');
export const PERIOD_SERVICE_TOKEN: InjectionToken<PeriodService> = Symbol('PERIOD_SERVICE');
export const OPENING_BALANCE_SERVICE_TOKEN: InjectionToken<OpeningBalanceService> = Symbol(
	'OPENING_BALANCE_SERVICE',
);
export const CASH_BANK_SERVICE_TOKEN: InjectionToken<CashBankService> = Symbol('CASH_BANK_SERVICE');

/** Token resolving to the {@link ExpenseClaimService} (ERP-0013). */
export const EXPENSE_CLAIM_SERVICE_TOKEN: InjectionToken<ExpenseClaimService> = Symbol(
	'EXPENSE_CLAIM_SERVICE',
);

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

/* ---------------------- GL foundation (ERP-0127..0130) ---------------------- */

/** Repository of `finance.cost_centers` (ERP-0127). */
export const COST_CENTER_REPOSITORY_TOKEN: InjectionToken<ICostCenterRepository> = Symbol(
	'COST_CENTER_REPOSITORY',
);
/** Repository of `finance.posting_rules` (ERP-0128). */
export const POSTING_RULE_REPOSITORY_TOKEN: InjectionToken<IPostingRuleRepository> = Symbol(
	'POSTING_RULE_REPOSITORY',
);
export const COST_CENTER_SERVICE_TOKEN: InjectionToken<CostCenterService> = Symbol('COST_CENTER_SERVICE');
export const POSTING_RULE_SERVICE_TOKEN: InjectionToken<PostingRuleService> = Symbol('POSTING_RULE_SERVICE');
/** Manual journal lifecycle with maker-checker (ERP-0129). */
export const MANUAL_JOURNAL_SERVICE_TOKEN: InjectionToken<ManualJournalService> = Symbol(
	'MANUAL_JOURNAL_SERVICE',
);
/** Finance's audit trail writer (ADR-0030 §7). */
export const FINANCE_AUDIT_WRITER_TOKEN: InjectionToken<AuditWriter> = Symbol('FINANCE_AUDIT_WRITER');

/* ----------------------------- AR postings (ERP-0135) ----------------------------- */

export const CREDIT_MEMO_REPOSITORY_TOKEN: InjectionToken<ICreditMemoRepository> = Symbol('CREDIT_MEMO_REPOSITORY');
export const DEFERRED_REVENUE_REPOSITORY_TOKEN: InjectionToken<IDeferredRevenueRepository> = Symbol(
	'DEFERRED_REVENUE_REPOSITORY',
);
export const DEFERRED_REVENUE_SERVICE_TOKEN: InjectionToken<DeferredRevenueService> = Symbol('DEFERRED_REVENUE_SERVICE');
/** Contract the sale module calls to open/cancel deferred-revenue schedules. */
export const DEFERRED_REVENUE_PORT_TOKEN: InjectionToken<IDeferredRevenuePort> = Symbol('DEFERRED_REVENUE_PORT');
export const RECEIVABLE_ADJUSTMENT_SERVICE_TOKEN: InjectionToken<ReceivableAdjustmentService> = Symbol(
	'RECEIVABLE_ADJUSTMENT_SERVICE',
);

/** Payment-gateway settlement: net payout + fee against gateway clearing (ERP-0139). */
export const GATEWAY_SETTLEMENT_SERVICE_TOKEN: InjectionToken<GatewaySettlementService> = Symbol(
	'GATEWAY_SETTLEMENT_SERVICE',
);

/** PPN period settlement and tax payments (ERP-0140). */
export const TAX_LEDGER_SERVICE_TOKEN: InjectionToken<TaxLedgerService> = Symbol('TAX_LEDGER_SERVICE');

/** The payroll journal posted by Human Resource (ERP-0138). */
export const PAYROLL_LEDGER_SERVICE_TOKEN: InjectionToken<PayrollLedgerService> = Symbol('PAYROLL_LEDGER_SERVICE');

/** Sub-ledger opening balances (ERP-0142). */
export const OPENING_SUBLEDGER_REPOSITORY_TOKEN: InjectionToken<IOpeningSubledgerRepository> = Symbol('OPENING_SUBLEDGER_REPOSITORY');
export const OPENING_SUBLEDGER_SERVICE_TOKEN: InjectionToken<OpeningSubledgerService> = Symbol('OPENING_SUBLEDGER_SERVICE');

/** Employee advances and settlements (ERP-0144). */
export const EMPLOYEE_ADVANCE_REPOSITORY_TOKEN: InjectionToken<IEmployeeAdvanceRepository> = Symbol('EMPLOYEE_ADVANCE_REPOSITORY');
export const EMPLOYEE_ADVANCE_SERVICE_TOKEN: InjectionToken<EmployeeAdvanceService> = Symbol('EMPLOYEE_ADVANCE_SERVICE');

/** Fixed-asset books (ERP-0145). */
export const FIXED_ASSET_BOOK_REPOSITORY_TOKEN: InjectionToken<IFixedAssetBookRepository> = Symbol('FIXED_ASSET_BOOK_REPOSITORY');
export const FIXED_ASSET_SERVICE_TOKEN: InjectionToken<FixedAssetService> = Symbol('FIXED_ASSET_SERVICE');

/** Project budgets (ERP-0146). */
export const PROJECT_BUDGET_REPOSITORY_TOKEN: InjectionToken<IProjectBudgetRepository> = Symbol('PROJECT_BUDGET_REPOSITORY');
export const PROJECT_BUDGET_SERVICE_TOKEN: InjectionToken<ProjectBudgetService> = Symbol('PROJECT_BUDGET_SERVICE');

/** Cost accounting reports (ERP-0147). */
export const COST_REPORT_REPOSITORY_TOKEN: InjectionToken<ICostReportRepository> = Symbol('COST_REPORT_REPOSITORY');
export const COST_REPORT_SERVICE_TOKEN: InjectionToken<CostReportService> = Symbol('COST_REPORT_SERVICE');

/** Statements: direct/indirect cash flow, changes in equity, comparatives (ERP-0148). */
export const STATEMENT_REPOSITORY_TOKEN: InjectionToken<IStatementRepository> = Symbol('STATEMENT_REPOSITORY');
export const STATEMENT_SERVICE_TOKEN: InjectionToken<StatementService> = Symbol('STATEMENT_SERVICE');

/** 13-week cash forecast (ERP-0149). */
export const CASH_FORECAST_REPOSITORY_TOKEN: InjectionToken<ICashForecastRepository> = Symbol('CASH_FORECAST_REPOSITORY');
export const CASH_FORECAST_SERVICE_TOKEN: InjectionToken<CashForecastService> = Symbol('CASH_FORECAST_SERVICE');
