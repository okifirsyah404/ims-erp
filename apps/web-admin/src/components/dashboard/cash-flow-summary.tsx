import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowUpFromLine, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts';

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
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from '@ims-erp/ui/components/chart';
import { cn } from '@ims-erp/ui/lib/utils';

import {
	cashFlowSummaryQueryOptions,
	formatIdr,
	monthToDateWindows,
	type TDateWindow,
	bucketLabel,
	deltaPercent,
} from '@/lib/dashboard-api';
import { useChartRange } from '@/lib/use-chart-range';
import {
	QueryBody,
	RangeControls,
} from './dashboard-shared';

/** Which way is good for a KPI: more income is good, more outcome is not. */
type TKpiTone = 'higher-is-better' | 'lower-is-better';

/**
 * One headline KPI: icon, month-to-date amount, and the change against the
 * same days of the previous month.
 */
function KpiCard({
	className,
	icon: Icon,
	title,
	value,
	previous,
	tone,
	isPending,
	isError,
	onRetry,
}: {
	className?: string;
	icon: LucideIcon;
	title: string;
	value: number;
	previous: number;
	tone: TKpiTone;
	isPending: boolean;
	isError: boolean;
	onRetry: () => void;
}) {
	const { t } = useTranslation('dashboard');
	const delta = deltaPercent(value, previous);
	const good = delta !== null && (tone === 'higher-is-better' ? delta >= 0 : delta <= 0);

	return (
		<Card className={cn('h-full gap-3', className)}>
			<CardHeader>
				<CardDescription className='flex items-center gap-2'>
					<span className='flex size-7 items-center justify-center rounded-md bg-muted text-foreground'>
						<Icon className='size-4' aria-hidden='true' />
					</span>
					{title}
				</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-1'>
				<QueryBody isPending={isPending} isError={isError} onRetry={onRetry}>
					<span className='text-xl font-semibold tabular-nums tracking-tight [overflow-wrap:anywhere] @5xl/dashboard:text-2xl'>
						{formatIdr(value)}
					</span>
					<span className='flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground'>
						{delta === null ? (
							<span>{t('kpi.noBase')}</span>
						) : (
							<span
								className={cn(
									'rounded-md px-1.5 py-0.5 font-medium tabular-nums',
									good
										? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
										: 'bg-destructive/10 text-destructive',
								)}
							>
								{t('kpi.delta', { percent: `${delta > 0 ? '+' : ''}${delta}` })}
							</span>
						)}
						<span>{t('kpi.previous', { amount: formatIdr(previous) })}</span>
					</span>
				</QueryBody>
			</CardContent>
		</Card>
	);
}

/**
 * Income, outcome and net cash flow, month to date (ERP-0113).
 *
 * @remarks
 * Cash basis: posted cash/bank movements, opening balances excluded. Two
 * requests (this month to date, the same span last month) with monthly
 * buckets; only the totals are read. Rendered only for `cash_bank:read`.
 */
export function CashFlowKpis({
	organizationId,
	today,
}: {
	organizationId: string;
	today: string;
}) {
	const { t } = useTranslation('dashboard');
	const windows = monthToDateWindows(today);
	const asMonth = (window: TDateWindow) => ({ ...window, groupBy: 'month' as const });
	const current = useQuery(cashFlowSummaryQueryOptions(organizationId, asMonth(windows.current), true));
	const previous = useQuery(
		cashFlowSummaryQueryOptions(organizationId, asMonth(windows.previous), true),
	);
	const isPending = current.isPending || previous.isPending;
	const isError = current.isError || previous.isError;
	const onRetry = () => {
		void current.refetch();
		void previous.refetch();
	};
	const now = current.data;
	const before = previous.data;

	return (
		<div className='flex flex-col gap-2'>
			<p className='text-xs text-muted-foreground'>
				{t('kpi.period', { from: windows.current.from, to: windows.current.to })}
			</p>
			<div className='grid gap-4 @md/dashboard:grid-cols-2 @2xl/dashboard:grid-cols-3'>
				<KpiCard
					icon={ArrowDownToLine}
					title={t('kpi.income')}
					value={now?.totalIn ?? 0}
					previous={before?.totalIn ?? 0}
					tone='higher-is-better'
					isPending={isPending}
					isError={isError}
					onRetry={onRetry}
				/>
				<KpiCard
					icon={ArrowUpFromLine}
					title={t('kpi.outcome')}
					value={now?.totalOut ?? 0}
					previous={before?.totalOut ?? 0}
					tone='lower-is-better'
					isPending={isPending}
					isError={isError}
					onRetry={onRetry}
				/>
				{/* Two-column band: net takes the full row under income and outcome. */}
				<KpiCard
					className='@md/dashboard:col-span-2 @2xl/dashboard:col-span-1'
					icon={Wallet}
					title={t('kpi.net')}
					value={now?.net ?? 0}
					previous={before?.net ?? 0}
					tone='higher-is-better'
					isPending={isPending}
					isError={isError}
					onRetry={onRetry}
				/>
			</div>
		</div>
	);
}

/**
 * Income vs outcome per period over a chosen window (ERP-0113).
 *
 * @remarks
 * Same presets and custom range as the sales chart, but its own window state.
 */
export function CashFlowChartCard({
	organizationId,
	today,
}: {
	organizationId: string;
	today: string;
}) {
	const { t, i18n } = useTranslation('dashboard');
	const range = useChartRange(today);
	const query = useQuery(cashFlowSummaryQueryOptions(organizationId, range.window, true));
	// Minor units → whole rupiah for the axis; the tooltip formats from minor.
	const data = (query.data?.buckets ?? []).map((row) => ({
		label: bucketLabel(row.period, i18n.language),
		income: row.totalIn / 100,
		outcome: row.totalOut / 100,
	}));

	return (
		<Card>
			{/* Narrow content area: one column, so the range controls drop below the title. */}
			<CardHeader className='@max-3xl/dashboard:has-data-[slot=card-action]:grid-cols-1'>
				<CardTitle>{t('cashFlowChart.title')}</CardTitle>
				<CardDescription>
					{range.incomplete
						? t('chart.customPlaceholder')
						: t('cashFlowChart.rangeLabel', {
								from: range.window.from,
								to: range.window.to,
								net: formatIdr(query.data?.net ?? 0),
							})}
				</CardDescription>
				<CardAction className='col-start-1 row-span-1 row-start-3 flex flex-wrap items-center justify-start gap-2 justify-self-start @3xl/dashboard:col-start-2 @3xl/dashboard:row-span-2 @3xl/dashboard:row-start-1 @3xl/dashboard:justify-end @3xl/dashboard:justify-self-end'>
					<RangeControls state={range} today={today} />
				</CardAction>
			</CardHeader>
			<CardContent>
				<QueryBody
					isPending={query.isPending}
					isError={query.isError}
					onRetry={() => void query.refetch()}
				>
					<ChartContainer
						config={
							{
								income: { label: t('kpi.income'), color: 'var(--chart-3)' },
								outcome: { label: t('kpi.outcome'), color: 'var(--chart-2)' },
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
										formatter={(value, name) => (
											<span className='flex w-full justify-between gap-4'>
												<span className='text-muted-foreground'>
													{t(name === 'income' ? 'kpi.income' : 'kpi.outcome')}
												</span>
												<span className='font-medium tabular-nums'>
													{formatIdr(Number(value) * 100)}
												</span>
											</span>
										)}
									/>
								}
							/>
							<ChartLegend content={<ChartLegendContent />} />
							<Line
								dataKey='income'
								type='monotone'
								stroke='var(--color-income)'
								strokeWidth={2}
								// A one-bucket window has no line to draw: show the point.
								dot={data.length <= 1}
								activeDot={{ r: 4 }}
							/>
							<Line
								dataKey='outcome'
								type='monotone'
								stroke='var(--color-outcome)'
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
