import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RotateCw } from 'lucide-react';
import { useState } from 'react';
import type { TranslationKey } from '@ims-erp/locales';
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from '@ims-erp/ui/components/chart';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { DateRangePicker, type TDateRangeValue } from '@ims-erp/ui/components/date-range-picker';
import { ToggleGroup, ToggleGroupItem } from '@ims-erp/ui/components/toggle-group';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@ims-erp/ui/components/empty';

import {
	DASHBOARD_QUERY_ROOT,
	dashboardCashQueryOptions,
	dashboardItemCountQueryOptions,
	dashboardProfitQueryOptions,
	dashboardProjectsQueryOptions,
	dashboardRecentInvoicesQueryOptions,
	dashboardRecentReceiptsQueryOptions,
	dashboardStockValueQueryOptions,
	dashboardSubscriptionsQueryOptions,
	formatIdr,
	monthKey,
	SALES_RANGES,
	type TSalesRange,
	salesChartWindow,
	salesSummaryQueryOptions,
	salesWindow,
} from '@/lib/dashboard-api';
import { formatDateTime, todayBusinessDate } from '@/lib/format';
import type { TProjectStage } from '@/lib/project-api';
import { useActiveOrganizationId } from '@/lib/use-active-organization';
import { usePermission } from '@/lib/use-permission';

/** A `nav`-qualified key (`nav:item.invoices`), reusable in any scope. */
type QualifiedNavKey = Extract<TranslationKey, `nav:${string}`>;

/** Project stage labels live in the `projects` namespace, in pipeline order. */
const STAGE_KEYS: Record<TProjectStage, `projects:stage.${TProjectStage}`> = {
	preparation: 'projects:stage.preparation',
	delivery: 'projects:stage.delivery',
	installation: 'projects:stage.installation',
	testing: 'projects:stage.testing',
	training: 'projects:stage.training',
	handover: 'projects:stage.handover',
	warranty: 'projects:stage.warranty',
};

/**
 * The M01 dashboard — one read-only overview across modules, on real data
 * (`docs/plan/erp-module-plans/m01-dashboard.md`).
 *
 * @remarks
 * **Client composition, no backend dashboard module.** Each widget reads the
 * endpoint of the module that owns the number (see `lib/dashboard-api.ts`).
 * Consequences worth knowing:
 * - every widget is gated on its **source module's** permission, and the server
 *   remains the enforcer — a hidden widget is a convenience, not a boundary;
 * - each widget owns its loading / empty / error state, so one failing module
 *   degrades one card instead of blanking the page;
 * - all keys carry the active organization id, so switching organization
 *   re-renders every figure instead of showing the previous one's numbers.
 */
export function DashboardPage() {
	const { t } = useTranslation(['dashboard', 'nav']);
	const organizationId = useActiveOrganizationId();
	const queryClient = useQueryClient();
	const today = todayBusinessDate();
	const window = salesWindow(today);
	const [salesRange, setSalesRange] = useState<TSalesRange>('6m');
	const [customRange, setCustomRange] = useState<TDateRangeValue>({});
	const chartWindow = salesChartWindow(today, salesRange, customRange);

	// No active organization (Q6): say so and point at the organizations page.
	// Rendering zeros here would look like real figures.
	if (organizationId === null) {
		return (
			<Empty className='flex-1'>
				<EmptyHeader>
					<EmptyTitle>{t('nav:organization.required')}</EmptyTitle>
					<EmptyDescription>{t('empty.noOrganization')}</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Link
						to='/organizations'
						className='inline-flex h-8 items-center rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted'
					>
						{t('nav:organization.manage')}
					</Link>
				</EmptyContent>
			</Empty>
		);
	}

	return (
		<div className='flex flex-1 flex-col gap-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{t('title')}</h1>
					<p className='text-sm text-muted-foreground'>
						{t('subtitle', { date: formatDateTime(`${today}T00:00:00+07:00`) })}
					</p>
				</div>
				<Button
					variant='outline'
					size='sm'
					className='shrink-0'
					onClick={() =>
						void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_ROOT })
					}
				>
					<RotateCw />
					{t('action.refresh')}
				</Button>
			</div>

			<SalesChartCard
				organizationId={organizationId}
				window={chartWindow}
				range={salesRange}
				onRangeChange={setSalesRange}
				custom={customRange}
				onCustomChange={setCustomRange}
				today={today}
			/>

			<div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
				<SalesWidget organizationId={organizationId} window={window} />
				<CashWidget organizationId={organizationId} />
				<ProfitWidget organizationId={organizationId} range={{ from: window.currentFrom, to: today }} />
				<InventoryWidget organizationId={organizationId} />
				<ProjectsWidget organizationId={organizationId} />
				<SubscriptionsWidget organizationId={organizationId} />
			</div>

			<div className='grid gap-4 lg:grid-cols-3'>
				<ActivityCard organizationId={organizationId} />
				<QuickLinksCard />
			</div>
		</div>
	);
}

/** One figure line inside a widget: label, value, optional trailing node. */
function Figure({
	label,
	value,
	trailing,
}: {
	label: string;
	value: string;
	trailing?: ReactNode;
}) {
	return (
		<div className='flex items-baseline justify-between gap-2'>
			<span className='text-sm text-muted-foreground'>{label}</span>
			<span className='flex items-baseline gap-2 text-right'>
				<span className='text-sm font-medium tabular-nums'>{value}</span>
				{trailing}
			</span>
		</div>
	);
}

/** Widget shell: title, optional description, and a link to the source list. */
function Widget({
	title,
	description,
	to,
	titleKeyLink,
	children,
}: {
	title: string;
	description?: string;
	to: string;
	/** `nav:item.*` key for the "View all" link title. */
	titleKeyLink: QualifiedNavKey;
	children: ReactNode;
}) {
	const { t } = useTranslation(['dashboard', 'nav']);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description && <CardDescription>{description}</CardDescription>}
				<CardAction>
					<Link
						to={to}
						className='text-xs font-normal text-muted-foreground hover:text-foreground'
					>
						{t('action.viewAll')} · {t(titleKeyLink)}
					</Link>
				</CardAction>
			</CardHeader>
			<CardContent className='flex flex-col gap-2'>{children}</CardContent>
		</Card>
	);
}

/**
 * Body of a widget that reads a query: skeleton while loading, an inline retry
 * when the request fails (403 for a missing permission, 5xx, offline), and the
 * caller's rows otherwise.
 */
function QueryBody({
	isPending,
	isError,
	onRetry,
	children,
}: {
	isPending: boolean;
	isError: boolean;
	onRetry: () => void;
	children: ReactNode;
}) {
	const { t } = useTranslation('dashboard');
	if (isPending) {
		return (
			<div className='flex flex-col gap-2' aria-busy='true'>
				<Skeleton className='h-4 w-full' />
				<Skeleton className='h-4 w-2/3' />
				<Skeleton className='h-4 w-1/2' />
			</div>
		);
	}
	if (isError) {
		return (
			<div className='flex flex-col items-start gap-2'>
				<span className='text-sm text-muted-foreground'>{t('error.unavailable')}</span>
				<Button variant='outline' size='sm' onClick={onRetry}>
					<RotateCw />
					{t('action.retry')}
				</Button>
			</div>
		);
	}
	return <>{children}</>;
}

/** Percentage change between two money figures, or `null` when there is no base. */
function deltaPercent(current: number, previous: number): number | null {
	if (previous === 0) return null;
	return Math.round(((current - previous) / previous) * 100);
}

function SalesWidget({
	organizationId,
	window,
}: {
	organizationId: string | null;
	window: ReturnType<typeof salesWindow>;
}) {
	const { t } = useTranslation('dashboard');
	const canRead = usePermission('invoice.read');
	const query = useQuery({
		// Month buckets: the card compares the current month with the previous one,
		// so it cannot share the chart's window when the chart is on daily buckets.
		...salesSummaryQueryOptions(organizationId, { ...window, groupBy: 'month' }),
		enabled: canRead && organizationId !== null,
	});
	const months = query.data?.buckets ?? [];
	const current = months.find((row) => row.period === monthKey(window.currentFrom));
	const previous = months.find((row) => row.period === monthKey(window.previousFrom));
	const currentInvoiced = current?.invoiced ?? 0;
	const previousInvoiced = previous?.invoiced ?? 0;
	const delta = query.data ? deltaPercent(currentInvoiced, previousInvoiced) : null;

	return (
		<Widget
			title={t('widget.sales.title')}
			to='/sales/invoices'
			titleKeyLink='nav:item.invoices'
		>
			<QueryBody
				isPending={canRead && query.isPending}
				isError={query.isError}
				onRetry={() => void query.refetch()}
			>
				<Figure
					label={t('widget.sales.invoicedThisMonth')}
					value={formatIdr(currentInvoiced)}
					trailing={
						delta === null ? undefined : (
							<Badge variant={delta >= 0 ? 'default' : 'destructive'}>
								{t('widget.sales.delta', { percent: delta })}
							</Badge>
						)
					}
				/>
				<Figure
					label={t('widget.sales.invoicedLastMonth')}
					value={formatIdr(previousInvoiced)}
				/>
				<Figure
					label={t('widget.sales.invoiceCount')}
					value={String(current?.count ?? 0)}
				/>
			</QueryBody>
		</Widget>
	);
}

function CashWidget({ organizationId }: { organizationId: string | null }) {
	const { t } = useTranslation('dashboard');
	const canRead = usePermission('cash_bank.read');
	const query = useQuery({
		...dashboardCashQueryOptions(organizationId, canRead),
		enabled: canRead && organizationId !== null,
	});
	const accounts = query.data ?? [];
	const total = accounts.reduce((sum, account) => sum + (account.currentBalance ?? 0), 0);

	return (
		<Widget
			title={t('widget.cash.title')}
			description={t('widget.cash.perAccount')}
			to='/finance/cash-bank'
			titleKeyLink='nav:item.cashBank'
		>
			<QueryBody
				isPending={canRead && query.isPending}
				isError={query.isError}
				onRetry={() => void query.refetch()}
			>
				{accounts.length === 0 ? (
					<span className='text-sm text-muted-foreground'>{t('empty.noAccounts')}</span>
				) : (
					accounts.map((account) => (
						<Figure
							key={account.id}
							label={account.name}
							value={formatIdr(account.currentBalance ?? 0)}
						/>
					))
				)}
				<Figure label={t('widget.cash.total')} value={formatIdr(total)} />
			</QueryBody>
		</Widget>
	);
}

function ProfitWidget({
	organizationId,
	range,
}: {
	organizationId: string | null;
	range: { from: string; to: string };
}) {
	const { t } = useTranslation('dashboard');
	const canRead = usePermission('financial_report.read');
	const query = useQuery({
		...dashboardProfitQueryOptions(organizationId, range, canRead),
		enabled: canRead && organizationId !== null,
	});

	return (
		<Widget
			title={t('widget.profit.title')}
			to='/finance/reports'
			titleKeyLink='nav:item.financialReports'
		>
			<QueryBody
				isPending={canRead && query.isPending}
				isError={query.isError}
				onRetry={() => void query.refetch()}
			>
				<Figure
					label={t('widget.profit.monthToDate')}
					value={formatIdr(query.data?.netIncome ?? 0)}
					trailing={<Badge variant='outline'>{t('widget.profit.provisional')}</Badge>}
				/>
				<Figure
					label={t('widget.profit.revenue')}
					value={formatIdr(query.data?.totalRevenue ?? 0)}
				/>
				<Figure
					label={t('widget.profit.expenses')}
					value={formatIdr(query.data?.totalExpenses ?? 0)}
				/>
			</QueryBody>
		</Widget>
	);
}

function InventoryWidget({ organizationId }: { organizationId: string | null }) {
	const { t } = useTranslation('dashboard');
	const canReadItems = usePermission('product.read');
	// Stock value needs `product:read_cost`; the backend strips cost fields
	// without it, so the figure is withheld rather than shown as zero.
	const canReadValue = usePermission('product.read_cost');

	const items = useQuery(dashboardItemCountQueryOptions(organizationId, canReadItems));
	const value = useQuery(dashboardStockValueQueryOptions(organizationId, canReadValue));

	return (
		<Widget
			title={t('widget.inventory.title')}
			to='/inventory/stock'
			titleKeyLink='nav:item.stock'
		>
			<QueryBody
				isPending={canReadItems && items.isPending}
				isError={items.isError}
				onRetry={() => void items.refetch()}
			>
				<Figure
					label={t('widget.inventory.itemCount')}
					value={String(items.data ?? 0)}
				/>
			</QueryBody>
			{canReadValue ? (
				<QueryBody
					isPending={value.isPending}
					isError={value.isError}
					onRetry={() => void value.refetch()}
				>
					<Figure
						label={t('widget.inventory.stockValue')}
						value={formatIdr(value.data ?? 0)}
					/>
				</QueryBody>
			) : (
				<Figure label={t('widget.inventory.stockValue')} value='—' />
			)}
		</Widget>
	);
}

function ProjectsWidget({ organizationId }: { organizationId: string | null }) {
	const { t } = useTranslation(['dashboard', 'projects']);
	const canRead = usePermission('project.read');
	const query = useQuery({
		...dashboardProjectsQueryOptions(organizationId, canRead),
		enabled: canRead && organizationId !== null,
	});
	const stats = query.data;

	return (
		<Widget
			title={t('widget.projects.title')}
			description={t('widget.projects.byStatus')}
			to='/projects'
			titleKeyLink='nav:item.projects'
		>
			<QueryBody
				isPending={canRead && query.isPending}
				isError={query.isError}
				onRetry={() => void query.refetch()}
			>
				<Figure label={t('widget.projects.active')} value={String(stats?.active ?? 0)} />
				<Figure label={t('widget.projects.closed')} value={String(stats?.closed ?? 0)} />
				<Figure
					label={t('widget.projects.overdue')}
					value={String(stats?.overdue ?? 0)}
					trailing={
						(stats?.overdue ?? 0) > 0 ? (
							<Badge variant='destructive'>{t('widget.projects.attention')}</Badge>
						) : undefined
					}
				/>
				<div className='mt-1 flex flex-col gap-1.5 border-t pt-2'>
					{(stats?.byStage ?? []).map((row) => {
						const max = Math.max(...(stats?.byStage ?? [{ count: 1 }]).map((entry) => entry.count), 1);
						return (
							<div key={row.stage} className='flex items-center gap-2'>
								<span className='w-28 shrink-0 truncate text-xs text-muted-foreground'>
									{t(STAGE_KEYS[row.stage])}
								</span>
								<div className='h-1.5 flex-1 rounded-full bg-muted'>
									<div
										className='h-full rounded-full bg-primary'
										style={{ width: `${Math.round((row.count / max) * 100)}%` }}
									/>
								</div>
								<span className='w-6 text-right text-xs tabular-nums'>{row.count}</span>
							</div>
						);
					})}
				</div>
			</QueryBody>
		</Widget>
	);
}

function SubscriptionsWidget({ organizationId }: { organizationId: string | null }) {
	const { t } = useTranslation('dashboard');
	const canRead = usePermission('license.read');
	const query = useQuery({
		...dashboardSubscriptionsQueryOptions(organizationId, canRead),
		enabled: canRead && organizationId !== null,
	});

	return (
		<Widget
			title={t('widget.subscriptions.title')}
			to='/subscription'
			titleKeyLink='nav:item.subscription'
		>
			<QueryBody
				isPending={canRead && query.isPending}
				isError={query.isError}
				onRetry={() => void query.refetch()}
			>
				<Figure
					label={t('widget.subscriptions.endingSoon')}
					value={String(query.data?.endingSoon ?? 0)}
				/>
				<Figure
					label={t('widget.subscriptions.expired')}
					value={String(query.data?.ended ?? 0)}
				/>
			</QueryBody>
		</Widget>
	);
}

/** A bucket label: short month for `YYYY-MM`, day + month for `YYYY-MM-DD`. */
function bucketLabel(period: string, language: string): string {
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

/** Range preset labels, in the order the toggle renders them. */
const RANGE_KEYS: Record<TSalesRange, `chart.range.${TSalesRange}`> = {
	'14d': 'chart.range.14d',
	'1m': 'chart.range.1m',
	'3m': 'chart.range.3m',
	'6m': 'chart.range.6m',
	'1y': 'chart.range.1y',
	'5y': 'chart.range.5y',
	custom: 'chart.range.custom',
};

/**
 * Invoiced sales over a chosen window — the dashboard's headline chart.
 *
 * @remarks
 * Full width and first on the page: this is the figure a manager opens the
 * dashboard for. The window is local state (presets plus a custom date range);
 * each choice is its own query key, so switching back to a previous window is
 * served from cache instead of refetching.
 */
function SalesChartCard({
	organizationId,
	window,
	range,
	onRangeChange,
	custom,
	onCustomChange,
	today,
}: {
	organizationId: string | null;
	window: ReturnType<typeof salesChartWindow>;
	range: TSalesRange;
	onRangeChange: (range: TSalesRange) => void;
	custom: TDateRangeValue;
	onCustomChange: (range: TDateRangeValue) => void;
	today: string;
}) {
	const { t, i18n } = useTranslation('dashboard');
	const canRead = usePermission('invoice.read');
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const [customOpen, setCustomOpen] = useState(false);
	const query = useQuery({
		...salesSummaryQueryOptions(organizationId, window),
		enabled: canRead && organizationId !== null,
	});
	// Minor units → whole rupiah for the axis; the tooltip formats from minor.
	const data = (query.data?.buckets ?? []).map((row) => ({
		label: bucketLabel(row.period, i18n.language),
		invoiced: row.invoiced / 100,
	}));
	const total = query.data?.totalInvoiced ?? 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('chart.title')}</CardTitle>
				<CardDescription>
					{range === 'custom' && !(custom.from && custom.to)
						? t('chart.customPlaceholder')
						: t('chart.rangeLabel', {
								from: window.from,
								to: window.to,
								total: formatIdr(total),
							})}
				</CardDescription>
				<CardAction className='flex flex-wrap items-center justify-end gap-2'>
					<div ref={setAnchor}>
						<ToggleGroup
							value={[range]}
							onValueChange={(values) => {
								const next = values[0];
								if (next) {
									onRangeChange(next as TSalesRange);
									// "Custom" has no input: clicking it opens the calendar.
									if (next === 'custom') setCustomOpen(true);
									return;
								}
								// Clicking the active preset again: for Custom that means
								// "show the calendar", for the others it changes nothing.
								if (range === 'custom') setCustomOpen(true);
							}}
							variant='outline'
							size='sm'
							className='flex-wrap'
						>
							{SALES_RANGES.map((preset) => (
								<ToggleGroupItem key={preset} value={preset}>
									{t(RANGE_KEYS[preset])}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</div>
					{range === 'custom' && (
						<DateRangePicker
							value={custom}
							onChange={(next) => {
								onCustomChange(next);
								// Parent owns `open`: close as soon as both ends exist.
								if (next.from && next.to) setCustomOpen(false);
							}}
							max={today}
							showTrigger={false}
							anchor={anchor}
							open={customOpen}
							onOpenChange={setCustomOpen}
							placeholder={t('chart.customPlaceholder')}
							aria-label={t('chart.customPlaceholder')}
						/>
					)}
				</CardAction>
			</CardHeader>
			<CardContent>
				<QueryBody
					isPending={canRead && query.isPending}
					isError={query.isError}
					onRetry={() => void query.refetch()}
				>
					<ChartContainer
						config={
							{
								invoiced: { label: t('chart.invoiced'), color: 'var(--chart-1)' },
							} satisfies ChartConfig
						}
						className='h-72 w-full'
					>
						<BarChart data={data}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey='label'
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								interval='preserveStartEnd'
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										hideLabel
										formatter={(value) => formatIdr(Number(value) * 100)}
									/>
								}
							/>
							<Bar dataKey='invoiced' fill='var(--color-invoiced)' radius={4} />
						</BarChart>
					</ChartContainer>
				</QueryBody>
			</CardContent>
		</Card>
	);
}

function ActivityCard({ organizationId }: { organizationId: string | null }) {
	const { t } = useTranslation('dashboard');
	const canRead = usePermission('invoice.read');
	const invoices = useQuery(dashboardRecentInvoicesQueryOptions(organizationId, canRead));
	const receipts = useQuery(dashboardRecentReceiptsQueryOptions(organizationId, canRead));

	// One list, newest first: invoices and receipts interleaved by date.
	const entries = [
		...(invoices.data?.rows ?? []).map((row) => ({
			id: `invoice-${row.id}`,
			kind: 'invoice' as const,
			code: row.code ?? '—',
			at: row.issueDate ?? row.createdAt,
			amount: row.grandTotal,
		})),
		...(receipts.data?.rows ?? []).map((row) => ({
			id: `receipt-${row.id}`,
			kind: 'receipt' as const,
			code: row.code,
			at: row.receivedDate,
			amount: row.amount,
		})),
	]
		.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
		.slice(0, 5);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('activity.title')}</CardTitle>
				<CardAction>
					<Link
						to='/sales/invoices'
						className='text-xs font-normal text-muted-foreground hover:text-foreground'
					>
						{t('action.viewAll')}
					</Link>
				</CardAction>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				<QueryBody
					isPending={canRead && (invoices.isPending || receipts.isPending)}
					isError={invoices.isError || receipts.isError}
					onRetry={() => {
						void invoices.refetch();
						void receipts.refetch();
					}}
				>
					{entries.length === 0 ? (
						<span className='text-sm text-muted-foreground'>{t('activity.empty')}</span>
					) : (
						entries.map((entry) => (
							<div
								key={entry.id}
								className='flex flex-col gap-0.5 border-b pb-2 last:border-b-0 last:pb-0'
							>
								<span className='flex items-baseline justify-between gap-2 text-sm'>
									<span>
										{t(
											entry.kind === 'invoice'
												? 'activity.invoiceIssued'
												: 'activity.receiptRecorded',
											{ code: entry.code },
										)}
									</span>
									<span className='shrink-0 tabular-nums'>
										{formatIdr(entry.amount)}
									</span>
								</span>
								<span className='text-xs text-muted-foreground tabular-nums'>
									{entry.at}
								</span>
							</div>
						))
					)}
				</QueryBody>
			</CardContent>
		</Card>
	);
}

/** Static shortcuts; no data, so no query and no permission gate. */
const QUICK_LINKS: Array<{ to: string; titleKey: QualifiedNavKey }> = [
	{ to: '/sales/invoices', titleKey: 'nav:item.invoices' },
	{ to: '/finance/cash-bank', titleKey: 'nav:item.cashBank' },
	{ to: '/inventory/stock', titleKey: 'nav:item.stock' },
	{ to: '/projects', titleKey: 'nav:item.projects' },
	{ to: '/subscription', titleKey: 'nav:item.subscription' },
	{ to: '/reports', titleKey: 'nav:item.financialReports' },
];

function QuickLinksCard() {
	const { t } = useTranslation(['dashboard', 'nav']);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('quickLinks.title')}</CardTitle>
			</CardHeader>
			<CardContent className='grid grid-cols-2 gap-2'>
				{QUICK_LINKS.map((link) => (
					<Link
						key={link.to}
						to={link.to}
						className='rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60'
					>
						{t(link.titleKey)}
					</Link>
				))}
			</CardContent>
		</Card>
	);
}
