import { PROJECT_LOOKUP_SERVICE_TOKEN } from '@app/project/constants/di';
import type { ProjectLookupService } from '@app/project/services/project-lookup.service';
import ExcelJS from 'exceljs';
import { inject, injectable } from 'tsyringe';
import { REPORT_SERVICE_TOKEN } from '../constants/ar-di';
import {
	ACCOUNTING_PERIOD_REPOSITORY_TOKEN,
	COST_REPORT_SERVICE_TOKEN,
	PROJECT_BUDGET_REPOSITORY_TOKEN,
	RATIO_SERVICE_TOKEN,
	STATEMENT_SERVICE_TOKEN,
} from '../constants/di';
import type { IAccountingPeriodRepository } from '../contracts/accounting-period.repository.interface';
import type { IProjectBudgetRepository } from '../contracts/project-budget.contract';
import type { CostReportService } from './cost-report.service';
import type { RatioService } from './ratio.service';
import type { ReportService } from './report.service';
import type { StatementService } from './statement.service';

/** One calendar month as the inclusive date range the statements use. */
export const packMonthRange = (year: number, month: number) => {
	const period = `${year}-${String(month).padStart(2, '0')}`;
	return { period, from: `${period}-01`, to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
};

export type TBudgetVsActualRow = {
	projectId: string;
	code: string | null;
	title: string | null;
	budget: number;
	actual: number;
	/** budget - actual; negative is an overrun. */
	variance: number;
	budgetToDate: number;
	actualToDate: number;
};

export type TManagementPack = Awaited<ReturnType<ManagementPackService['build']>>;

/**
 * Monthly management pack (ERP-0152): one month's P&L, balance sheet, direct
 * and indirect cash flow, changes in equity, ratios, profitability by business
 * line and project budget vs actual, assembled from the existing report
 * services so every figure equals what those reports show.
 *
 * @remarks
 * Budget vs actual is per project (the only budget the ERP has, ERP-0146):
 * the active version's lines for the month and year-to-date against the posted
 * expense movement tagged with the project. The pack is exported as an Excel
 * workbook here; the PDF is the browser print of the pack page. Archiving
 * stores the pack as a `management_pack` row in `finance.report_archives`
 * next to the three statements, for closed periods only.
 */
@injectable()
export class ManagementPackService {
	constructor(
		@inject(REPORT_SERVICE_TOKEN) private readonly reports: Pick<ReportService, 'profitAndLoss' | 'balanceSheet'>,
		@inject(STATEMENT_SERVICE_TOKEN) private readonly statements: Pick<StatementService, 'build'>,
		@inject(RATIO_SERVICE_TOKEN) private readonly ratios: Pick<RatioService, 'ratios'>,
		@inject(COST_REPORT_SERVICE_TOKEN) private readonly costs: Pick<CostReportService, 'profitability'>,
		@inject(PROJECT_BUDGET_REPOSITORY_TOKEN) private readonly budgets: Pick<IProjectBudgetRepository, 'listActiveBudgets' | 'listLines' | 'actuals'>,
		@inject(PROJECT_LOOKUP_SERVICE_TOKEN) private readonly projects: Pick<ProjectLookupService, 'getProject'>,
		@inject(ACCOUNTING_PERIOD_REPOSITORY_TOKEN) private readonly periods: Pick<IAccountingPeriodRepository, 'findPeriodByMonth'>,
	) {}

	/** Project budget vs actual for the month and the year to date. */
	async budgetVsActual(organizationId: string, year: number, month: number) {
		const { period } = packMonthRange(year, month);
		const yearStart = `${year}-01`;
		const rows: TBudgetVsActualRow[] = [];
		for (const budget of await this.budgets.listActiveBudgets(organizationId)) {
			if (!budget.projectId) continue;
			const lines = await this.budgets.listLines(organizationId, budget.id);
			const actuals = await this.budgets.actuals(organizationId, budget.projectId);
			const sum = (items: Array<{ period: string; amount: number }>, inRange: (p: string) => boolean) =>
				items.filter((item) => inRange(item.period)).reduce((total, item) => total + item.amount, 0);
			const month = (p: string) => p === period;
			const toDate = (p: string) => p >= yearStart && p <= period;
			const row = {
				budget: sum(lines, month),
				actual: sum(actuals, month),
				budgetToDate: sum(lines, toDate),
				actualToDate: sum(actuals, toDate),
			};
			if (row.budget === 0 && row.actual === 0 && row.budgetToDate === 0 && row.actualToDate === 0) continue;
			const project = await this.projects.getProject(budget.projectId);
			rows.push({ projectId: budget.projectId, code: project?.code ?? null, title: project?.title ?? null, ...row, variance: row.budget - row.actual });
		}
		rows.sort((a, b) => a.variance - b.variance);
		const total = (key: 'budget' | 'actual' | 'budgetToDate' | 'actualToDate') => rows.reduce((sum, row) => sum + row[key], 0);
		const totals = { budget: total('budget'), actual: total('actual'), budgetToDate: total('budgetToDate'), actualToDate: total('actualToDate') };
		return { rows, totals: { ...totals, variance: totals.budget - totals.actual } };
	}

	/** Assembles the pack for one month; any period status (an open month is a draft). */
	async build(organizationId: string, year: number, month: number) {
		const { from, to } = packMonthRange(year, month);
		const period = await this.periods.findPeriodByMonth(organizationId, year, month);
		const ctx = { organizationId };
		const [profitAndLoss, balanceSheet, statements, ratios, profitability, budgetVsActual] = await Promise.all([
			this.reports.profitAndLoss(ctx, from, to),
			this.reports.balanceSheet(ctx, to),
			this.statements.build(organizationId, from, to),
			this.ratios.ratios(organizationId, from, to),
			this.costs.profitability(organizationId, from, to, 'business_line'),
			this.budgetVsActual(organizationId, year, month),
		]);
		return {
			year,
			month,
			from,
			to,
			/** `null` when no accounting period exists for the month. */
			periodStatus: period?.status ?? null,
			profitAndLoss,
			balanceSheet,
			cashFlow: statements.directCashFlow,
			indirectCashFlow: statements.indirectCashFlow,
			changesInEquity: statements.changesInEquity,
			ratios,
			profitability,
			budgetVsActual,
		};
	}

	/** The pack as an Excel workbook (write-only exceljs, numbers kept numeric, rupiah). */
	async toXlsx(pack: TManagementPack): Promise<Buffer> {
		const rupiah = (minor: number) => minor / 100;
		const workbook = new ExcelJS.Workbook();
		workbook.creator = 'IMS ERP';
		const sheet = (name: string, header: string[]) => {
			const ws = workbook.addWorksheet(name);
			ws.addRow([`${name} ${pack.from} - ${pack.to}`]).font = { bold: true };
			ws.addRow(header).font = { bold: true };
			ws.columns.forEach((column, index) => {
				column.width = index === 0 ? 14 : index === 1 ? 40 : 18;
				if (index >= 2) column.numFmt = '#,##0.00;[Red]-#,##0.00';
			});
			return ws;
		};
		const bold = (ws: ExcelJS.Worksheet, values: unknown[]) => {
			ws.addRow(values).font = { bold: true };
		};

		const summary = workbook.addWorksheet('Summary');
		summary.columns = [{ width: 36 }, { width: 20 }];
		summary.addRow([`Management pack ${pack.year}-${String(pack.month).padStart(2, '0')}`]).font = { bold: true, size: 14 };
		summary.addRow(['Period status', pack.periodStatus ?? '-']);
		for (const [label, value] of [
			['Revenue', pack.profitAndLoss.totalRevenue],
			['Expenses', pack.profitAndLoss.totalExpenses],
			['Net income', pack.profitAndLoss.netIncome],
			['Total assets', pack.balanceSheet.totalAssets],
			['Total liabilities', pack.balanceSheet.totalLiabilities],
			['Total equity', pack.balanceSheet.totalEquity],
			['Net change in cash', pack.cashFlow.netChange],
			['Closing cash', pack.cashFlow.closingCash],
		] as const) {
			summary.addRow([label, rupiah(value)]).getCell(2).numFmt = '#,##0.00;[Red]-#,##0.00';
		}
		summary.addRow([]);
		const r = pack.ratios;
		for (const [label, value] of [
			['Current ratio', r.liquidity.current],
			['Quick ratio', r.liquidity.quick],
			['Cash ratio', r.liquidity.cash],
			['Gross margin', r.profitability.grossMargin],
			['Net margin', r.profitability.netMargin],
			['Return on assets', r.profitability.returnOnAssets],
			['Return on equity', r.profitability.returnOnEquity],
			['Debt to equity', r.leverage.debtToEquity],
			['DSO (days)', r.efficiency.dso],
			['DPO (days)', r.efficiency.dpo],
			['DIO (days)', r.efficiency.dio],
		] as const) {
			summary.addRow([label, value ?? '-']);
		}

		const pl = sheet('Profit and loss', ['Code', 'Account', 'Amount']);
		for (const line of pack.profitAndLoss.revenue) pl.addRow([line.code, line.name, rupiah(line.amount)]);
		bold(pl, ['', 'Total revenue', rupiah(pack.profitAndLoss.totalRevenue)]);
		for (const line of pack.profitAndLoss.expenses) pl.addRow([line.code, line.name, rupiah(line.amount)]);
		bold(pl, ['', 'Total expenses', rupiah(pack.profitAndLoss.totalExpenses)]);
		bold(pl, ['', 'Net income', rupiah(pack.profitAndLoss.netIncome)]);

		const bs = sheet('Balance sheet', ['Code', 'Account', 'Amount']);
		for (const [title, lines, total] of [
			['Total assets', pack.balanceSheet.assets, pack.balanceSheet.totalAssets],
			['Total liabilities', pack.balanceSheet.liabilities, pack.balanceSheet.totalLiabilities],
			['Total equity', pack.balanceSheet.equity, pack.balanceSheet.totalEquity],
		] as const) {
			for (const line of lines) bs.addRow([line.code, line.name, rupiah(line.amount)]);
			bold(bs, ['', title, rupiah(total)]);
		}

		const cf = sheet('Cash flow', ['Code', 'Account', 'Amount']);
		for (const [title, section] of [
			['Operating', pack.cashFlow.operating],
			['Investing', pack.cashFlow.investing],
			['Financing', pack.cashFlow.financing],
		] as const) {
			for (const line of section.lines) cf.addRow([line.code, line.name, rupiah(line.amount)]);
			bold(cf, ['', title, rupiah(section.total)]);
		}
		bold(cf, ['', 'Opening cash', rupiah(pack.cashFlow.openingCash)]);
		bold(cf, ['', 'Net change', rupiah(pack.cashFlow.netChange)]);
		bold(cf, ['', 'Closing cash', rupiah(pack.cashFlow.closingCash)]);

		const pr = sheet('Profitability', ['', 'Business line', 'Revenue', 'Cost', 'Margin']);
		for (const row of pack.profitability.rows) pr.addRow(['', row.label ?? '(unattributed)', rupiah(row.revenue), rupiah(row.cost), rupiah(row.margin)]);
		bold(pr, ['', 'Total', rupiah(pack.profitability.totals.revenue), rupiah(pack.profitability.totals.cost), rupiah(pack.profitability.totals.margin)]);

		const bva = sheet('Budget vs actual', ['Project', 'Title', 'Budget', 'Actual', 'Variance', 'Budget YTD', 'Actual YTD']);
		for (const row of pack.budgetVsActual.rows) {
			bva.addRow([row.code ?? row.projectId, row.title ?? '', rupiah(row.budget), rupiah(row.actual), rupiah(row.variance), rupiah(row.budgetToDate), rupiah(row.actualToDate)]);
		}
		const t = pack.budgetVsActual.totals;
		bold(bva, ['', 'Total', rupiah(t.budget), rupiah(t.actual), rupiah(t.variance), rupiah(t.budgetToDate), rupiah(t.actualToDate)]);

		return Buffer.from(await workbook.xlsx.writeBuffer());
	}
}
