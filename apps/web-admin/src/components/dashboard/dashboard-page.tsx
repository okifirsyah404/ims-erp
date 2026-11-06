import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { NamespaceKey, TranslationKey } from '@ims-erp/locales';

import { Badge } from '@ims-erp/ui/components/badge';
import {
	Card,
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
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import type { ReactNode } from 'react';

import {
	dashboardQueryOptions,
	formatIdr,
	type TActivityEntry,
	type TDashboardSummary,
} from '@/lib/dashboard-api';
import { licenseSummaryQueryOptions } from '@/lib/license-api';
import { usePermission } from '@/lib/use-permission';

/** A key in the `dashboard` namespace, typed against the `en` bundle. */
type DashboardKey = NamespaceKey<'dashboard'>;
/** A `nav`-qualified key (`nav:item.invoices`), reusable in any scope. */
type QualifiedNavKey = Extract<TranslationKey, `nav:${string}`>;

/**
 * The M01 dashboard — one read-only overview across modules
 * (`docs/plan/erp-module-plans/m01-dashboard.md`).
 *
 * @remarks
 * **Dummy view.** Every figure comes from the mock fetcher
 * (`dashboard-api.ts`), hence the persistent sample-data banner. Layout and
 * types match the planned real API so swapping the fetcher changes no markup.
 *
 * Permission gating per widget (hide a widget when the viewer lacks the
 * source-module permission) is a server-side concern per M01 and is deferred
 * with the real API.
 */
export function DashboardPage() {
	const { data, isPending, isError } = useQuery(dashboardQueryOptions());

	if (isPending) return <DashboardSkeleton />;
	if (isError || !data) return null;

	return (
		<div className='flex flex-1 flex-col gap-4 p-4 pt-0'>
			<SampleDataBanner />

			<div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
				<SalesWidget summary={data} />
				<CashWidget summary={data} />
				<ProfitWidget summary={data} />
				<InventoryWidget summary={data} />
				<ProjectsWidget summary={data} />
				<SubscriptionsWidget />
			</div>

			<div className='grid gap-4 lg:grid-cols-3'>
				<SalesChartCard summary={data} />
				<ActivityCard summary={data} />
				<QuickLinksCard summary={data} />
			</div>
		</div>
	);
}

/** Persistent notice that the dashboard shows placeholder figures. */
function SampleDataBanner() {
	const { t } = useTranslation('dashboard');
	return (
		<div className='rounded-xl border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground'>
			{t('banner.sampleData')}
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
		<Card className='gap-4'>
			<CardHeader>
				<CardTitle className='flex items-center justify-between'>
					{title}
					<Link
						to={to}
						className='text-xs font-normal text-muted-foreground hover:text-foreground'
					>
						{t('action.viewAll')} · {t(titleKeyLink)}
					</Link>
				</CardTitle>
				{description && (
					<CardDescription>{description}</CardDescription>
				)}
			</CardHeader>
			<CardContent className='flex flex-col gap-2'>{children}</CardContent>
		</Card>
	);
}

function SalesWidget({ summary }: { summary: TDashboardSummary }) {
	const { t } = useTranslation('dashboard');
	return (
		<Widget
			title={t('widget.sales.title')}
			to='/sales/invoices'
			titleKeyLink='nav:item.invoices'
		>
			<Figure
				label={t('widget.sales.invoicedThisMonth')}
				value={formatIdr(summary.sales.invoicedThisMonth)}
			/>
			<Figure
				label={t('widget.sales.invoicedLastMonth')}
				value={formatIdr(summary.sales.invoicedLastMonth)}
			/>
			<Figure
				label={t('widget.sales.openQuotes')}
				value={String(summary.sales.openQuotesCount)}
				trailing={
					<span className='text-sm text-muted-foreground'>
						{formatIdr(summary.sales.openQuotesValue)}
					</span>
				}
			/>
		</Widget>
	);
}

function CashWidget({ summary }: { summary: TDashboardSummary }) {
	const { t } = useTranslation('dashboard');
	return (
		<Widget
			title={t('widget.cash.title')}
			description={t('widget.cash.perAccount')}
			to='/finance/cash-bank'
			titleKeyLink='nav:item.cashBank'
		>
			{summary.cash.accounts.map((account) => (
				<Figure
					key={account.name}
					label={account.name}
					value={formatIdr(account.balance)}
				/>
			))}
			<Figure
				label={t('widget.cash.total')}
				value={formatIdr(summary.cash.total)}
			/>
		</Widget>
	);
}

function ProfitWidget({ summary }: { summary: TDashboardSummary }) {
	const { t } = useTranslation('dashboard');
	return (
		<Widget
			title={t('widget.profit.title')}
			to='/finance/reports'
			titleKeyLink='nav:item.financialReports'
		>
			<Figure
				label={t('widget.profit.monthToDate')}
				value={formatIdr(summary.profit.monthToDate)}
				trailing={
					<Badge variant='outline'>{t('widget.profit.provisional')}</Badge>
				}
			/>
		</Widget>
	);
}

function InventoryWidget({ summary }: { summary: TDashboardSummary }) {
	const { t } = useTranslation('dashboard');
	return (
		<Widget
			title={t('widget.inventory.title')}
			to='/inventory/stock'
			titleKeyLink='nav:item.stock'
		>
			<Figure
				label={t('widget.inventory.itemCount')}
				value={String(summary.inventory.itemCount)}
			/>
			<Figure
				label={t('widget.inventory.stockValue')}
				value={formatIdr(summary.inventory.stockValue)}
			/>
		</Widget>
	);
}

const PROJECT_STATUS_KEYS = {
	planning: 'projects.status.planning',
	inProgress: 'projects.status.inProgress',
	done: 'projects.status.done',
} as const satisfies Record<string, DashboardKey>;

function ProjectsWidget({ summary }: { summary: TDashboardSummary }) {
	const { t } = useTranslation('dashboard');
	return (
		<Widget
			title={t('widget.projects.title')}
			description={t('widget.projects.byStatus')}
			to='/projects'
			titleKeyLink='nav:item.projects'
		>
			{(Object.keys(PROJECT_STATUS_KEYS) as Array<keyof typeof PROJECT_STATUS_KEYS>).map(
				(status) => (
					<Figure
						key={status}
						label={t(PROJECT_STATUS_KEYS[status])}
						value={String(summary.projects[status])}
					/>
				),
			)}
			<Figure
				label={t('widget.projects.overdue')}
				value={String(summary.projects.overdue)}
			/>
		</Widget>
	);
}

/** Live figures from the license register (M03); the only widget off the mock. */
function SubscriptionsWidget() {
	const { t } = useTranslation('dashboard');
	const canRead = usePermission('license.read');
	const { data } = useQuery(licenseSummaryQueryOptions(canRead));
	return (
		<Widget
			title={t('widget.subscriptions.title')}
			to='/subscription'
			titleKeyLink='nav:item.subscription'
		>
			<Figure
				label={t('widget.subscriptions.endingSoon')}
				value={data ? String(data.endingSoon) : '—'}
			/>
			<Figure
				label={t('widget.subscriptions.expired')}
				value={data ? String(data.ended) : '—'}
			/>
		</Widget>
	);
}

/** Locale-neutral `YYYY-MM` → short month label via `Intl`. */
function shortMonth(month: string): string {
	const [year, monthIndex] = month.split('-').map(Number) as [number, number];
	return new Intl.DateTimeFormat('en', { month: 'short' }).format(
		new Date(year, monthIndex - 1, 1),
	);
}

function SalesChartCard({ summary }: { summary: TDashboardSummary }) {
	const { t } = useTranslation('dashboard');
	const data = summary.salesSeries.map((point) => ({
		...point,
		label: shortMonth(point.month),
		invoiced: point.invoiced / 100,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('chart.title')}</CardTitle>
			</CardHeader>
			<CardContent>
				<ChartContainer
					config={{ invoiced: { label: t('chart.monthly') } } satisfies ChartConfig}
					className='h-48 w-full'
				>
					<BarChart data={data}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey='label'
							tickLine={false}
							axisLine={false}
							tickMargin={8}
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
			</CardContent>
		</Card>
	);
}

function ActivityCard({ summary }: { summary: TDashboardSummary }) {
	const { t } = useTranslation(['dashboard', 'common']);
	return (
		<Card>
			<CardHeader>
				<CardTitle className='flex items-center justify-between'>
					{t('activity.title')}
					<Link
						to='/admin/audit'
						className='text-xs font-normal text-muted-foreground hover:text-foreground'
					>
						{t('action.viewAll')}
					</Link>
				</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				{summary.activity.map((entry) => (
					<ActivityRow key={entry.id} entry={entry} />
				))}
			</CardContent>
		</Card>
	);
}

/** Maps a mock activity kind to its translation key and nav route. */
const ACTIVITY_META = {
	quoted: { key: 'activity.quoted' },
	invoicePaid: { key: 'activity.invoicePaid' },
	stockAdjusted: { key: 'activity.stockAdjusted' },
	projectHandover: { key: 'activity.projectHandover' },
} as const satisfies Record<TActivityEntry['kind'], { key: DashboardKey }>;

function ActivityRow({ entry }: { entry: TActivityEntry }) {
	const { t } = useTranslation('dashboard');
	return (
		<div className='flex flex-col gap-0.5 border-b pb-2 last:border-b-0 last:pb-0'>
			<span className='text-sm'>{t(ACTIVITY_META[entry.kind].key, { code: entry.code })}</span>
			<span className='text-xs text-muted-foreground tabular-nums'>
				{new Date(entry.occurredAt).toLocaleString()}
			</span>
		</div>
	);
}

function QuickLinksCard({ summary }: { summary: TDashboardSummary }) {
	const { t } = useTranslation(['dashboard', 'nav']);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('quickLinks.title')}</CardTitle>
			</CardHeader>
			<CardContent className='grid grid-cols-2 gap-2'>
				{summary.quickLinks.map((link) => (
					<Link
						key={link.to}
						to={link.to}
						className='rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60'
					>
						{t(link.titleKey as QualifiedNavKey)}
					</Link>
				))}
			</CardContent>
		</Card>
	);
}

/** Loading placeholder matching the dashboard's grid layout. */
function DashboardSkeleton() {
	return (
		<div className='flex flex-1 flex-col gap-4 p-4 pt-0'>
			<Skeleton className='h-11 rounded-xl' />
			<div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
				{Array.from({ length: 6 }, (_, index) => (
					<Skeleton key={index} className='h-44 rounded-xl' />
				))}
			</div>
			<div className='grid gap-4 lg:grid-cols-3'>
				{Array.from({ length: 3 }, (_, index) => (
					<Skeleton key={index} className='h-64 rounded-xl' />
				))}
			</div>
		</div>
	);
}
