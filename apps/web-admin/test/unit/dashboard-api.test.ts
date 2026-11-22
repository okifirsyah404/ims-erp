import { describe, expect, test } from 'bun:test';

import {
	addMonths,
	bucketLabel,
	deltaPercent,
	cashFlowSummaryQueryOptions,
	monthToDateWindows,
	DASHBOARD_QUERY_ROOT,
	DASHBOARD_REFRESH_MS,
	dashboardCashQueryOptions,
	dashboardItemCountQueryOptions,
	dashboardProfitQueryOptions,
	dashboardProjectsQueryOptions,
	dashboardRecentInvoicesQueryOptions,
	dashboardRecentReceiptsQueryOptions,
	dashboardStockValueQueryOptions,
	dashboardSubscriptionsQueryOptions,
	daysBetween,
	formatIdr,
	monthKey,
	SALES_RANGES,
	salesChartWindow,
	salesSummaryQueryOptions,
	salesWindow,
	SALES_CHART_MONTHS,
	shiftMonths,
	startOfMonth,
} from '../../src/lib/dashboard-api';

describe('Jakarta month arithmetic', () => {
	test('addMonths stays on the 1st and crosses year boundaries', () => {
		expect(addMonths('2026-03-01', -1)).toBe('2026-02-01');
		expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
		expect(addMonths('2026-11-01', 2)).toBe('2027-01-01');
	});

	test('monthKey and startOfMonth read the business date', () => {
		expect(monthKey('2026-11-15')).toBe('2026-11');
		expect(startOfMonth('2026-11-15')).toBe('2026-11-01');
	});
});

describe('salesWindow', () => {
	test('covers the chart months ending today, not the end of the month', () => {
		const window = salesWindow('2026-11-15');
		expect(window.to).toBe('2026-11-15');
		expect(window.currentFrom).toBe('2026-11-01');
		expect(window.previousFrom).toBe('2026-10-01');
		// Six months inclusive: Jun..Nov.
		expect(window.from).toBe('2026-06-01');
	});

	test('the chart length constant matches the window', () => {
		expect(SALES_CHART_MONTHS).toBe(6);
		const window = salesWindow('2026-11-15');
		expect(monthKey(window.from)).toBe('2026-06');
	});
});

describe('salesChartWindow', () => {
	const today = '2026-11-15';

	test('every preset is a rolling window ending today', () => {
		for (const range of SALES_RANGES) {
			if (range === 'custom') continue;
			const window = salesChartWindow(today, range);
			expect(window.to).toBe(today);
			expect(window.from < window.to).toBe(true);
		}
	});

	test('14 days is exactly two weeks and uses daily buckets', () => {
		const window = salesChartWindow(today, '14d');
		expect(window.from).toBe('2026-11-02');
		expect(daysBetween(window.from, window.to)).toBe(13);
		expect(window.groupBy).toBe('day');
	});

	test('1 month and below buckets by day, above by month', () => {
		expect(salesChartWindow(today, '1m').groupBy).toBe('day');
		expect(salesChartWindow(today, '3m').groupBy).toBe('month');
		expect(salesChartWindow(today, '6m').groupBy).toBe('month');
		expect(salesChartWindow(today, '1y').groupBy).toBe('month');
		expect(salesChartWindow(today, '5y').groupBy).toBe('month');
	});

	test('each preset has the length its label claims', () => {
		const span = (range: Parameters<typeof salesChartWindow>[1]) => {
			const window = salesChartWindow(today, range);
			return daysBetween(window.from, window.to) + 1;
		};
		expect(span('14d')).toBe(14);
		expect(span('1m')).toBe(31); // 16 Oct – 15 Nov
		expect(span('3m')).toBe(92); // 16 Aug – 15 Nov
		expect(span('6m')).toBe(184); // 16 May – 15 Nov
		expect(span('1y')).toBe(365); // 16 Nov 2025 – 15 Nov 2026
		expect(span('5y')).toBe(1826); // 16 Nov 2021 – 15 Nov 2026, leap day included
	});

	test('month arithmetic clamps the day instead of overflowing', () => {
		// 31 March minus one month must be 28 February, not 3 March.
		expect(shiftMonths('2026-03-31', -1)).toBe('2026-02-28');
		expect(shiftMonths('2026-05-31', -3)).toBe('2026-02-28');
		expect(shiftMonths('2026-01-15', -1)).toBe('2025-12-15');
	});

	test('a complete custom range is used as given', () => {
		const window = salesChartWindow(today, 'custom', { from: '2026-01-01', to: '2026-02-15' });
		expect(window).toEqual({ from: '2026-01-01', to: '2026-02-15', groupBy: 'month' });
	});

	test('a short custom range buckets by day', () => {
		const window = salesChartWindow(today, 'custom', { from: '2026-11-01', to: '2026-11-15' });
		expect(window.groupBy).toBe('day');
	});

	test('an incomplete or inverted custom range falls back to six months', () => {
		const fallback = salesChartWindow(today, '6m');
		expect(salesChartWindow(today, 'custom', {})).toEqual(fallback);
		expect(salesChartWindow(today, 'custom', { from: '2026-11-01' })).toEqual(fallback);
		expect(
			salesChartWindow(today, 'custom', { from: '2026-11-15', to: '2026-11-01' }),
		).toEqual(fallback);
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

describe('dashboard query keys', () => {
	test('every key starts with the dashboard root so one prefix invalidates the page', () => {
		const keys = [
			salesSummaryQueryOptions('org-a', salesWindow('2026-11-15')).queryKey,
			dashboardCashQueryOptions('org-a', true).queryKey,
			dashboardProfitQueryOptions('org-a', { from: '2026-11-01', to: '2026-11-15' }, true).queryKey,
			dashboardItemCountQueryOptions('org-a', true).queryKey,
			dashboardProjectsQueryOptions('org-a', true).queryKey,
			dashboardSubscriptionsQueryOptions('org-a', true).queryKey,
		];
		for (const key of keys) {
			expect(key[0]).toBe(DASHBOARD_QUERY_ROOT[0]);
		}
	});

	test('keys carry the organization, so switching organization changes every entry', () => {
		const a = dashboardCashQueryOptions('org-a', true).queryKey;
		const b = dashboardCashQueryOptions('org-b', true).queryKey;
		expect(a).not.toEqual(b);
		expect(a).toContain('org-a');
		expect(b).toContain('org-b');
	});

	test('no organization means no query runs', () => {
		expect(dashboardCashQueryOptions(null, true).enabled).toBe(false);
		expect(dashboardProjectsQueryOptions(null, true).enabled).toBe(false);
		expect(salesSummaryQueryOptions(null, salesWindow('2026-11-15')).enabled).toBe(false);
	});

	test('a missing permission disables the query before any request', () => {
		expect(dashboardCashQueryOptions('org-a', false).enabled).toBe(false);
		expect(dashboardItemCountQueryOptions('org-a', false).enabled).toBe(false);
	});

	test('every widget refetches on the shared one-minute interval', () => {
		const window = salesWindow('2026-11-15');
		const options = [
			salesSummaryQueryOptions('org-a', window),
			dashboardCashQueryOptions('org-a', true),
			dashboardProfitQueryOptions('org-a', { from: '2026-11-01', to: '2026-11-15' }, true),
			dashboardItemCountQueryOptions('org-a', true),
			dashboardStockValueQueryOptions('org-a', true),
			dashboardProjectsQueryOptions('org-a', true),
			dashboardSubscriptionsQueryOptions('org-a', true),
			dashboardRecentInvoicesQueryOptions('org-a', true),
			dashboardRecentReceiptsQueryOptions('org-a', true),
		];
		for (const entry of options) {
			expect(entry.refetchInterval).toBe(DASHBOARD_REFRESH_MS);
			// Same value as the stale time, so a remount never double-fetches.
			expect(entry.staleTime).toBe(DASHBOARD_REFRESH_MS);
		}
		expect(DASHBOARD_REFRESH_MS).toBe(60_000);
	});
});

describe('monthToDateWindows', () => {
	test('compares the same span of the previous month', () => {
		expect(monthToDateWindows('2026-11-23')).toEqual({
			current: { from: '2026-11-01', to: '2026-11-23' },
			previous: { from: '2026-10-01', to: '2026-10-23' },
		});
	});

	test('clamps to the end of a shorter previous month', () => {
		expect(monthToDateWindows('2026-03-31').previous).toEqual({
			from: '2026-02-01',
			to: '2026-02-28',
		});
	});

	test('crosses the year boundary', () => {
		expect(monthToDateWindows('2026-01-15').previous).toEqual({
			from: '2025-12-01',
			to: '2025-12-15',
		});
	});
});

describe('cashFlowSummaryQueryOptions', () => {
	const window = { from: '2026-11-01', to: '2026-11-23', groupBy: 'day' as const };

	test('keys by organization and window under the dashboard root', () => {
		const options = cashFlowSummaryQueryOptions('org-1', window, true);
		expect(options.queryKey).toEqual([
			'dashboard',
			'cash-flow',
			'org-1',
			'2026-11-01',
			'2026-11-23',
			'day',
		]);
		expect(options.enabled).toBe(true);
	});

	test('is disabled without permission or organization', () => {
		expect(cashFlowSummaryQueryOptions('org-1', window, false).enabled).toBe(false);
		expect(cashFlowSummaryQueryOptions(null, window, true).enabled).toBe(false);
	});
});

describe('deltaPercent', () => {
	test('is null without a base', () => {
		expect(deltaPercent(500, 0)).toBeNull();
	});

	test('rounds the change against the base', () => {
		expect(deltaPercent(150, 100)).toBe(50);
		expect(deltaPercent(50, 100)).toBe(-50);
	});

	test('reads an improving negative figure as up', () => {
		// Net cash flow from -100 to -50 is better, so the change is positive.
		expect(deltaPercent(-50, -100)).toBe(50);
	});
});

describe('bucketLabel', () => {
	test('month buckets are a short month name', () => {
		expect(bucketLabel('2026-11', 'en')).toBe('Nov');
	});

	test('day buckets carry the day', () => {
		expect(bucketLabel('2026-11-05', 'en')).toBe('5 Nov');
	});
});

describe('dashboard background refresh', () => {
	test('every dashboard query refetches each minute, also in a background tab', () => {
		const window = { from: '2026-11-01', to: '2026-11-23', groupBy: 'day' as const };
		const all = [
			salesSummaryQueryOptions('org-1', window),
			cashFlowSummaryQueryOptions('org-1', window, true),
			dashboardCashQueryOptions('org-1', true),
			dashboardProfitQueryOptions('org-1', { from: window.from, to: window.to }, true),
			dashboardItemCountQueryOptions('org-1', true),
			dashboardStockValueQueryOptions('org-1', true),
			dashboardProjectsQueryOptions('org-1', true),
			dashboardSubscriptionsQueryOptions('org-1', true),
			dashboardRecentInvoicesQueryOptions('org-1', true),
			dashboardRecentReceiptsQueryOptions('org-1', true),
		];
		for (const options of all) {
			expect(options.refetchInterval).toBe(DASHBOARD_REFRESH_MS);
			expect(options.refetchIntervalInBackground).toBe(true);
		}
		expect(DASHBOARD_REFRESH_MS).toBe(60_000);
	});
});
