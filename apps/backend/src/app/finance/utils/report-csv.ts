/**
 * CSV serialization for the financial statements (M12 T30).
 *
 * @remarks
 * One flattened row per statement line, so a spreadsheet can pivot on
 * `section`. Permissions are checked by the route
 * (`financial_report:export`), not here. Plain RFC 4180 CSV with a UTF-8 BOM
 * so Excel opens it correctly - the same convention as the tax recap export.
 */
import type {
	TBalanceSheet,
	TCashFlowStatement,
	TProfitAndLoss,
	TReportLine,
} from '../services/report.service';

const HEADER = [
	'statement',
	'period_start',
	'period_end',
	'section',
	'account_code',
	'account_name',
	'account_type',
	'amount_minor',
];

type TCsvRow = [string, string, string, string, string, string, string, number];

const lineRow = (
	statement: string,
	period: [string, string],
	section: string,
	line: TReportLine | { code: string; name: string; amount: number },
): TCsvRow => [
	statement,
	period[0],
	period[1],
	section,
	line.code,
	line.name,
	'accountType' in line ? line.accountType : '',
	line.amount,
];

const totalRow = (
	statement: string,
	period: [string, string],
	section: string,
	label: string,
	amount: number,
): TCsvRow => [statement, period[0], period[1], section, '', label, '', amount];

export function profitAndLossToCsv(report: TProfitAndLoss): string {
	const period: [string, string] = [report.startDate, report.endDate];
	return toCsv([
		...report.revenue.map((line) =>
			lineRow('profit_and_loss', period, 'revenue', line),
		),
		...report.expenses.map((line) =>
			lineRow('profit_and_loss', period, 'expenses', line),
		),
		totalRow('profit_and_loss', period, 'total_revenue', 'Total revenue', report.totalRevenue),
		totalRow('profit_and_loss', period, 'total_expenses', 'Total expenses', report.totalExpenses),
		totalRow('profit_and_loss', period, 'net_income', 'Net income', report.netIncome),
	]);
}

export function balanceSheetToCsv(report: TBalanceSheet): string {
	const period: [string, string] = [report.asOfDate, report.asOfDate];
	return toCsv([
		...report.assets.map((line) =>
			lineRow('balance_sheet', period, 'assets', line),
		),
		...report.liabilities.map((line) =>
			lineRow('balance_sheet', period, 'liabilities', line),
		),
		...report.equity.map((line) =>
			lineRow('balance_sheet', period, 'equity', line),
		),
		totalRow('balance_sheet', period, 'total_assets', 'Total assets', report.totalAssets),
		totalRow('balance_sheet', period, 'total_liabilities', 'Total liabilities', report.totalLiabilities),
		totalRow('balance_sheet', period, 'total_equity', 'Total equity', report.totalEquity),
		totalRow('balance_sheet', period, 'unexplained', 'Unexplained', report.unexplained),
	]);
}

export function cashFlowToCsv(report: TCashFlowStatement): string {
	const period: [string, string] = [report.startDate, report.endDate];
	const byCategory = (
		bucket: string,
		entries: Array<{ code: string; name: string; cashFlowCategory: string; amount: number }>,
	) =>
		entries.map((entry) =>
			lineRow('cash_flow', period, `${bucket}:${entry.cashFlowCategory}`, entry),
		);
	return toCsv([
		...byCategory('operating', report.operating),
		...byCategory('investing', report.investing),
		...byCategory('financing', report.financing),
		totalRow('cash_flow', period, 'net_operating', 'Net operating', report.netOperating),
		totalRow('cash_flow', period, 'net_investing', 'Net investing', report.netInvesting),
		totalRow('cash_flow', period, 'net_financing', 'Net financing', report.netFinancing),
		totalRow('cash_flow', period, 'net_change_in_cash', 'Net change in cash', report.netChangeInCash),
	]);
}

function toCsv(rows: TCsvRow[]): string {
	return [
		`\uFEFF${HEADER.join(',')}`,
		...rows.map((row) => row.map(csvField).join(',')),
	].join('\r\n');
}

/** Quotes a field when it contains a comma, quote, or newline. */
function csvField(value: string | number): string {
	const text = String(value);
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
