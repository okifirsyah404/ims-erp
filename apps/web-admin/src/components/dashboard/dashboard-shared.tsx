import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RotateCw } from 'lucide-react';
import { useState } from 'react';
import type { TranslationKey } from '@ims-erp/locales';
import type { ReactNode } from 'react';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { DateRangePicker } from '@ims-erp/ui/components/date-range-picker';
import { ToggleGroup, ToggleGroupItem } from '@ims-erp/ui/components/toggle-group';
import { ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';

import { SALES_RANGES, type TSalesRange } from '@/lib/dashboard-api';
import type { useChartRange } from '@/lib/use-chart-range';

/** A `nav`-qualified key (`nav:item.invoices`), reusable in any scope. */
export type QualifiedNavKey = Extract<TranslationKey, `nav:${string}`>;

/**
 * A titled band of the dashboard (financial summary, operations, activity).
 *
 * @remarks
 * Callers render a section only when at least one of its cards is visible to
 * the caller's roles, so an empty heading never appears.
 */
export function DashboardSection({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section className='flex flex-col gap-3'>
			<div className='flex flex-col gap-0.5 border-b pb-2'>
				<h2 className='text-base font-semibold tracking-tight'>{title}</h2>
				{description && <p className='text-xs text-muted-foreground'>{description}</p>}
			</div>
			{children}
		</section>
	);
}

/** One figure line inside a widget: label, value, optional trailing node. */
export function Figure({
	label,
	value,
	trailing,
}: {
	label: string;
	value: string;
	trailing?: ReactNode;
}) {
	return (
		<div className='flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5'>
			<span className='min-w-0 text-sm text-muted-foreground'>{label}</span>
			<span className='ml-auto flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-right'>
				<span className='text-sm font-medium tabular-nums'>{value}</span>
				{trailing}
			</span>
		</div>
	);
}

/** Widget shell: title, optional description, and a link to the source list. */
export function Widget({
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
		<Card className='h-full'>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description && <CardDescription>{description}</CardDescription>}
				<CardAction>
					<Link
						to={to}
						title={t(titleKeyLink)}
						aria-label={`${t('action.viewAll')} · ${t(titleKeyLink)}`}
						className='inline-flex min-h-8 items-center text-xs font-normal whitespace-nowrap text-muted-foreground hover:text-foreground'
					>
						{t('action.viewAll')}
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
export function QueryBody({
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
	if (isPending) return <SectionSkeleton />;
	if (isError) {
		return (
			<div className='flex flex-col items-start gap-2'>
				<ErrorState error={t('error.unavailable')} size='sm' className='w-full' />
				<Button variant='outline' size='sm' onClick={onRetry}>
					<RotateCw />
					{t('action.retry')}
				</Button>
			</div>
		);
	}
	return <>{children}</>;
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

/** The preset toggle plus the custom-range calendar of a dashboard chart. */
export function RangeControls({
	state,
	today,
}: {
	state: ReturnType<typeof useChartRange>;
	today: string;
}) {
	const { t } = useTranslation('dashboard');
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const [customOpen, setCustomOpen] = useState(false);
	const { range, setRange, custom, setCustom } = state;

	return (
		<>
			<div ref={setAnchor}>
				<ToggleGroup
					value={[range]}
					onValueChange={(values) => {
						const next = values[0];
						if (next) {
							setRange(next as TSalesRange);
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
						setCustom(next);
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
		</>
	);
}
