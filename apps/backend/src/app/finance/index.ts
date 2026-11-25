/**
 * Public entry point of the finance module (/finance, ADR-0024 P5).
 *
 * @remarks
 * Exports the module's HTTP surface as a single Elysia factory
 * (`financeModule()`) plus the composition-root registration, so
 * `src/app/app.ts` only mounts `.use(financeModule())` and never lists
 * the module's controllers individually. Mirrors every other module
 * entry point.
 */
import { EmployeeAdvanceController } from './controllers/employee-advance.controller';
import { FixedAssetController } from './controllers/fixed-asset.controller';
import { ProjectBudgetController } from './controllers/project-budget.controller';
import { CostReportController } from './controllers/cost-report.controller';
import { ReceivablesController } from './controllers/receivables.controller';
import { FinanceSetupController } from './controllers/finance-setup.controller';
import Elysia from 'elysia';

import { FinanceCodeNumberingController } from './controllers/code-numbering.controller';
import { DepreciationController } from './controllers/depreciation.controller';
import { ExpenseController } from './controllers/expense.controller';
import { LedgerController } from './controllers/ledger.controller';
import { FinanceOperationsController } from './controllers/finance-operations.controller';
import { EmployeeBankAccountController } from './controllers/employee-bank-account.controller';

export { registerFinance } from './container';
export { registerSupplierBillDueSchedule } from './queues/supplier-bill-due.queue';
export { startSupplierBillDueWorker } from './queues/supplier-bill-due.worker';
export { POSTING_SERVICE_TOKEN } from './constants/di';
export { LEDGER_SETTLEMENT_PORT_TOKEN } from './constants/ar-di';
export type { ILedgerSettlementPort } from './contracts/ledger-settlement.port';
export type { TPostingInput, TPostingLine, TPostingResult } from './services/posting.service';
export { PostingService } from './services/posting.service';

/** Elysia instance mounting every finance controller, in route order. */
export function financeModule() {
	return new Elysia({ name: 'finance' })
		// Static `/code-numberings` routes: settings of this module's series.
		.use(FinanceCodeNumberingController.plugin())
		.use(LedgerController.plugin())
		.use(DepreciationController.plugin())
		.use(FinanceOperationsController.plugin())
		.use(EmployeeBankAccountController.plugin())
		.use(ExpenseController.plugin())
		.use(FinanceSetupController.plugin())
		.use(ReceivablesController.plugin())
		.use(EmployeeAdvanceController.plugin())
		.use(FixedAssetController.plugin())
		.use(ProjectBudgetController.plugin())
		.use(CostReportController.plugin());
}
