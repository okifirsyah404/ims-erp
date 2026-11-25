/**
 * Monthly management pack (ERP-0152): project budget vs actual for the month
 * and year to date, assembly from the report services, XLSX output, and the
 * archive hook.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { ManagementPackService, packMonthRange } from '../../src/app/finance/services/management-pack.service';
import { ReportArchiveService } from '../../src/app/finance/services/report-archive.service';

const budgets = [
	{ id: 'b1', projectId: 'p1' },
	{ id: 'b2', projectId: 'p2' },
	{ id: 'b3', projectId: 'p3' },
];
const lines: Record<string, Array<{ period: string; amount: number }>> = {
	b1: [
		{ period: '2026-10', amount: 1_000 },
		{ period: '2026-11', amount: 2_000 },
		{ period: '2026-12', amount: 9_000 },
	],
	b2: [{ period: '2026-11', amount: 500 }],
	b3: [{ period: '2025-11', amount: 700 }],
};
const actuals: Record<string, Array<{ accountId: string; period: string; amount: number }>> = {
	p1: [
		{ accountId: 'a', period: '2026-10', amount: 1_200 },
		{ accountId: 'a', period: '2026-11', amount: 1_500 },
	],
	p2: [{ accountId: 'a', period: '2026-11', amount: 800 }],
	p3: [],
};

const service = () =>
	new ManagementPackService(
		{
			profitAndLoss: async (_c: unknown, from: string, to: string) => ({ startDate: from, endDate: to, revenue: [], expenses: [], totalRevenue: 3_000, totalExpenses: 2_000, netIncome: 1_000 }),
			balanceSheet: async (_c: unknown, asOf: string) => ({ asOfDate: asOf, assets: [], liabilities: [], equity: [], totalAssets: 5_000, totalLiabilities: 2_000, totalEquity: 3_000, unexplained: 0 }),
		},
		{
			build: async (_o: string, from: string, to: string) =>
				({
					from,
					to,
					directCashFlow: {
						operating: { lines: [{ accountId: 'x', code: '4-1100', name: 'Sales', amount: 900 }], total: 900 },
						investing: { lines: [], total: 0 },
						financing: { lines: [], total: 0 },
						netChange: 900,
						openingCash: 100,
						closingCash: 1_000,
						tieDifference: 0,
					},
					indirectCashFlow: {},
					changesInEquity: {},
				}) as never,
		},
		{ ratios: async () => ({ liquidity: { current: 2, quick: 1, cash: 0.5 }, profitability: { grossMargin: 0.4, netMargin: 0.1, returnOnAssets: null, returnOnEquity: null }, leverage: { debtToEquity: 1 }, efficiency: { dso: 5, dpo: null, dio: null } }) as never },
		{ profitability: async () => ({ rows: [{ key: null, label: null, revenue: 3_000, cost: 2_000, margin: 1_000, marginBps: 3333 }], totals: { revenue: 3_000, cost: 2_000, margin: 1_000 } }) as never },
		{
			listActiveBudgets: async () => budgets as never,
			listLines: async (_o: string, id: string) => (lines[id] ?? []) as never,
			actuals: async (_o: string, projectId: string) => actuals[projectId] ?? [],
		},
		{ getProject: async (id: string) => ({ id, code: id.toUpperCase(), title: `Project ${id}` }) as never },
		{ findPeriodByMonth: async () => ({ status: 'closed' }) as never },
	);

describe('ManagementPackService', () => {
	test('month range covers the calendar month', () => {
		expect(packMonthRange(2026, 2)).toEqual({ period: '2026-02', from: '2026-02-01', to: '2026-02-28' });
		expect(packMonthRange(2026, 11).to).toBe('2026-11-30');
	});

	test('budget vs actual per project, month and year to date, overruns first', async () => {
		const result = await service().budgetVsActual('org-1', 2026, 11);
		// p3 only has a 2025 line: nothing in 2026, left out.
		expect(result.rows.map((row) => row.projectId)).toEqual(['p2', 'p1']);
		expect(result.rows[0]).toMatchObject({ code: 'P2', budget: 500, actual: 800, variance: -300, budgetToDate: 500, actualToDate: 800 });
		expect(result.rows[1]).toMatchObject({ budget: 2_000, actual: 1_500, variance: 500, budgetToDate: 3_000, actualToDate: 2_700 });
		expect(result.totals).toEqual({ budget: 2_500, actual: 2_300, budgetToDate: 3_500, actualToDate: 3_500, variance: 200 });
	});

	test('build assembles the month from the report services', async () => {
		const pack = await service().build('org-1', 2026, 11);
		expect(pack).toMatchObject({ year: 2026, month: 11, from: '2026-11-01', to: '2026-11-30', periodStatus: 'closed' });
		expect(pack.profitAndLoss.netIncome).toBe(1_000);
		expect(pack.balanceSheet.asOfDate).toBe('2026-11-30');
		expect(pack.cashFlow.closingCash).toBe(1_000);
		expect(pack.budgetVsActual.totals.variance).toBe(200);
	});

	test('xlsx is a zip workbook', async () => {
		const s = service();
		const buffer = await s.toXlsx(await s.build('org-1', 2026, 11));
		expect(buffer.subarray(0, 2).toString()).toBe('PK');
		expect(buffer.length).toBeGreaterThan(1_000);
	});

	test('archiving a closed month stores the pack next to the statements', async () => {
		const inserted: string[] = [];
		const archive = new ReportArchiveService(
			{ insert: async (row: { reportType: string }) => (inserted.push(row.reportType), row) } as never,
			{ findPeriodByMonth: async () => ({ status: 'closed' }) } as never,
			{ profitAndLoss: async () => ({}), balanceSheet: async () => ({}), cashFlow: async () => ({}) } as never,
			{ build: async () => ({ year: 2026 }) as never },
		);
		const created = await archive.archivePeriod({ organizationId: 'org-1', actorUserId: 'u1' }, 2026, 11);
		expect(inserted).toEqual(['profit_and_loss', 'balance_sheet', 'cash_flow', 'management_pack']);
		expect(created).toHaveLength(4);
	});
});
