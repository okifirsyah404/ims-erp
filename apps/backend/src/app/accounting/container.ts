import type { DependencyContainer } from 'tsyringe';
import {
	ACCOUNT_SERVICE_TOKEN,
	CASH_BANK_SERVICE_TOKEN,
	LEDGER_REPOSITORY_TOKEN,
	OPENING_BALANCE_SERVICE_TOKEN,
	PERIOD_SERVICE_TOKEN,
	POSTING_SERVICE_TOKEN,
	TAX_REPOSITORY_TOKEN,
	TAX_SERVICE_TOKEN,
} from './constants/di';
import { LedgerRepository } from './repositories/ledger.repository';
import { TaxRepository } from './repositories/tax.repository';
import { AccountService } from './services/account.service';
import { PeriodService } from './services/period.service';
import { PostingService } from './services/posting.service';
import { TaxService } from './services/tax.service';
import { OpeningBalanceService } from './services/opening-balance.service';
import { CashBankService } from './services/cash-bank.service';
import { ArAccountResolverService } from './services/ar-account-resolver.service';
import { PaymentService } from './services/payment.service';
import { SupplierBillService } from './services/supplier-bill.service';
import { ReportService } from './services/report.service';
import { BankReconciliationService } from './services/bank-reconciliation.service';
import { MonthEndCloseService } from './services/month-end-close.service';
import {
	AR_ACCOUNT_RESOLVER_TOKEN,
	BANK_RECONCILIATION_SERVICE_TOKEN,
	MONTH_END_CLOSE_SERVICE_TOKEN,
	PAYMENT_SERVICE_TOKEN,
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
 */
export function registerAccounting(container: DependencyContainer): void {
	container.register(TAX_REPOSITORY_TOKEN, { useClass: TaxRepository });
	container.register(TAX_SERVICE_TOKEN, { useClass: TaxService });

	container.register(LEDGER_REPOSITORY_TOKEN, { useClass: LedgerRepository });
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
	container.register(PAYMENT_SERVICE_TOKEN, { useClass: PaymentService });
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
}
