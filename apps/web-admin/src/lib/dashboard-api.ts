import { queryOptions } from '@tanstack/react-query';

/**
 * Dummy data source for the M01 dashboard.
 *
 * @remarks
 * **Everything here is a placeholder.** The M01 plan (see
 * `docs/plan/erp-module-plans/m01-dashboard.md`) defines six Stage-1 widgets
 * (sales, cash, profit, inventory, projects, subscriptions); each figure here
 * imitates the shape the real API will return so components and types survive
 * the swap.
 *
 * Money is integer IDR **minor units** (rupiah cents, ADR-0002) — display
 * goes through `formatIdr`, never raw division at call sites.
 *
 * ponytail: replace `fetchDashboardSummary` with real `/dashboard/summary`
 * calls when backend modules exist. The M01 plan requires **server-side**
 * permission gating per widget (a viewer without a source-module permission
 * gets no data for that widget) — do not gate on the client.
 */

/** Integer rupiah minor units (100 = Rp 1.00). ADR-0002. */
export type MoneyMinor = number;

export type TSalesSummary = {
	invoicedThisMonth: MoneyMinor;
	invoicedLastMonth: MoneyMinor;
	openQuotesCount: number;
	openQuotesValue: MoneyMinor;
};

export type TCashAccount = {
	name: string;
	balance: MoneyMinor;
};

export type TCashSummary = {
	accounts: TCashAccount[];
	total: MoneyMinor;
};

export type TProfitSummary = {
	/** Unclosed period — must always be labelled provisional in the UI (M01). */
	monthToDate: MoneyMinor;
	provisional: true;
};

export type TInventorySummary = {
	itemCount: number;
	/** HPP is manual, so this is only as fresh as the latest finance summary. */
	stockValue: MoneyMinor;
};

export type TProjectsSummary = {
	planning: number;
	inProgress: number;
	done: number;
	overdue: number;
};

export type TSubscriptionsSummary = {
	endingWithin30Days: number;
	expired: number;
};

/** One month bucket for the sales chart. `month` is a locale-neutral `YYYY-MM`. */
export type TSalesPoint = {
	month: string;
	invoiced: MoneyMinor;
};

/** One activity-feed row. `kind` selects the message key; `code` interpolates. */
export type TActivityEntry = {
	id: string;
	kind: 'quoted' | 'invoicePaid' | 'stockAdjusted' | 'projectHandover';
	code: string;
	occurredAt: string;
};

export type TQuickLink = {
	/** Route path (also the React key). */
	to: string;
	/** `nav:item.*` key — quick links reuse sidebar vocabulary. */
	titleKey: string;
};export type TDashboardSummary = {
	sales: TSalesSummary;
	cash: TCashSummary;
	profit: TProfitSummary;
	inventory: TInventorySummary;
	projects: TProjectsSummary;
	subscriptions: TSubscriptionsSummary;
	salesSeries: TSalesPoint[];
	activity: TActivityEntry[];
	quickLinks: TQuickLink[];
};

/** `YYYY-MM` for a date the given number of months before `base`. */
function monthKey(base: Date, monthsAgo: number): string {
	const date = new Date(base.getFullYear(), base.getMonth() - monthsAgo, 1);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MOCK_SUMMARY: TDashboardSummary = {
	sales: {
		invoicedThisMonth: 3_854_200_00,
		invoicedLastMonth: 3_110_750_00,
		openQuotesCount: 7,
		openQuotesValue: 96_450_000_00,
	},
	cash: {
		accounts: [
			{ name: 'BCA — Operational', balance: 145_320_500_00 },
			{ name: 'Mandiri — Payroll', balance: 38_750_000_00 },
			{ name: 'Cash on hand', balance: 4_215_000_00 },
		],
		total: 188_285_500_00,
	},
	profit: {
		monthToDate: 214_880_000_00,
		provisional: true,
	},
	inventory: {
		itemCount: 342,
		stockValue: 512_940_000_00,
	},
	projects: {
		planning: 3,
		inProgress: 5,
		done: 12,
		overdue: 2,
	},
	subscriptions: {
		endingWithin30Days: 4,
		expired: 1,
	},
	salesSeries: [
		{ month: monthKey(new Date(), 5), invoiced: 2_140_000_00 },
		{ month: monthKey(new Date(), 4), invoiced: 2_485_500_00 },
		{ month: monthKey(new Date(), 3), invoiced: 3_972_250_00 },
		{ month: monthKey(new Date(), 2), invoiced: 3_506_000_00 },
		{ month: monthKey(new Date(), 1), invoiced: 3_110_750_00 },
		{ month: monthKey(new Date(), 0), invoiced: 3_854_200_00 },
	],
	activity: [
		{
			id: 'act-1',
			kind: 'invoicePaid',
			code: 'INV-2026-0187',
			occurredAt: '2026-11-06T09:24:00+07:00',
		},
		{
			id: 'act-2',
			kind: 'quoted',
			code: 'SPH-2026-0142',
			occurredAt: '2026-11-06T08:11:00+07:00',
		},
		{
			id: 'act-3',
			kind: 'stockAdjusted',
			code: 'ADJ-2026-0033',
			occurredAt: '2026-11-05T16:47:00+07:00',
		},
		{
			id: 'act-4',
			kind: 'projectHandover',
			code: 'PRJ-2026-0089',
			occurredAt: '2026-11-05T14:02:00+07:00',
		},
	],
	quickLinks: [
		{ to: '/sales/invoices', titleKey: 'nav:item.invoices' },
		{ to: '/finance/cash-bank', titleKey: 'nav:item.cashBank' },
		{ to: '/inventory/stock', titleKey: 'nav:item.stock' },
		{ to: '/projects', titleKey: 'nav:item.projects' },
		{ to: '/subscription', titleKey: 'nav:item.subscription' },
		{ to: '/admin/audit', titleKey: 'nav:item.auditLog' },
	],
};

/** Resolves the dummy summary. Deliberately synchronous data behind an async signature. */
export async function fetchDashboardSummary(): Promise<TDashboardSummary> {
	return MOCK_SUMMARY;
}

/** Query options for the dashboard summary. */
export const dashboardQueryOptions = () =>
	queryOptions({
		queryKey: ['dashboard', 'summary'],
		queryFn: fetchDashboardSummary,
	});

/**
 * Formats integer IDR minor units for display: 123456789 → "Rp 1.234.567,89".
 *
 * @remarks
 * Pinned to `id-ID` on purpose: the ERP operates in rupiah regardless of UI
 * language, so switching the interface to English must not re-format money.
 */
export function formatIdr(minor: MoneyMinor): string {
	const formatter = new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
	});
	return formatter.format(minor / 100);
}
