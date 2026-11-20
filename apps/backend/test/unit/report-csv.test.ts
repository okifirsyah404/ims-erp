/**
 * Statement CSV export (M12 T30): header shape, one row per line, totals and
 * RFC 4180 quoting.
 */
import { describe, expect, test } from 'bun:test';
import {
	balanceSheetToCsv,
	cashFlowToCsv,
	profitAndLossToCsv,
} from '../../src/app/finance/utils/report-csv';

const line = (code: string, name: string, amount: number) => ({
	accountId: `id-${code}`,
	code,
	name,
	accountType: 'revenue',
	amount,
});

describe('profit and loss CSV', () => {
	test('emits revenue, expenses and the three totals', () => {
		const csv = profitAndLossToCsv({
			startDate: '2026-10-01',
			endDate: '2026-10-31',
			revenue: [line('4-1000', 'Penjualan', 1_000_00)],
			expenses: [line('5-1000', 'Beban', 250_00)],
			totalRevenue: 1_000_00,
			totalExpenses: 250_00,
			netIncome: 750_00,
		});
		const rows = csv.replace(/^\uFEFF/, '').split('\r\n');
		expect(rows[0]).toBe(
			'statement,period_start,period_end,section,account_code,account_name,account_type,amount_minor',
		);
		expect(rows[1]).toBe(
			'profit_and_loss,2026-10-01,2026-10-31,revenue,4-1000,Penjualan,revenue,100000',
		);
		expect(rows[2]).toBe(
			'profit_and_loss,2026-10-01,2026-10-31,expenses,5-1000,Beban,revenue,25000',
		);
		expect(rows).toContain(
			'profit_and_loss,2026-10-01,2026-10-31,net_income,,Net income,,75000',
		);
		expect(rows).toHaveLength(6);
	});

	test('starts with a UTF-8 BOM so Excel reads the file correctly', () => {
		const csv = profitAndLossToCsv({
			startDate: '2026-10-01',
			endDate: '2026-10-31',
			revenue: [],
			expenses: [],
			totalRevenue: 0,
			totalExpenses: 0,
			netIncome: 0,
		});
		expect(csv.charCodeAt(0)).toBe(0xfeff);
	});

	test('quotes a name that contains a comma', () => {
		const csv = profitAndLossToCsv({
			startDate: '2026-10-01',
			endDate: '2026-10-31',
			revenue: [line('4-2000', 'Jasa, lain-lain', 100)],
			expenses: [],
			totalRevenue: 100,
			totalExpenses: 0,
			netIncome: 100,
		});
		expect(csv).toContain('"Jasa, lain-lain"');
	});
});

describe('balance sheet CSV', () => {
	test('emits the four totals including unexplained', () => {
		const csv = balanceSheetToCsv({
			asOfDate: '2026-10-31',
			assets: [line('1-1000', 'Kas', 500)],
			liabilities: [],
			equity: [],
			totalAssets: 500,
			totalLiabilities: 0,
			totalEquity: 500,
			unexplained: 0,
		});
		const rows = csv.replace(/^\uFEFF/, '').split('\r\n');
		expect(rows[1]).toContain('balance_sheet');
		expect(rows).toContain(
			'balance_sheet,2026-10-31,2026-10-31,unexplained,,Unexplained,,0',
		);
		expect(rows).toHaveLength(6);
	});
});

describe('cash flow CSV', () => {
	test('tags each row with its bucket and category', () => {
		const csv = cashFlowToCsv({
			startDate: '2026-10-01',
			endDate: '2026-10-31',
			operating: [
				{ accountId: 'a', code: '1-1100', name: 'Bank', cashFlowCategory: 'operating', amount: 100 },
			],
			investing: [],
			financing: [],
			netOperating: 100,
			netInvesting: 0,
			netFinancing: 0,
			netChangeInCash: 100,
		});
		expect(csv).toContain('cash_flow,2026-10-01,2026-10-31,operating:operating,1-1100,Bank');
		expect(csv).toContain('net_change_in_cash,,Net change in cash,,100');
	});
});
