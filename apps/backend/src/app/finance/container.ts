import type { DependencyContainer } from 'tsyringe';
import { LedgerSettlementPortService } from './services/ledger-settlement.port.service';
import { ArLedgerPortService } from './services/ar-ledger.port.service';
import {
	ACCOUNTING_PERIOD_REPOSITORY_TOKEN,
	ACCOUNT_BALANCE_REPOSITORY_TOKEN,
	ACCOUNT_SERVICE_TOKEN,
	DEPRECIATION_REPOSITORY_TOKEN,
	DEPRECIATION_SERVICE_TOKEN,
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
import { DepreciationService } from './services/depreciation.service';
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
	// ADR-0024: the payment module settles AR/AP and cash through this port.
	container.register(LEDGER_SETTLEMENT_PORT_TOKEN, { useClass: LedgerSettlementPortService });
	// Published to Sales so it never imports an accounting repository (rule 3.4).
	container.register(AR_LEDGER_PORT_TOKEN, { useClass: ArLedgerPortService });

	container.register(FINANCE_CODE_NUMBERING_REPOSITORY_TOKEN, { useClass: FinanceCodeNumberingRepository });
	container.register(FINANCE_NUMBERING_SERVICE_TOKEN, { useClass: FinanceNumberingService });
	container.register(DEPRECIATION_REPOSITORY_TOKEN, { useClass: DepreciationRepository });
	container.register(DEPRECIATION_SERVICE_TOKEN, { useClass: DepreciationService });
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
}

export * from './constants/di';
