import { ExportedFinanceService } from './services/exported-finance.service';
import { EmployeeBankAccountRepository } from './repositories/employee-bank-account.repository';
import { EmployeeBankAccountService } from './services/employee-bank-account.service';
import type { DependencyContainer } from 'tsyringe';
import { LedgerSettlementPortService } from './services/ledger-settlement.port.service';
import { ArLedgerPortService } from './services/ar-ledger.port.service';
import {
	ACCOUNTING_PERIOD_REPOSITORY_TOKEN,
	ACCOUNT_BALANCE_REPOSITORY_TOKEN,
	ACCOUNT_SERVICE_TOKEN,
	DEPRECIATION_REPOSITORY_TOKEN,
	DEPRECIATION_SERVICE_TOKEN,
	EXPENSE_CLAIM_REPOSITORY_TOKEN,
	EXPENSE_CLAIM_SERVICE_TOKEN,
	FINANCE_CODE_NUMBERING_REPOSITORY_TOKEN,
	FINANCE_NUMBERING_SERVICE_TOKEN,
	AP_OPEN_ITEM_REPOSITORY_TOKEN,
	AR_OPEN_ITEM_REPOSITORY_TOKEN,
	BANK_ACCOUNT_LINK_REPOSITORY_TOKEN,
	BANK_RECONCILIATION_REPOSITORY_TOKEN,
	CASH_BANK_REPOSITORY_TOKEN,
	CASH_BANK_SERVICE_TOKEN,
	CHART_OF_ACCOUNT_REPOSITORY_TOKEN,
	CLOSE_CHECKLIST_REPOSITORY_TOKEN,
	JOURNAL_REPOSITORY_TOKEN,
	OPENING_BALANCE_REPOSITORY_TOKEN,
	OPENING_BALANCE_SERVICE_TOKEN,
	PERIOD_SERVICE_TOKEN,
	POSTING_SERVICE_TOKEN,
	SUPPLIER_BILL_ITEM_REPOSITORY_TOKEN,
	SUPPLIER_BILL_REPOSITORY_TOKEN,
	EMPLOYEE_BANK_ACCOUNT_REPOSITORY_TOKEN,
	EMPLOYEE_BANK_ACCOUNT_SERVICE_TOKEN,
	EXPORTED_FINANCE_SERVICE_TOKEN,
	COST_CENTER_REPOSITORY_TOKEN,
	COST_CENTER_SERVICE_TOKEN,
	FINANCE_AUDIT_WRITER_TOKEN,
	MANUAL_JOURNAL_SERVICE_TOKEN,
	POSTING_RULE_REPOSITORY_TOKEN,
	POSTING_RULE_SERVICE_TOKEN,
	CREDIT_MEMO_REPOSITORY_TOKEN,
	DEFERRED_REVENUE_PORT_TOKEN,
	DEFERRED_REVENUE_REPOSITORY_TOKEN,
	DEFERRED_REVENUE_SERVICE_TOKEN,
	RECEIVABLE_ADJUSTMENT_SERVICE_TOKEN,
	GATEWAY_SETTLEMENT_SERVICE_TOKEN,
	TAX_LEDGER_SERVICE_TOKEN,
	PAYROLL_LEDGER_SERVICE_TOKEN,
	OPENING_SUBLEDGER_REPOSITORY_TOKEN,
	OPENING_SUBLEDGER_SERVICE_TOKEN,
	EMPLOYEE_ADVANCE_REPOSITORY_TOKEN,
	EMPLOYEE_ADVANCE_SERVICE_TOKEN,
	FIXED_ASSET_BOOK_REPOSITORY_TOKEN,
	FIXED_ASSET_SERVICE_TOKEN,
	PROJECT_BUDGET_REPOSITORY_TOKEN,
	PROJECT_BUDGET_SERVICE_TOKEN,
	COST_REPORT_REPOSITORY_TOKEN,
	COST_REPORT_SERVICE_TOKEN,
	STATEMENT_REPOSITORY_TOKEN,
	STATEMENT_SERVICE_TOKEN,
	CASH_FORECAST_REPOSITORY_TOKEN,
	CASH_FORECAST_SERVICE_TOKEN,
	RATIO_SERVICE_TOKEN,
} from './constants/di';
import { ChartOfAccountRepository } from './repositories/chart-of-account.repository';
import { AccountingPeriodRepository } from './repositories/accounting-period.repository';
import { JournalRepository } from './repositories/journal.repository';
import { OpeningBalanceRepository } from './repositories/opening-balance.repository';
import { BankAccountLinkRepository } from './repositories/bank-account-link.repository';
import { CashBankRepository } from './repositories/cash-bank.repository';
import { ArOpenItemRepository } from './repositories/ar-open-item.repository';
import { ApOpenItemRepository } from './repositories/ap-open-item.repository';
import { SupplierBillItemRepository } from './repositories/supplier-bill-item.repository';
import { SupplierBillRepository } from './repositories/supplier-bill.repository';
import { BankReconciliationRepository } from './repositories/bank-reconciliation.repository';
import { AccountBalanceRepository } from './repositories/account-balance.repository';
import { CloseChecklistRepository } from './repositories/close-checklist.repository';
import { FinanceCodeNumberingRepository } from './repositories/code-numbering.repository';
import { DepreciationRepository } from './repositories/depreciation.repository';
import { ExpenseClaimRepository } from './repositories/expense-claim.repository';
import { DepreciationService } from './services/depreciation.service';
import { ExpenseClaimService } from './services/expense-claim.service';
import { FinanceNumberingService } from './services/finance-numbering.service';
import { AccountService } from './services/account.service';
import { PeriodService } from './services/period.service';
import { PostingService } from './services/posting.service';
import { OpeningBalanceService } from './services/opening-balance.service';
import { CashBankService } from './services/cash-bank.service';
import { ArAccountResolverService } from './services/ar-account-resolver.service';
import { SupplierBillService } from './services/supplier-bill.service';
import { ReportService } from './services/report.service';
import { ReportArchiveRepository } from './repositories/report-archive.repository';
import { ReportArchiveService } from './services/report-archive.service';
import { BankReconciliationService } from './services/bank-reconciliation.service';
import { MonthEndCloseService } from './services/month-end-close.service';
import { CostCenterRepository } from './repositories/cost-center.repository';
import { PostingRuleRepository } from './repositories/posting-rule.repository';
import { CostCenterService } from './services/cost-center.service';
import { PostingRuleService } from './services/posting-rule.service';
import { ManualJournalService } from './services/manual-journal.service';
import { CreditMemoRepository } from './repositories/credit-memo.repository';
import { DeferredRevenueRepository } from './repositories/deferred-revenue.repository';
import { DeferredRevenueService } from './services/deferred-revenue.service';
import { ReceivableAdjustmentService } from './services/receivable-adjustment.service';
import { GatewaySettlementService } from './services/gateway-settlement.service';
import { PayrollLedgerService } from './services/payroll-ledger.service';
import { OpeningSubledgerRepository } from './repositories/opening-subledger.repository';
import { OpeningSubledgerService } from './services/opening-subledger.service';
import { EmployeeAdvanceRepository } from './repositories/employee-advance.repository';
import { EmployeeAdvanceService } from './services/employee-advance.service';
import { FixedAssetBookRepository } from './repositories/fixed-asset.repository';
import { FixedAssetService } from './services/fixed-asset.service';
import { ProjectBudgetRepository } from './repositories/project-budget.repository';
import { ProjectBudgetService } from './services/project-budget.service';
import { CostReportRepository } from './repositories/cost-report.repository';
import { CostReportService } from './services/cost-report.service';
import { StatementRepository } from './repositories/statement.repository';
import { StatementService } from './services/statement.service';
import { CashForecastRepository } from './repositories/cash-forecast.repository';
import { CashForecastService } from './services/cash-forecast.service';
import { RatioService } from './services/ratio.service';
import { TaxLedgerService } from './services/tax-ledger.service';
import { AUDIT_SERVICE_TOKEN } from '@app/audit/constants/di';
import type { AuditService } from '@app/audit/services/audit.service';
import { AuditWriter } from '@shared/audit';
import {
	AR_ACCOUNT_RESOLVER_TOKEN,
	AR_LEDGER_PORT_TOKEN,
	BANK_RECONCILIATION_SERVICE_TOKEN,
	LEDGER_SETTLEMENT_PORT_TOKEN,
	MONTH_END_CLOSE_SERVICE_TOKEN,
	REPORT_ARCHIVE_REPOSITORY_TOKEN,
	REPORT_ARCHIVE_SERVICE_TOKEN,
	REPORT_SERVICE_TOKEN,
	SUPPLIER_BILL_SERVICE_TOKEN,
} from './constants/ar-di';

/**
 * Registers the accounting module (tax + ledger slices) in the composition
 * root.
 *
 * @remarks
 * Called from `src/index.ts`. Controllers resolve inside `plugin()`, so this
 * must run before `createApp()`. Numbering is registered by the organization
 * module (`CODE_NUMBER_SERVICE_TOKEN`); accounting only consumes it.
 *
 * One registration per table repository (see
 * `contracts/*.repository.interface.ts`); services inject the two or three they
 * actually use.
 */
export function registerFinance(container: DependencyContainer): void {
	// Employees' salary payee accounts (ERP-0119).
	container.register(EMPLOYEE_BANK_ACCOUNT_REPOSITORY_TOKEN, { useClass: EmployeeBankAccountRepository });
	container.register(EMPLOYEE_BANK_ACCOUNT_SERVICE_TOKEN, { useClass: EmployeeBankAccountService });
	container.register(EXPORTED_FINANCE_SERVICE_TOKEN, { useClass: ExportedFinanceService });

	// ADR-0024: the payment module settles AR/AP and cash through this port.
	container.register(LEDGER_SETTLEMENT_PORT_TOKEN, { useClass: LedgerSettlementPortService });
	// Published to Sales so it never imports an accounting repository (rule 3.4).
	container.register(AR_LEDGER_PORT_TOKEN, { useClass: ArLedgerPortService });

	container.register(FINANCE_CODE_NUMBERING_REPOSITORY_TOKEN, { useClass: FinanceCodeNumberingRepository });
	container.register(FINANCE_NUMBERING_SERVICE_TOKEN, { useClass: FinanceNumberingService });
	container.register(DEPRECIATION_REPOSITORY_TOKEN, { useClass: DepreciationRepository });
	container.register(DEPRECIATION_SERVICE_TOKEN, { useClass: DepreciationService });
	container.register(EXPENSE_CLAIM_REPOSITORY_TOKEN, { useClass: ExpenseClaimRepository });
	container.register(EXPENSE_CLAIM_SERVICE_TOKEN, { useClass: ExpenseClaimService });
	container.register(CHART_OF_ACCOUNT_REPOSITORY_TOKEN, { useClass: ChartOfAccountRepository });
	container.register(ACCOUNTING_PERIOD_REPOSITORY_TOKEN, {
		useClass: AccountingPeriodRepository,
	});
	container.register(JOURNAL_REPOSITORY_TOKEN, { useClass: JournalRepository });
	container.register(OPENING_BALANCE_REPOSITORY_TOKEN, { useClass: OpeningBalanceRepository });
	container.register(BANK_ACCOUNT_LINK_REPOSITORY_TOKEN, {
		useClass: BankAccountLinkRepository,
	});
	container.register(CASH_BANK_REPOSITORY_TOKEN, { useClass: CashBankRepository });
	container.register(AR_OPEN_ITEM_REPOSITORY_TOKEN, { useClass: ArOpenItemRepository });
	container.register(AP_OPEN_ITEM_REPOSITORY_TOKEN, { useClass: ApOpenItemRepository });
	container.register(SUPPLIER_BILL_REPOSITORY_TOKEN, { useClass: SupplierBillRepository });
	container.register(SUPPLIER_BILL_ITEM_REPOSITORY_TOKEN, { useClass: SupplierBillItemRepository });
	container.register(BANK_RECONCILIATION_REPOSITORY_TOKEN, {
		useClass: BankReconciliationRepository,
	});
	container.register(ACCOUNT_BALANCE_REPOSITORY_TOKEN, { useClass: AccountBalanceRepository });
	container.register(CLOSE_CHECKLIST_REPOSITORY_TOKEN, { useClass: CloseChecklistRepository });

	container.register(POSTING_SERVICE_TOKEN, { useClass: PostingService });
	container.register(ACCOUNT_SERVICE_TOKEN, { useClass: AccountService });
	container.register(PERIOD_SERVICE_TOKEN, { useClass: PeriodService });
	container.register(OPENING_BALANCE_SERVICE_TOKEN, {
		useClass: OpeningBalanceService,
	});
	container.register(CASH_BANK_SERVICE_TOKEN, { useClass: CashBankService });
	container.register(AR_ACCOUNT_RESOLVER_TOKEN, {
		useClass: ArAccountResolverService,
	});
	container.register(SUPPLIER_BILL_SERVICE_TOKEN, {
		useClass: SupplierBillService,
	});
	container.register(REPORT_SERVICE_TOKEN, { useClass: ReportService });
	container.register(BANK_RECONCILIATION_SERVICE_TOKEN, {
		useClass: BankReconciliationService,
	});
	container.register(MONTH_END_CLOSE_SERVICE_TOKEN, {
		useClass: MonthEndCloseService,
	});
	container.register(REPORT_ARCHIVE_REPOSITORY_TOKEN, {
		useClass: ReportArchiveRepository,
	});
	container.register(REPORT_ARCHIVE_SERVICE_TOKEN, {
		useClass: ReportArchiveService,
	});

	// GL foundation (ERP-0127..0130, ADR-0030).
	container.register(FINANCE_AUDIT_WRITER_TOKEN, {
		useFactory: (c) => new AuditWriter(c.resolve<AuditService>(AUDIT_SERVICE_TOKEN)),
	});
	container.register(COST_CENTER_REPOSITORY_TOKEN, { useClass: CostCenterRepository });
	container.register(POSTING_RULE_REPOSITORY_TOKEN, { useClass: PostingRuleRepository });
	container.register(COST_CENTER_SERVICE_TOKEN, { useClass: CostCenterService });
	container.register(POSTING_RULE_SERVICE_TOKEN, { useClass: PostingRuleService });
	container.register(MANUAL_JOURNAL_SERVICE_TOKEN, { useClass: ManualJournalService });

	// AR postings (ERP-0135).
	container.register(CREDIT_MEMO_REPOSITORY_TOKEN, { useClass: CreditMemoRepository });
	container.register(DEFERRED_REVENUE_REPOSITORY_TOKEN, { useClass: DeferredRevenueRepository });
	container.register(DEFERRED_REVENUE_SERVICE_TOKEN, { useClass: DeferredRevenueService });
	container.register(DEFERRED_REVENUE_PORT_TOKEN, { useClass: DeferredRevenueService });
	container.register(RECEIVABLE_ADJUSTMENT_SERVICE_TOKEN, { useClass: ReceivableAdjustmentService });
	container.register(GATEWAY_SETTLEMENT_SERVICE_TOKEN, { useClass: GatewaySettlementService });
	container.register(TAX_LEDGER_SERVICE_TOKEN, { useClass: TaxLedgerService });
	container.register(PAYROLL_LEDGER_SERVICE_TOKEN, { useClass: PayrollLedgerService });
	container.register(OPENING_SUBLEDGER_REPOSITORY_TOKEN, { useClass: OpeningSubledgerRepository });
	container.register(OPENING_SUBLEDGER_SERVICE_TOKEN, { useClass: OpeningSubledgerService });
	container.register(EMPLOYEE_ADVANCE_REPOSITORY_TOKEN, { useClass: EmployeeAdvanceRepository });
	container.register(EMPLOYEE_ADVANCE_SERVICE_TOKEN, { useClass: EmployeeAdvanceService });
	container.register(FIXED_ASSET_BOOK_REPOSITORY_TOKEN, { useClass: FixedAssetBookRepository });
	container.register(FIXED_ASSET_SERVICE_TOKEN, { useClass: FixedAssetService });
	container.register(PROJECT_BUDGET_REPOSITORY_TOKEN, { useClass: ProjectBudgetRepository });
	container.register(PROJECT_BUDGET_SERVICE_TOKEN, { useClass: ProjectBudgetService });
	container.register(COST_REPORT_REPOSITORY_TOKEN, { useClass: CostReportRepository });
	container.register(COST_REPORT_SERVICE_TOKEN, { useClass: CostReportService });
	container.register(STATEMENT_REPOSITORY_TOKEN, { useClass: StatementRepository });
	container.register(STATEMENT_SERVICE_TOKEN, { useClass: StatementService });
	container.register(CASH_FORECAST_REPOSITORY_TOKEN, { useClass: CashForecastRepository });
	container.register(CASH_FORECAST_SERVICE_TOKEN, { useClass: CashForecastService });
	container.register(RATIO_SERVICE_TOKEN, { useClass: RatioService });
}

export * from './constants/di';
