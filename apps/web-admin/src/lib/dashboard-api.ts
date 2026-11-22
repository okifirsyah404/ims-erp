import { queryOptions } from '@tanstack/react-query';
import type { TApiResponse } from '@ims-erp/common';

import { API_URL } from './api-url';
import { organizationHeaders } from './organization-store';
import type { TCashBankAccount, TProfitAndLoss } from './finance-api';
import type { TLicenseSummary } from './license-api';
import type { TProjectStats } from './project-api';
import type { TStockValuation } from './stock-valuation-api';
import type { TInvoice, TReceipt } from './invoice-api';

/**
 * Real data for the M01 dashboard (`/`).
 *
 * @remarks
 * The dashboard is a **client composition**: it owns no tables and no backend
 * module, and every number comes from the module that owns it. Each query is
 * keyed by the active organization, so switching organization renders the new
 * organization's figures without manual invalidation and never shows the
 * previous one's numbers.
 *
 * Permission gating stays a server concern: a caller without the source
 * module's permission gets a 403 from that endpoint, and the widget renders as
 * unavailable. The page only avoids issuing requests that are certain to fail.
 *
 * Money is integer IDR **minor units** (rupiah cents, ADR-0002); display goes
 * through `formatIdr`.
 *
 * The fetchers are local on purpose: the owning clients' query options carry
 * their own keys, and the dashboard must key everything by organization.
 * Plan: `docs/plan/plans/dashboard-real-data.md` (D3, D19).
 */

/** Months shown by the invoiced-sales chart. */
export const SALES_CHART_MONTHS = 6;

/** Query-key root shared by every dashboard query (one prefix to invalidate them all). */
export const DASHBOARD_QUERY_ROOT = ['dashboard'] as const;

/**
 * Dashboard freshness: figures refetch every minute.
 *
 * @remarks
 * Also the `staleTime`, so a remount inside the same minute does not refetch.
 * Refresh is silent (no button, no skeleton: a refetch keeps the previous
 * figures until the new ones arrive) and keeps running while the tab is in
 * the background (`refetchIntervalInBackground`, owner decision 2026-11-23,
 * ERP-0113), so the page is current the moment it is looked at again.
 */
export const DASHBOARD_REFRESH_MS = 60 * 1000;

/** Money and counts: `formatIdr` is the only money formatter. */
export { formatIdr } from './format';

/**
 * A Jakarta business date (`YYYY-MM-DD`) shifted by whole months.
 *
 * @remarks
 * Kept on the 1st of the month so month arithmetic never depends on the
 * current day: `addMonths('2026-03-01', -1)` is `2026-02-01`.
 */
export function addMonths(monthStart: string, months: number): string {
	const [year, month] = monthStart.split('-').map(Number) as [number, number];
	return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10);
}

/** `YYYY-MM` of a business date. */
export function monthKey(businessDate: string): string {
	return businessDate.slice(0, 7);
}

/** First day of the month containing `businessDate`. */
export function startOfMonth(businessDate: string): string {
	return `${monthKey(businessDate)}-01`;
}

/** A business date shifted by whole days (UTC arithmetic, no zone drift). */
export function addDays(businessDate: string, days: number): string {
	const [year, month, day] = businessDate.split('-').map(Number) as [number, number, number];
	return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Whole days between two business dates (`to - from`). */
export function daysBetween(from: string, to: string): number {
	const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
	return Math.round(ms / 86_400_000);
}

/**
 * Business date shifted by whole months, clamping the day.
 *
 * @remarks
 * `2026-03-31` minus one month is `2026-02-28`, not 3 March: the range must not
 * silently grow past the requested length.
 */
export function shiftMonths(businessDate: string, months: number): string {
	const [year, month, day] = businessDate.split('-').map(Number) as [number, number, number];
	const target = new Date(Date.UTC(year, month - 1 + months, 1));
	const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
	target.setUTCDate(Math.min(day, lastDay));
	return target.toISOString().slice(0, 10);
}

/** Window for the sales card and chart, in Jakarta business dates. */
export type TSalesWindow = {
	from: string;
	to: string;
	/** First day of the current month. */
	currentFrom: string;
	/** First day of the previous month. */
	previousFrom: string;
};

/**
 * Builds the sales window from today's business date.
 *
 * @remarks
 * `to` is today, not the end of the month: an invoice dated in the future must
 * not count as already invoiced.
 */
export function salesWindow(today: string): TSalesWindow {
	const currentFrom = startOfMonth(today);
	return {
		from: addMonths(currentFrom, -(SALES_CHART_MONTHS - 1)),
		to: today,
		currentFrom,
		previousFrom: addMonths(currentFrom, -1),
	};
}

/**
 * Percentage change between two figures, or `null` when there is no base.
 *
 * @remarks
 * Divides by the absolute base so a figure that can be negative (net cash
 * flow) still reads "up" when it improves.
 */
export function deltaPercent(current: number, previous: number): number | null {
	if (previous === 0) return null;
	return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

/** A bucket label: short month for `YYYY-MM`, day + month for `YYYY-MM-DD`. */
export function bucketLabel(period: string, language: string): string {
	const locale = language === 'en' ? 'en-GB' : 'id-ID';
	if (period.length === 7) {
		const [year, monthIndex] = period.split('-').map(Number) as [number, number];
		return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
			new Date(Date.UTC(year, monthIndex - 1, 1)),
		);
	}
	const [year, monthIndex, day] = period.split('-').map(Number) as [number, number, number];
	return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
		new Date(Date.UTC(year, monthIndex - 1, day)),
	);
}

/** Preset spans offered by the invoiced-sales chart. `custom` uses the picker. */
export const SALES_RANGES = ['14d', '1m', '3m', '6m', '1y', '5y', 'custom'] as const;
export type TSalesRange = (typeof SALES_RANGES)[number];

/** A resolved chart window: business dates plus the bucket size to ask for. */
export type TSalesChartWindow = {
	from: string;
	to: string;
	groupBy: 'month' | 'day';
};

/**
 * Bucket size for a window.
 *
 * @remarks
 * Daily buckets only for short spans: a year of daily bars is unreadable and a
 * five-year window would be 1 800 bars. One month and below is daily, above
 * that monthly.
 */
function groupByFor(from: string, to: string): 'month' | 'day' {
	return daysBetween(from, to) <= 31 ? 'day' : 'month';
}

/**
 * Resolves a preset (or a custom range) into a chart window.
 *
 * @remarks
 * Every preset is a **rolling** window ending today, so "1 bulan" means the last
 * month, not the calendar month. An incomplete custom range falls back to the
 * 6-month default instead of firing a half-open request.
 */
export function salesChartWindow(
	today: string,
	range: TSalesRange,
	custom?: { from?: string; to?: string },
): TSalesChartWindow {
	if (range === 'custom' && custom?.from && custom.to && custom.from <= custom.to) {
		return { from: custom.from, to: custom.to, groupBy: groupByFor(custom.from, custom.to) };
	}
	const start: Record<Exclude<TSalesRange, 'custom'>, () => string> = {
		'14d': () => addDays(today, -13),
		'1m': () => addDays(shiftMonths(today, -1), 1),
		'3m': () => addDays(shiftMonths(today, -3), 1),
		'6m': () => addDays(shiftMonths(today, -6), 1),
		'1y': () => addDays(shiftMonths(today, -12), 1),
		'5y': () => addDays(shiftMonths(today, -60), 1),
	};
	const from = range === 'custom' ? salesChartWindow(today, '6m').from : start[range]();
	return { from, to: today, groupBy: groupByFor(from, today) };
}


/** Invoiced totals per period, `GET /invoices/summary` (zero-filled). */
export type TInvoiceSummary = {
	from: string;
	to: string;
	groupBy: 'month' | 'day';
	totalInvoiced: number;
	invoiceCount: number;
	buckets: Array<{ period: string; invoiced: number; count: number }>;
};

/**
 * Cash in/out per period,
 * `GET /finance/cash-bank-transactions/summary` (zero-filled, ERP-0113).
 *
 * @remarks
 * Cash basis: posted movements of every cash/bank account, opening balances
 * excluded. Amounts are IDR minor units; `totalOut` is positive.
 */
export type TCashFlowSummary = {
	from: string;
	to: string;
	groupBy: 'month' | 'day';
	totalIn: number;
	totalOut: number;
	net: number;
	buckets: Array<{ period: string; totalIn: number; totalOut: number }>;
};

/** A plain business-date window, both ends inclusive. */
export type TDateWindow = { from: string; to: string };

/**
 * Month to date and the same span of the previous month.
 *
 * @remarks
 * The comparison must be fair: on the 23rd, 1-23 November is compared with
 * 1-23 October, not with the whole of October. `shiftMonths` clamps the day,
 * so on 31 March the previous window is the whole of February.
 */
export function monthToDateWindows(today: string): {
	current: TDateWindow;
	previous: TDateWindow;
} {
	const previousTo = shiftMonths(today, -1);
	return {
		current: { from: startOfMonth(today), to: today },
		previous: { from: startOfMonth(previousTo), to: previousTo },
	};
}

/** One page of rows plus pagination, the shape every list endpoint returns. */
type TPage<T> = { rows: T[]; total: number };

/**
 * GET with the active organization header; throws the server's message.
 *
 * @remarks
 * `envelope.data` is typed nullable by the shared envelope, so the caller states
 * the expected payload.
 */
async function getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
	const search = params ? `?${new URLSearchParams(params)}` : '';
	const response = await fetch(`${API_URL}${path}${search}`, {
		credentials: 'include',
		headers: organizationHeaders(),
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope.data as T;
}

/** Paginated GET: keeps the `pagination.total` the item count needs. */
async function getPage<T>(path: string, params: Record<string, string>): Promise<TPage<T>> {
	const search = `?${new URLSearchParams(params)}`;
	const response = await fetch(`${API_URL}${path}${search}`, {
		credentials: 'include',
		headers: organizationHeaders(),
	});
	const envelope = (await response.json()) as TApiResponse<T[]> & {
		pagination?: { total: number };
	};
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return { rows: (envelope.data as T[] | null) ?? [], total: envelope.pagination?.total ?? 0 };
}

/**
 * Invoiced sales for a window: one request, every period present.
 *
 * @remarks
 * One request feeds the card and the chart: the page picks the current and
 * previous month out of the same buckets. `groupBy` comes from the resolved
 * window (`day` for a month or less, `month` above it).
 */
export function salesSummaryQueryOptions(organizationId: string | null, window: TSalesChartWindow) {
	return queryOptions({
		queryKey: ['dashboard', 'sales', organizationId, window.from, window.to, window.groupBy] as const,
		queryFn: () =>
			getJson<TInvoiceSummary>('/sales/invoices/summary', {
				from: window.from,
				to: window.to,
				groupBy: window.groupBy,
			}),
		enabled: organizationId !== null,
		staleTime: DASHBOARD_REFRESH_MS,
		refetchInterval: DASHBOARD_REFRESH_MS,
		refetchIntervalInBackground: true,
	});
}

/**
 * Cash in/out for a window (`GET /finance/cash-bank-transactions/summary`).
 *
 * @remarks
 * Feeds both the KPI cards (month-to-date windows, monthly buckets) and the
 * income-vs-outcome chart (the chart's window). Gated on `cash_bank:read`.
 */
export function cashFlowSummaryQueryOptions(
	organizationId: string | null,
	window: TSalesChartWindow,
	enabled: boolean,
) {
	return queryOptions({
		queryKey: [
			'dashboard',
			'cash-flow',
			organizationId,
			window.from,
			window.to,
			window.groupBy,
		] as const,
		queryFn: () =>
			getJson<TCashFlowSummary>('/finance/cash-bank-transactions/summary', {
				from: window.from,
				to: window.to,
				groupBy: window.groupBy,
			}),
		enabled: enabled && organizationId !== null,
		staleTime: DASHBOARD_REFRESH_MS,
		refetchInterval: DASHBOARD_REFRESH_MS,
		refetchIntervalInBackground: true,
	});
}

/** Cash and bank balances, every account (`GET /finance/cash-bank-accounts`). */
export function dashboardCashQueryOptions(organizationId: string | null, enabled: boolean) {
	return queryOptions({
		queryKey: ['dashboard', 'cash', organizationId] as const,
		queryFn: () => getJson<TCashBankAccount[]>('/finance/cash-bank-accounts'),
		enabled: enabled && organizationId !== null,
		staleTime: DASHBOARD_REFRESH_MS,
		refetchInterval: DASHBOARD_REFRESH_MS,
		refetchIntervalInBackground: true,
	});
}

/** Profit and loss for a window (`GET /finance/reports/profit-and-loss`). */
export function dashboardProfitQueryOptions(
	organizationId: string | null,
	range: { from: string; to: string },
	enabled: boolean,
) {
	return queryOptions({
		queryKey: ['dashboard', 'profit', organizationId, range.from, range.to] as const,
		queryFn: () =>
			getJson<TProfitAndLoss>('/finance/reports/profit-and-loss', {
				startDate: range.from,
				endDate: range.to,
			}),
		enabled: enabled && organizationId !== null,
		staleTime: DASHBOARD_REFRESH_MS,
		refetchInterval: DASHBOARD_REFRESH_MS,
		refetchIntervalInBackground: true,
	});
}

/** Product count: the `total` of a one-row page (`GET /products`). */
export function dashboardItemCountQueryOptions(organizationId: string | null, enabled: boolean) {
	return queryOptions({
		queryKey: ['dashboard', 'items', organizationId] as const,
		queryFn: async () => (await getPage('/products', { page: '1', limit: '1' })).total,
		enabled: enabled && organizationId !== null,
		staleTime: DASHBOARD_REFRESH_MS,
		refetchInterval: DASHBOARD_REFRESH_MS,
		refetchIntervalInBackground: true,
	});
}

/** Stock value at moving-average cost (`GET /stock/valuation`). */
export function dashboardStockValueQueryOptions(organizationId: string | null, enabled: boolean) {
	return queryOptions({
		queryKey: ['dashboard', 'stock-value', organizationId] as const,
		queryFn: async () =>
			(await getJson<TStockValuation>('/stock/valuation', { page: '1', limit: '1' })).grandTotal,
		enabled: enabled && organizationId !== null,
		staleTime: DASHBOARD_REFRESH_MS,
		refetchInterval: DASHBOARD_REFRESH_MS,
		refetchIntervalInBackground: true,
	});
}

/** Counts by status and stage, plus overdue (`GET /projects/stats`). */
export function dashboardProjectsQueryOptions(organizationId: string | null, enabled: boolean) {
	return queryOptions({
		queryKey: ['dashboard', 'projects', organizationId] as const,
		queryFn: () => getJson<TProjectStats>('/projects/stats'),
		enabled: enabled && organizationId !== null,
		staleTime: DASHBOARD_REFRESH_MS,
		refetchInterval: DASHBOARD_REFRESH_MS,
		refetchIntervalInBackground: true,
	});
}

/** Licenses ending soon or expired (`GET /licenses/summary`). */
export function dashboardSubscriptionsQueryOptions(organizationId: string | null, enabled: boolean) {
	return queryOptions({
		queryKey: ['dashboard', 'subscriptions', organizationId] as const,
		queryFn: () => getJson<TLicenseSummary>('/projects/licenses/summary'),
		enabled: enabled && organizationId !== null,
		staleTime: DASHBOARD_REFRESH_MS,
		refetchInterval: DASHBOARD_REFRESH_MS,
		refetchIntervalInBackground: true,
	});
}

/** The five newest invoices, for the activity feed. */
export function dashboardRecentInvoicesQueryOptions(organizationId: string | null, enabled: boolean) {
	return queryOptions({
		queryKey: ['dashboard', 'recent-invoices', organizationId] as const,
		queryFn: () => getPage<TInvoice>('/sales/invoices', { page: '1', limit: '5' }),
		enabled: enabled && organizationId !== null,
		staleTime: DASHBOARD_REFRESH_MS,
		refetchInterval: DASHBOARD_REFRESH_MS,
		refetchIntervalInBackground: true,
	});
}

/** The five newest receipts, for the activity feed. */
export function dashboardRecentReceiptsQueryOptions(organizationId: string | null, enabled: boolean) {
	return queryOptions({
		queryKey: ['dashboard', 'recent-receipts', organizationId] as const,
		queryFn: () =>
			getPage<TReceipt & { invoiceCode: string | null; customerName: string }>('/sales/receipts', {
				page: '1',
				limit: '5',
			}),
		enabled: enabled && organizationId !== null,
		staleTime: DASHBOARD_REFRESH_MS,
		refetchInterval: DASHBOARD_REFRESH_MS,
		refetchIntervalInBackground: true,
	});
}
