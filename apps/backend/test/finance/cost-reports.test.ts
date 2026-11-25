/**
 * Cost accounting reports (ERP-0147): project job costing and cost-centre P&L.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { CostReportService } from '../../src/app/finance/services/cost-report.service';

const rp = (rupiah: number) => rupiah * 100;

function service() {
	return new CostReportService(
		{
			byProject: async () => [
				{ projectId: 'p-1', revenue: rp(10_000_000), cost: rp(7_500_000) },
				{ projectId: 'p-2', revenue: 0, cost: rp(9_000_000) },
			],
			projectAccounts: async () => [],
			byDimension: async (_o: string, _f: string, _t: string, dimension: string) =>
				dimension === 'product'
					? [
							{ key: 'prod-a', revenue: rp(6_000_000), cost: rp(4_000_000) },
							{ key: 'prod-b', revenue: rp(2_000_000), cost: rp(500_000) },
							{ key: 'prod-c', revenue: rp(1_000_000), cost: rp(900_000) },
							{ key: null, revenue: 0, cost: rp(1_500_000) },
						]
					: [
							{ key: 'cus-1', revenue: rp(9_000_000), cost: rp(5_400_000) },
							{ key: null, revenue: 0, cost: rp(1_500_000) },
						],
			byCostCenter: async () => [
				{ costCenterId: null, code: null, name: null, revenue: rp(1_000_000), cost: rp(200_000) },
				{ costCenterId: 'cc-2', code: 'OPS', name: 'Operasional', revenue: 0, cost: rp(3_000_000) },
				{ costCenterId: 'cc-1', code: 'INS', name: 'Instalasi', revenue: rp(8_000_000), cost: rp(5_000_000) },
			],
		},
		{ getProject: async (id: string) => ({ id, code: id.toUpperCase(), title: `Proyek ${id}` }) as never },
		{
			findActive: async (_o: string, projectId: string) => (projectId === 'p-1' ? ({ id: 'b-1' } as never) : null),
			listLines: async () => [{ amount: rp(8_000_000) }] as never,
		},
		{ assertCustomer: async (id: string) => ({ id, code: 'CUS-1', name: 'PT Satu' }) as never },
		{
			productsById: async () =>
				new Map([
					['prod-a', { id: 'prod-a', code: 'P-A', name: 'Controller', productCategoryId: 'cat-hw' }],
					['prod-b', { id: 'prod-b', code: 'P-B', name: 'Reader', productCategoryId: 'cat-hw' }],
					['prod-c', { id: 'prod-c', code: 'P-C', name: 'Instalasi', productCategoryId: 'cat-svc' }],
				]) as never,
			categoryNames: async () => new Map([['cat-hw', 'Hardware'], ['cat-svc', 'Jasa instalasi']]),
		},
	);
}

describe('CostReportService', () => {
	test('project costing: margin, margin in basis points, budget, sorted by cost', async () => {
		const report = await service().projectCosting('org-1', '2026-01-01', '2026-12-31');
		expect(report.rows).toEqual([
			{ projectId: 'p-2', code: 'P-2', title: 'Proyek p-2', revenue: 0, cost: rp(9_000_000), margin: -rp(9_000_000), marginBps: null, budget: null },
			{ projectId: 'p-1', code: 'P-1', title: 'Proyek p-1', revenue: rp(10_000_000), cost: rp(7_500_000), margin: rp(2_500_000), marginBps: 2500, budget: rp(8_000_000) },
		]);
	});

	test('cost-centre P&L: result per centre, unassigned last, totals', async () => {
		const report = await service().costCenterPl('org-1', '2026-01-01', '2026-12-31');
		expect(report.rows.map((row) => [row.code, row.result])).toEqual([
			['INS', rp(3_000_000)],
			['OPS', -rp(3_000_000)],
			[null, rp(800_000)],
		]);
		expect(report.totals).toEqual({ revenue: rp(9_000_000), cost: rp(8_200_000), result: rp(800_000) });
	});
});

describe('ReportService contra accounts (ERP-0147 fix)', () => {
	test('sales returns reduce revenue and accumulated depreciation reduces assets', async () => {
		const { ReportService } = await import('../../src/app/finance/services/report.service');
		const accounts = new Map(
			[
				{ id: 'rev', code: '4-1100', name: 'Penjualan', accountType: 'revenue', normalBalance: 'credit' },
				{ id: 'ret', code: '4-1900', name: 'Retur Penjualan', accountType: 'revenue', normalBalance: 'debit' },
				{ id: 'fa', code: '1-2120', name: 'Kendaraan', accountType: 'asset', normalBalance: 'debit' },
				{ id: 'acc', code: '1-2220', name: 'Akumulasi', accountType: 'asset', normalBalance: 'credit' },
				{ id: 'eq', code: '3-1000', name: 'Modal', accountType: 'equity', normalBalance: 'credit' },
			].map((account) => [account.id, account]),
		);
		const activity = [
			{ accountId: 'rev', debit: 0, credit: rp(1_000_000) },
			{ accountId: 'ret', debit: rp(100_000), credit: 0 },
			{ accountId: 'fa', debit: rp(5_000_000), credit: 0 },
			{ accountId: 'acc', debit: 0, credit: rp(1_000_000) },
			{ accountId: 'eq', debit: 0, credit: rp(3_100_000) },
		];
		const service = new ReportService({ listAccountActivity: async () => activity } as never, { listAccountsMap: async () => accounts } as never);
		const pl = await service.profitAndLoss({ organizationId: 'org-1' }, '2026-01-01', '2026-12-31');
		expect(pl.totalRevenue).toBe(rp(900_000));
		expect(pl.revenue.find((line) => line.code === '4-1900')?.amount).toBe(-rp(100_000));
		const bs = await service.balanceSheet({ organizationId: 'org-1' }, '2026-12-31');
		expect(bs.totalAssets).toBe(rp(4_000_000));
		expect(bs.unexplained).toBe(0);
	});
});

describe('CostReportService.profitability (ERP-0150)', () => {
	test('business line groups products by category; the unassigned row keeps the total whole', async () => {
		const report = await service().profitability('org-1', '2026-01-01', '2026-12-31', 'business_line');
		expect(report.rows.map((row) => [row.label, row.revenue, row.cost, row.marginBps])).toEqual([
			['Hardware', rp(8_000_000), rp(4_500_000), 4375],
			['Jasa instalasi', rp(1_000_000), rp(900_000), 1000],
			[null, 0, rp(1_500_000), null],
		]);
		expect(report.totals).toEqual({ revenue: rp(9_000_000), cost: rp(6_900_000), margin: rp(2_100_000) });
	});

	test('customer and product views label their keys', async () => {
		const customers = await service().profitability('org-1', '2026-01-01', '2026-12-31', 'customer');
		expect(customers.rows[0]).toMatchObject({ label: 'CUS-1 — PT Satu', margin: rp(3_600_000) });
		const products = await service().profitability('org-1', '2026-01-01', '2026-12-31', 'product');
		expect(products.rows.map((row) => row.label)).toEqual(['P-A — Controller', 'P-B — Reader', 'P-C — Instalasi', null]);
	});
});
