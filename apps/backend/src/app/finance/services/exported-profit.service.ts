import { inject, injectable } from 'tsyringe';
import { REPORT_SERVICE_TOKEN } from '../constants/ar-di';
import { ACCOUNTING_PERIOD_REPOSITORY_TOKEN, POSTING_RULE_SERVICE_TOKEN } from '../constants/di';
import type { IAccountingPeriodRepository } from '../contracts/accounting-period.repository.interface';
import { PeriodNotFoundError, ProfitPeriodNotLockedError } from '../errors/ledger.errors';
import type { PostingRuleService } from './posting-rule.service';
import type { ReportService } from './report.service';

/** Profit of one locked month, in IDR minor units (ERP-0153). */
export type TClosedPeriodProfit = {
	organizationId: string;
	periodYear: number;
	periodMonth: number;
	/** Period code, e.g. `2026-11`. */
	periodCode: string;
	startDate: string;
	endDate: string;
	revenue: number;
	/** Every expense, income tax included. */
	expenses: number;
	/** Expense on the account the `income_tax_expense` posting rule names. */
	incomeTaxExpense: number;
	profitBeforeTax: number;
	profitAfterTax: number;
	/** False when no `income_tax_expense` rule exists: before tax then equals after tax. */
	incomeTaxAccountConfigured: boolean;
};

/**
 * Closed-period profit contract (ERP-0153, ADR-0030): the one figure a future
 * profit-sharing module (M11) may read from finance.
 *
 * @remarks
 * Only `locked` periods answer. A locked month accepts no posting (reversals
 * land in the first open period), so the figure never changes after another
 * module has used it; `open` and merely `closed` months are refused. The
 * amounts are the general-ledger P&L of the month (`ReportService`), split
 * into before and after income tax by the account of the `'*'` /
 * `income_tax_expense` posting rule. Finance keeps no investor data: the
 * caller owns shares, allocations and payouts.
 *
 * Exported through `EXPORTED_PROFIT_SERVICE_TOKEN`; it depends only on
 * finance's own repositories and services, so any module can inject it.
 */
@injectable()
export class ExportedProfitService {
	constructor(
		@inject(ACCOUNTING_PERIOD_REPOSITORY_TOKEN) private readonly periods: Pick<IAccountingPeriodRepository, 'findPeriodByMonth'>,
		@inject(REPORT_SERVICE_TOKEN) private readonly reports: Pick<ReportService, 'profitAndLoss'>,
		@inject(POSTING_RULE_SERVICE_TOKEN) private readonly rules: Pick<PostingRuleService, 'resolveAccountId'>,
	) {}

	/**
	 * Profit before and after tax of a locked month.
	 *
	 * @throws PeriodNotFoundError when the month has no accounting period.
	 * @throws ProfitPeriodNotLockedError when the period is `open` or `closed`.
	 */
	async closedPeriodProfit(organizationId: string, periodYear: number, periodMonth: number): Promise<TClosedPeriodProfit> {
		const period = await this.periods.findPeriodByMonth(organizationId, periodYear, periodMonth);
		if (!period) throw new PeriodNotFoundError();
		if (period.status !== 'locked') throw new ProfitPeriodNotLockedError(periodYear, periodMonth);

		const taxAccountId = await this.rules.resolveAccountId(organizationId, { eventType: '*', role: 'income_tax_expense' }).catch(() => null);
		const pl = await this.reports.profitAndLoss({ organizationId }, period.startDate, period.endDate);
		const incomeTaxExpense = taxAccountId ? pl.expenses.filter((line) => line.accountId === taxAccountId).reduce((sum, line) => sum + line.amount, 0) : 0;
		const profitAfterTax = pl.netIncome;
		return {
			organizationId,
			periodYear,
			periodMonth,
			periodCode: period.code,
			startDate: period.startDate,
			endDate: period.endDate,
			revenue: pl.totalRevenue,
			expenses: pl.totalExpenses,
			incomeTaxExpense,
			profitBeforeTax: profitAfterTax + incomeTaxExpense,
			profitAfterTax,
			incomeTaxAccountConfigured: taxAccountId !== null,
		};
	}
}
