import { describe, expect, test } from 'bun:test';

import { dashboardQueryOptions, fetchDashboardSummary, formatIdr } from '../../src/lib/dashboard-api';

describe('dashboard mock summary', () => {
	test('provides all six M01 Stage-1 widgets', async () => {
		const summary = await fetchDashboardSummary();
		expect(Object.keys(summary).sort()).toEqual(
			[
				'activity',
				'cash',
				'inventory',
				'profit',
				'projects',
				'quickLinks',
				'sales',
				'salesSeries',
				'subscriptions',
			].sort(),
		);
	});

	test('money values are integer minor units (even hundreds)', async () => {
		const summary = await fetchDashboardSummary();
		const values = [
			summary.sales.invoicedThisMonth,
			summary.sales.invoicedLastMonth,
			summary.sales.openQuotesValue,
			summary.cash.total,
			...summary.cash.accounts.map((account) => account.balance),
			summary.profit.monthToDate,
			summary.inventory.stockValue,
			...summary.salesSeries.map((point) => point.invoiced),
		];
		for (const value of values) {
			expect(Number.isInteger(value)).toBe(true);
			expect(value % 100).toBe(0); // whole rupiah, stored in cents
		}
	});

	test('profit is always provisional in the mock (M01 labelling rule)', async () => {
		const summary = await fetchDashboardSummary();
		expect(summary.profit.provisional).toBe(true);
	});

	test('sales series covers six months ending with the current month', async () => {
		const summary = await fetchDashboardSummary();
		expect(summary.salesSeries).toHaveLength(6);
		const now = new Date();
		const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		expect(summary.salesSeries.at(-1)?.month).toBe(currentKey);
		const months = summary.salesSeries.map((point) => point.month);
		expect(new Set(months).size).toBe(6);
	});

	test('activity entries use known kinds and carry a document code', async () => {
		const summary = await fetchDashboardSummary();
		const kinds = new Set(['quoted', 'invoicePaid', 'stockAdjusted', 'projectHandover']);
		for (const entry of summary.activity) {
			expect(kinds.has(entry.kind)).toBe(true);
			expect(entry.code.length).toBeGreaterThan(0);
		}
	});

	test('quick links point at registered routes with nav keys', async () => {
		const summary = await fetchDashboardSummary();
		expect(summary.quickLinks.length).toBeGreaterThan(0);
		for (const link of summary.quickLinks) {
			expect(link.to.startsWith('/')).toBe(true);
			expect(link.titleKey.startsWith('nav:item.')).toBe(true);
		}
	});
});

describe('formatIdr', () => {
	test('divides minor units by 100 and formats as IDR', () => {
		expect(formatIdr(123456789)).toBe('Rp\u00A01.234.567,89');
	});

	test('formats zero and negative values', () => {
		expect(formatIdr(0)).toBe('Rp\u00A00,00');
		expect(formatIdr(-150000)).toBe('-Rp\u00A01.500,00');
	});
});

describe('dashboardQueryOptions', () => {
	test('uses a stable query key and the mock fetcher', () => {
		const options = dashboardQueryOptions();
		expect(options.queryKey).toEqual(['dashboard', 'summary']);
		expect(options.queryFn).toBe(fetchDashboardSummary);
	});
});
