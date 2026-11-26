import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createFileRoute } from '@tanstack/react-router';
import { Badge } from '@ims-erp/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { PageSkeleton } from '@/components/page-skeleton';
import { businessDate } from '@/lib/date';
import {
	myContextQueryOptions,
	myScheduleQueryOptions,
	myTasksQueryOptions,
	myTodayQueryOptions,
} from '@/lib/portal-api';

/** `/` — the employee's day at a glance. */
export function HomePage() {
	const { t } = useTranslation('employee');
	const { data: context } = useQuery(myContextQueryOptions);
	const { data: today, isPending } = useQuery(myTodayQueryOptions);
	const { data: schedule } = useQuery(myScheduleQueryOptions(businessDate()));
	const { data: tasks } = useQuery(myTasksQueryOptions('open'));

	if (isPending) return <PageSkeleton cards={3} />;

	const shift = schedule?.rows[0]?.cells[businessDate()] ?? null;
	const openTasks = tasks ?? [];

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='space-y-1'>
				<h1 className='text-xl font-semibold md:text-2xl'>
					{t('home.greeting', { name: context?.fullName ?? '' })}
				</h1>
				<p className='text-sm text-muted-foreground'>{t('home.subtitle')}</p>
			</header>

			<div className='grid gap-4 md:grid-cols-3'>
				<Card>
					<CardHeader className='flex-row items-center justify-between'>
						<CardTitle className='text-base'>{t('home.attendanceCard')}</CardTitle>
						<ClipboardList className='size-4 text-muted-foreground' />
					</CardHeader>
					<CardContent className='space-y-2 text-sm'>
						{today?.record?.checkIn ? (
							<>
								<p>{t('attendance.checkedInAt', { time: today.record.checkIn })}</p>
								{today.record.checkOut ? (
									<p className='text-muted-foreground'>
										{t('attendance.checkedOutAt', { time: today.record.checkOut })}
									</p>
								) : null}
							</>
						) : (
							<p className='text-muted-foreground'>{t('attendance.notCheckedIn')}</p>
						)}
						<Link to='/attendance' className='text-primary text-sm underline-offset-4 hover:underline'>
							{t('nav.attendance')}
						</Link>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className='flex-row items-center justify-between'>
						<CardTitle className='text-base'>{t('home.scheduleCard')}</CardTitle>
						<CalendarDays className='size-4 text-muted-foreground' />
					</CardHeader>
					<CardContent className='space-y-1 text-sm'>
						{!shift ? (
							<p className='text-muted-foreground'>{t('home.noSchedule')}</p>
						) : shift.isDayOff ? (
							<Badge variant='secondary'>{t('home.dayOff')}</Badge>
						) : (
							<>
								<p className='font-medium'>
									{shift.shiftStart ?? '—'} – {shift.shiftEnd ?? '—'}
								</p>
								{shift.shiftLabel ? <p className='text-muted-foreground'>{shift.shiftLabel}</p> : null}
							</>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className='flex-row items-center justify-between'>
						<CardTitle className='text-base'>{t('home.tasksCard')}</CardTitle>
						<CheckCircle2 className='size-4 text-muted-foreground' />
					</CardHeader>
					<CardContent className='space-y-2 text-sm'>
						{openTasks.length === 0 ? (
							<p className='text-muted-foreground'>{t('home.noTasks')}</p>
						) : (
							<ul className='space-y-1'>
								{openTasks.slice(0, 3).map((task) => (
									<li key={task.id} className='flex items-center justify-between gap-2'>
										<span className='truncate'>{task.title}</span>
										{task.dueDate ? (
											<span className='shrink-0 text-muted-foreground'>
												{t('tasks.due', { date: task.dueDate })}
											</span>
										) : null}
									</li>
								))}
							</ul>
						)}
						<Link to='/tasks' className='text-primary text-sm underline-offset-4 hover:underline'>
							{t('nav.tasks')}
						</Link>
					</CardContent>
				</Card>
			</div>

			{context?.organizations.length ? (
				<Card>
					<CardHeader>
						<CardTitle className='text-base'>{t('profile.organizations')}</CardTitle>
					</CardHeader>
					<CardContent className='text-sm text-muted-foreground'>
						{context.organizations.map((org) => org.employeeCode).join(' · ')}
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}



export const Route = createFileRoute('/_authed/')({
	component: HomePage,
});
