import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard } from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts';

import { Badge } from '@ims-erp/ui/components/badge';
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
import { EmptyState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@ims-erp/ui/components/empty';

import {
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
	salesSummaryQueryOptions,
	salesWindow,
	bucketLabel,
	deltaPercent,
} from '@/lib/dashboard-api';
import { useChartRange } from '@/lib/use-chart-range';
import { todayBusinessDate } from '@/lib/format';
import type { TProjectStage } from '@/lib/project-api';
import { useActiveOrganizationId } from '@/lib/use-active-organization';
import { usePermission, usePermissionState } from '@/lib/use-permission';

import { CashFlowChartCard, CashFlowKpis } from './cash-flow-summary';
import {
	DashboardSection,
	Figure,
	QueryBody,
	RangeControls,
	Widget,
	type QualifiedNavKey,
} from './dashboard-shared';

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
 * Which dashboard cards the caller's organization roles may read.
 *
 * @remarks
 * One permission check per source module, answered by Better Auth against the
 * same `erpRoleGrants` the backend guard uses, so a multi-role member gets the
 * union. UX only: every endpoint re-checks server-side (ERP-0111, Q3).
 */
function useDashboardAccess() {
	const checks = {
		cash: usePermissionState('cash_bank.read'),
		profit: usePermissionState('financial_report.read'),
		invoice: usePermissionState('invoice.read'),
		product: usePermissionState('product.read'),
		project: usePermissionState('project.read'),
		license: usePermissionState('license.read'),
	};
	const isPending = Object.values(checks).some((check) => check.isPending);
	const can = Object.fromEntries(
		Object.entries(checks).map(([key, check]) => [key, check.allowed]),
	) as Record<keyof typeof checks, boolean>;
	return { can, isPending };
}

/**
 * The M01 dashboard: one read-only overview across modules, on real data
 * (`docs/plan/erp-module-plans/m01-dashboard.md`, ERP-0060, ERP-0111).
 *
 * @remarks
 * **Client composition, no backend dashboard module.** Each card reads the
 * endpoint of the module that owns the number (see `lib/dashboard-api.ts`).
 * - **Role-aware:** a card renders only when the caller's roles grant its
 *   source module's read permission; a section with no visible card is
 *   omitted. The server remains the enforcer.
 * - each card owns its loading / empty / error state, so one failing module
 *   degrades one card instead of blanking the page;
 * - all keys carry the active organization id, so switching organization
 *   re-renders every figure instead of showing the previous one's numbers.
 */
export function DashboardPage() {
	const { t } = useTranslation(['dashboard', 'nav']);
	const organizationId = useActiveOrganizationId();
	const { can, isPending } = useDashboardAccess();
	const today = todayBusinessDate();
	const window = salesWindow(today);

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

	const showFinance = can.cash || can.profit;
	const showOperations = can.invoice || can.product || can.project || can.license;
	const quickLinks = QUICK_LINKS.filter((link) => can[link.access]);
	const showActivity = can.invoice || quickLinks.length > 0;

	return (
		// `@container/dashboard`: the grids follow the width the content actually
		// gets, not the viewport. On a tablet the open sidebar leaves ~500 px, so
		// viewport breakpoints would squeeze three columns into it.
		<div className='@container/dashboard flex min-w-0 flex-1 flex-col gap-6'>
			{/* The breadcrumb is the visual title; figures refresh silently every minute. */}
			<h1 className='sr-only'>{t('title')}</h1>

			{isPending ? (
				<PageSkeleton />
			) : !showFinance && !showOperations && !showActivity ? (
				<Empty className='flex-1'>
					<EmptyHeader>
						<EmptyMedia variant='icon'>
							<LayoutDashboard />
						</EmptyMedia>
						<EmptyTitle>{t('empty.noWidgets.title')}</EmptyTitle>
						<EmptyDescription>{t('empty.noWidgets.description')}</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<>
					{showFinance && (
						<DashboardSection
							title={t('section.finance.title')}
							description={can.cash ? t('section.finance.description') : undefined}
						>
							{can.cash && <CashFlowKpis organizationId={organizationId} today={today} />}
							{can.cash && <CashFlowChartCard organizationId={organizationId} today={today} />}
							<div className='grid gap-4 @md/dashboard:grid-cols-2'>
								{can.cash && <CashWidget organizationId={organizationId} />}
								{can.profit && (
									<ProfitWidget
										organizationId={organizationId}
										range={{ from: window.currentFrom, to: today }}
									/>
								)}
							</div>
						</DashboardSection>
					)}

					{showOperations && (
						<DashboardSection
							title={t('section.operations.title')}
							description={t('section.operations.description')}
						>
							{can.invoice && <SalesChartCard organizationId={organizationId} today={today} />}
							<div className='grid gap-4 @md/dashboard:grid-cols-2 @5xl/dashboard:grid-cols-4'>
								{can.invoice && <SalesWidget organizationId={organizationId} window={window} />}
								{can.product && <InventoryWidget organizationId={organizationId} />}
								{can.project && <ProjectsWidget organizationId={organizationId} />}
								{can.license && <SubscriptionsWidget organizationId={organizationId} />}
							</div>
						</DashboardSection>
					)}

					{showActivity && (
						<DashboardSection title={t('section.activity.title')}>
							<div className='grid gap-4 @4xl/dashboard:grid-cols-3'>
								{can.invoice && (
									<div className='@4xl/dashboard:col-span-2'>
										<ActivityCard organizationId={organizationId} />
									</div>
								)}
								{quickLinks.length > 0 && <QuickLinksCard links={quickLinks} />}
							</div>
						</DashboardSection>
					)}
				</>
			)}
		</div>
	);
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
					<EmptyState title={t('empty.noAccounts')} size='sm' />
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
								<span className='w-24 shrink-0 truncate @5xl/dashboard:w-28 text-xs text-muted-foreground'>
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

/**
 * Invoiced sales over a chosen window.
 *
 * @remarks
 * Full width at the top of the operations section. The window is local state
 * (presets plus a custom date range, `useChartRange`); each choice is its own
 * query key, so switching back to a previous window is served from cache.
 */
function SalesChartCard({ organizationId, today }: { organizationId: string; today: string }) {
	const { t, i18n } = useTranslation('dashboard');
	const canRead = usePermission('invoice.read');
	const range = useChartRange(today);
	const query = useQuery({
		...salesSummaryQueryOptions(organizationId, range.window),
		enabled: canRead,
	});
	// Minor units → whole rupiah for the axis; the tooltip formats from minor.
	const data = (query.data?.buckets ?? []).map((row) => ({
		label: bucketLabel(row.period, i18n.language),
		invoiced: row.invoiced / 100,
	}));
	const total = query.data?.totalInvoiced ?? 0;

	return (
		<Card>
			{/* Narrow content area: one column, so the range controls drop below the title. */}
			<CardHeader className='@max-3xl/dashboard:has-data-[slot=card-action]:grid-cols-1'>
				<CardTitle>{t('chart.title')}</CardTitle>
				<CardDescription>
					{range.incomplete
						? t('chart.customPlaceholder')
						: t('chart.rangeLabel', {
								from: range.window.from,
								to: range.window.to,
								total: formatIdr(total),
							})}
				</CardDescription>
				<CardAction className='col-start-1 row-span-1 row-start-3 flex flex-wrap items-center justify-start gap-2 justify-self-start @3xl/dashboard:col-start-2 @3xl/dashboard:row-span-2 @3xl/dashboard:row-start-1 @3xl/dashboard:justify-end @3xl/dashboard:justify-self-end'>
					<RangeControls state={range} today={today} />
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
						className='h-56 w-full @2xl/dashboard:h-72'
					>
						<LineChart data={data} margin={{ left: 12, right: 12 }}>
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
							<Line
								dataKey='invoiced'
								type='monotone'
								stroke='var(--color-invoiced)'
								strokeWidth={2}
								// A one-bucket window has no line to draw: show the point.
								dot={data.length <= 1}
								activeDot={{ r: 4 }}
							/>
						</LineChart>
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
		<Card className='h-full'>
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
						<EmptyState title={t('activity.empty')} size='sm' />
					) : (
						entries.map((entry) => (
							<div
								key={entry.id}
								className='flex flex-col gap-0.5 border-b pb-2 last:border-b-0 last:pb-0'
							>
								<span className='flex items-baseline justify-between gap-2 text-sm'>
									<span className='min-w-0 break-words'>
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

/** Dashboard permission a quick link depends on (see `useDashboardAccess`). */
type TAccessKey = keyof ReturnType<typeof useDashboardAccess>['can'];

/**
 * Static shortcuts, each shown only when the caller can read its target
 * module, so a role never sees a link that leads to a 403 page.
 */
const QUICK_LINKS: Array<{ to: string; titleKey: QualifiedNavKey; access: TAccessKey }> = [
	{ to: '/sales/invoices', titleKey: 'nav:item.invoices', access: 'invoice' },
	{ to: '/finance/cash-bank', titleKey: 'nav:item.cashBank', access: 'cash' },
	{ to: '/inventory/stock', titleKey: 'nav:item.stock', access: 'product' },
	{ to: '/projects', titleKey: 'nav:item.projects', access: 'project' },
	{ to: '/subscription', titleKey: 'nav:item.subscription', access: 'license' },
	{ to: '/reports', titleKey: 'nav:item.financialReports', access: 'profit' },
];

function QuickLinksCard({ links }: { links: typeof QUICK_LINKS }) {
	const { t } = useTranslation(['dashboard', 'nav']);
	return (
		<Card className='h-full'>
			<CardHeader>
				<CardTitle>{t('quickLinks.title')}</CardTitle>
			</CardHeader>
			<CardContent className='grid grid-cols-2 gap-2'>
				{links.map((link) => (
					<Link
						key={link.to}
						to={link.to}
						className='flex min-h-10 items-center rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60'
					>
						{t(link.titleKey)}
					</Link>
				))}
			</CardContent>
		</Card>
	);
}
