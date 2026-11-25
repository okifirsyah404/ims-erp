import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute } from '@tanstack/react-router';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { addDays, businessDate, weekStart, weekdayLabel } from '@/lib/date';
import { myScheduleQueryOptions } from '@/lib/portal-api';

/** `/schedule` — the caller's own shift cells for a week. */
export function SchedulePage() {
	const { t, i18n } = useTranslation('employee');
	const [start, setStart] = useState(() => weekStart());
	const { data, isPending, isError, error } = useQuery(myScheduleQueryOptions(start));

	const cells = data?.rows[0]?.cells ?? {};
	const today = businessDate();

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='flex flex-wrap items-center justify-between gap-2'>
				<div className='space-y-1'>
					<h1 className='text-xl font-semibold md:text-2xl'>{t('schedule.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('schedule.subtitle')}</p>
				</div>
				<div className='flex gap-2'>
					<Button variant='outline' size='sm' onClick={() => setStart(addDays(start, -7))}>
						{t('schedule.previousWeek')}
					</Button>
					<Button variant='outline' size='sm' onClick={() => setStart(weekStart())}>
						{t('schedule.thisWeek')}
					</Button>
					<Button variant='outline' size='sm' onClick={() => setStart(addDays(start, 7))}>
						{t('schedule.nextWeek')}
					</Button>
				</div>
			</header>

			{isPending ? (
				<PageSkeleton cards={2} />
			) : isError ? (
				<ErrorState error={error} />
			) : (
				<Card>
					<CardHeader>
						<CardTitle className='text-base'>{start}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
						{(data?.dates ?? []).map((date) => {
							const cell = cells[date] ?? null;
							return (
								<div
									key={date}
									className={
										date === today
											? 'rounded-md border border-primary/50 bg-primary/5 p-3'
											: 'rounded-md border p-3'
									}
								>
									<p className='text-xs text-muted-foreground'>{weekdayLabel(date, i18n.language)}</p>
									{!cell ? (
										<p className='mt-1 text-sm text-muted-foreground'>—</p>
									) : cell.isDayOff ? (
										<Badge variant='secondary' className='mt-1'>
											{t('home.dayOff')}
										</Badge>
									) : (
										<>
											<p className='mt-1 text-sm font-medium'>
												{cell.shiftStart ?? '—'} – {cell.shiftEnd ?? '—'}
											</p>
											{cell.shiftLabel ? (
												<p className='text-xs text-muted-foreground'>{cell.shiftLabel}</p>
											) : null}
										</>
									)}
								</div>
							);
						})}
					</CardContent>
					{(data?.dates ?? []).every((date) => !cells[date]) ? (
						<div className='px-6 pb-6'>
							<EmptyState title={t('schedule.empty')} bordered />
						</div>
					) : null}
				</Card>
			)}
		</div>
	);
}



export const Route = createFileRoute('/_authed/schedule')({
	component: SchedulePage,
});
