import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Input } from '@ims-erp/ui/components/input';
import { MonthPicker } from '@ims-erp/ui/components/month-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { TimePicker } from '@ims-erp/ui/components/time-picker';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { ImportDialog } from '@/components/hr/import-dialog';
import { toast } from '@/components/toast';
import { todayBusinessDate } from '@/lib/format';
import {
	ATTENDANCE_STATUSES,
	attendanceDayQueryOptions,
	attendanceMonthQueryOptions,
	importAttendance,
	saveAttendanceDay,
	type TAttendanceDayRow,
	type TAttendanceEntry,
	type TAttendanceMonthRow,
	type TAttendanceStatus,
} from '@/lib/hr-records-api';
import { usePermission } from '@/lib/use-permission';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';

/** `/hr/attendance` — the day sheet, the monthly recap and the import (M08). */
export const Route = createFileRoute('/_authed/hr/attendance/')({
	component: AttendancePage,
});

function AttendancePage() {
	const { t } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const canRecord = usePermission('attendance.record');
	const [view, setView] = useState<'day' | 'month'>('day');
	const [date, setDate] = useState(todayBusinessDate());
	const [period, setPeriod] = useState(todayBusinessDate().slice(0, 7));
	const [importing, setImporting] = useState(false);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('hr:attendance.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('hr:attendance.description')}</p>
				</div>
				{canRecord && (
					<Button variant='outline' onClick={() => setImporting(true)}>
						{t('hr:attendance.import')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap items-center gap-2'>
				<div className='inline-flex rounded-md border p-0.5'>
					{(['day', 'month'] as const).map((value) => (
						<Button key={value} size='sm' variant={view === value ? 'default' : 'ghost'} onClick={() => setView(value)}>
							{t(value === 'day' ? 'hr:attendance.day' : 'hr:attendance.month')}
						</Button>
					))}
				</div>
				{view === 'day' ? (
					<DatePicker className='w-44' aria-label={t('hr:field.date')} value={date} onChange={setDate} />
				) : (
					<MonthPicker
						className='w-44'
						aria-label={t('hr:attendance.period')}
						value={period}
						onChange={setPeriod}
					/>
				)}
			</div>
			{view === 'day' ? <DayView date={date} canRecord={canRecord} /> : <MonthView period={period} />}
			<ImportDialog
				open={importing}
				onOpenChange={setImporting}
				templatePath='/human-resources/attendances/template'
				templateName='template-absensi.xlsx'
				templateLabel={t('hr:attendance.template')}
				onImport={importAttendance}
				onDone={() => void queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] })}
			/>
		</div>
	);
}

function DayView({ date, canRecord }: { date: string; canRecord: boolean }) {
	const { data, isPending, isError, error, dataUpdatedAt } = useQuery(attendanceDayQueryOptions(date));
	if (isPending) return <PageSkeleton cards={1} />;
	if (isError) return <ErrorState error={error} bordered />;
	// Remount when the day or the server data changes, so the draft starts from it.
	return <DaySheet key={`${date}-${dataUpdatedAt}`} date={date} rows={data} canRecord={canRecord} />;
}

type TDraft = Record<string, TAttendanceEntry | undefined>;

function DaySheet({ date, rows, canRecord }: { date: string; rows: TAttendanceDayRow[]; canRecord: boolean }) {
	const { t } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState<TDraft>(() =>
		Object.fromEntries(
			rows
				.filter((row) => row.record)
				.map((row) => [
					row.employee.id,
					{ employeeId: row.employee.id, status: row.record!.status, checkIn: row.record!.checkIn, checkOut: row.record!.checkOut, notes: row.record!.notes },
				]),
		),
	);
	const [busy, setBusy] = useState(false);

	if (rows.length === 0) {
		return (
			<EmptyState title={t('hr:attendance.empty')} bordered />
		);
	}

	const change = (employeeId: string, patch: Partial<TAttendanceEntry>) =>
		setDraft((current) => {
			const base = current[employeeId] ?? { employeeId, status: 'present' as TAttendanceStatus, checkIn: null, checkOut: null, notes: null };
			return { ...current, [employeeId]: { ...base, ...patch } };
		});
	const editable = (row: TAttendanceDayRow) => canRecord && row.record?.source !== 'leave';

	return (
		<>
			<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('hr:field.employee')}</TableHead>
								<TableHead>{t('hr:field.status')}</TableHead>
								<TableHead>{t('hr:attendance.checkIn')}</TableHead>
								<TableHead>{t('hr:attendance.checkOut')}</TableHead>
								<TableHead>{t('hr:field.notes')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => {
								const entry = draft[row.employee.id];
								const fromLeave = row.record?.source === 'leave';
								return (
									<TableRow key={row.employee.id}>
										<TableCell>
											<div className='font-medium'>{row.employee.fullName}</div>
											<div className='text-xs text-muted-foreground'>
												{row.employee.employeeCode}
											</div>
										</TableCell>
										<TableCell>
											{fromLeave ? (
												<Badge variant='secondary'>
													{t(`hr:status.${row.record!.status}`)} · {t('hr:attendance.fromLeave')}
												</Badge>
											) : (
												<Select
													value={entry?.status ?? 'none'}
													disabled={!editable(row)}
													onValueChange={(value: string | null) => change(row.employee.id, { status: value as TAttendanceStatus })}
												>
													<SelectTrigger aria-label={t('hr:field.status')} className='h-8 w-full'>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value='none' disabled>
															{t('hr:attendance.notRecorded')}
														</SelectItem>
														{ATTENDANCE_STATUSES.map((status) => (
															<SelectItem key={status} value={status}>
																{t(`hr:status.${status}`)}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											)}
										</TableCell>
										<TableCell>
											<TimePicker
												className='w-28'
												aria-label={t('hr:attendance.checkIn')}
												disabled={!editable(row) || !entry}
												value={entry?.checkIn ?? ''}
												onChange={(value) => change(row.employee.id, { checkIn: value || null })}
											/>
										</TableCell>
										<TableCell>
											<TimePicker
												className='w-28'
												aria-label={t('hr:attendance.checkOut')}
												disabled={!editable(row) || !entry}
												value={entry?.checkOut ?? ''}
												onChange={(value) => change(row.employee.id, { checkOut: value || null })}
											/>
										</TableCell>
										<TableCell>
											<Input
												className='h-8'
												aria-label={t('hr:field.notes')}
												maxLength={500}
												disabled={!editable(row) || !entry}
												value={entry?.notes ?? ''}
												onChange={(event) => change(row.employee.id, { notes: event.target.value || null })}
											/>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
			{canRecord && (
				<div className='flex flex-wrap justify-end gap-2'>
					<Button
						variant='outline'
						onClick={() => {
							for (const row of rows) if (editable(row) && !draft[row.employee.id]) change(row.employee.id, { status: 'present' });
						}}
					>
						{t('hr:attendance.allPresent')}
					</Button>
					<Button
						disabled={busy || Object.keys(draft).length === 0}
						onClick={async () => {
							setBusy(true);
							try {
								const entries = Object.values(draft).filter((entry): entry is TAttendanceEntry => !!entry);
								const result = await saveAttendanceDay(date, entries);
								await queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
								toast.success(t('hr:attendance.saved', { saved: result.saved, skipped: result.skipped }));
							} catch (cause) {
								toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
							} finally {
								setBusy(false);
							}
						}}
					>
						{t('hr:attendance.save')}
					</Button>
				</div>
			)}
		</>
	);
}

function MonthView({ period }: { period: string }) {
	const { t } = useTranslation(['hr', 'common']);
	const { data, isPending, isError, error } = useQuery(attendanceMonthQueryOptions(period));
	const columns = useMemo<ColumnDef<DataTableFeatures, TAttendanceMonthRow, CellData>[]>(
		() => [
			{
				id: 'employee',
				header: t('hr:field.employee'),
				cell: ({ row }) => (
					<>
						<div className='font-medium'>{row.original.employee.fullName}</div>
						<div className='text-xs text-muted-foreground'>{row.original.employee.employeeCode}</div>
					</>
				),
			},
			...ATTENDANCE_STATUSES.map(
				(status): ColumnDef<DataTableFeatures, TAttendanceMonthRow, CellData> => ({
					id: status,
					header: t(`hr:status.${status}`),
					meta: { align: 'right', cellClassName: 'tabular-nums' },
					cell: ({ row }) => row.original.counts[status] || '—',
				}),
			),
		],
		[t],
	);
	return (
		<DataTableCard title={t('hr:attendance.month')}>
			{isError ? (
				<ErrorState error={error} />
			) : (
				<DataTable columns={columns} data={data ?? []} getRowId={(row) => row.employee.id} loading={isPending} sortable />
			)}
		</DataTableCard>
	);
}
