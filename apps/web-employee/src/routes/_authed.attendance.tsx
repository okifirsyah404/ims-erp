import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogIn, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute } from '@tanstack/react-router';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { EmptyState, ErrorState, errorMessage } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { currentPeriod } from '@/lib/date';
import { attendanceSourceLabel, attendanceStatusLabel } from '@/lib/labels';
import {
	ATTENDANCE_STATUSES,
	checkIn,
	checkOut,
	myAttendanceListQueryOptions,
	myAttendanceMonthQueryOptions,
	myTodayQueryOptions,
	type TAttendanceStatus,
} from '@/lib/portal-api';

/** Month name for a `YYYY-MM` period, in the user's language. */
function periodLabel(period: string, language: string): string {
	return new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
	}).format(new Date(`${period}-01T00:00:00Z`));
}

/** `/attendance` — self check-in/out plus the month recap. */
export function AttendancePage() {
	const { t, i18n } = useTranslation('employee');
	const queryClient = useQueryClient();
	const [period] = useState(() => currentPeriod());

	const today = useQuery(myTodayQueryOptions);
	const month = useQuery(myAttendanceMonthQueryOptions(period));
	const rows = useQuery(myAttendanceListQueryOptions(period));

	const refresh = async () => {
		await queryClient.invalidateQueries({ queryKey: ['employee-portal', 'attendance'] });
	};

	const checkInMutation = useMutation({
		mutationFn: checkIn,
		onSuccess: async () => {
			toast.success(t('attendance.checkInSuccess'));
			await refresh();
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	const checkOutMutation = useMutation({
		mutationFn: checkOut,
		onSuccess: async () => {
			toast.success(t('attendance.checkOutSuccess'));
			await refresh();
		},
		onError: (error) => toast.error(errorMessage(error)),
	});

	if (today.isPending) return <PageSkeleton cards={2} />;
	if (today.isError) return <ErrorState error={today.error} />;

	const record = today.data?.record ?? null;
	const canCheckIn = !record?.checkIn && record?.source !== 'leave';
	const canCheckOut = !!record?.checkIn && !record?.checkOut;

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='space-y-1'>
				<h1 className='text-xl font-semibold md:text-2xl'>{t('attendance.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('attendance.subtitle')}</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>{t('home.attendanceCard')}</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4'>
					<div className='space-y-1 text-sm'>
						{record?.checkIn ? (
							<p>{t('attendance.checkedInAt', { time: record.checkIn })}</p>
						) : (
							<p className='text-muted-foreground'>{t('attendance.notCheckedIn')}</p>
						)}
						{record?.checkOut ? (
							<p className='text-muted-foreground'>
								{t('attendance.checkedOutAt', { time: record.checkOut })}
							</p>
						) : null}
						{record ? <Badge variant='secondary'>{attendanceSourceLabel(t, record.source)}</Badge> : null}
					</div>
					<div className='flex flex-wrap gap-2'>
						<Button
							onClick={() => checkInMutation.mutate()}
							disabled={!canCheckIn || checkInMutation.isPending}
						>
							<LogIn /> {t('attendance.checkIn')}
						</Button>
						<Button
							variant='outline'
							onClick={() => checkOutMutation.mutate()}
							disabled={!canCheckOut || checkOutMutation.isPending}
						>
							<LogOut /> {t('attendance.checkOut')}
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>{periodLabel(period, i18n.language)}</CardTitle>
				</CardHeader>
				<CardContent>
					{month.isPending ? (
						<Skeleton className='h-20 w-full' />
					) : (
						<div className='grid grid-cols-3 gap-2 sm:grid-cols-6'>
							{ATTENDANCE_STATUSES.map((status: TAttendanceStatus) => (
								<div key={status} className='rounded-md border p-2 text-center'>
									<p className='text-lg font-semibold'>{month.data?.counts[status] ?? 0}</p>
									<p className='text-xs text-muted-foreground'>
										{attendanceStatusLabel(t, status)}
									</p>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<section className='space-y-2'>
				<h2 className='text-sm font-medium'>{t('attendance.history')}</h2>
				{rows.isPending ? (
					<Skeleton className='h-24 w-full' />
				) : rows.isError ? (
					<ErrorState error={rows.error} />
				) : (rows.data ?? []).length === 0 ? (
					<EmptyState title={t('attendance.empty')} bordered />
				) : (
					<ul className='divide-y rounded-lg border'>
						{(rows.data ?? []).map((row) => (
							<li key={row.id} className='flex items-center justify-between gap-2 p-3 text-sm'>
								<div>
									<p className='font-medium'>{row.attendanceDate}</p>
									<p className='text-xs text-muted-foreground'>
										{row.checkIn ?? '—'} – {row.checkOut ?? '—'}
									</p>
								</div>
								<div className='flex items-center gap-2'>
									<Badge variant={row.status === 'present' ? 'default' : 'secondary'}>
										{attendanceStatusLabel(t, row.status)}
									</Badge>
									<Badge variant='outline'>
										{attendanceSourceLabel(t, row.source)}
									</Badge>
								</div>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}


export const Route = createFileRoute('/_authed/attendance')({
	component: AttendancePage,
});


