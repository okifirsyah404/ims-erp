import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { TimePicker } from '@ims-erp/ui/components/time-picker';
import { useConfirm } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { FieldLabel } from '@/components/form/field-label';
import { EmployeeSelect } from '@/components/hr/employee-select';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import { formatBusinessDate, todayBusinessDate } from '@/lib/format';
import {
	ATTENDANCE_STATUSES,
	attendanceListQueryOptions,
	createAttendance,
	removeAttendance,
	type TAttendanceListRow,
	type TAttendanceStatus,
	updateAttendance,
} from '@/lib/hr-records-api';

/**
 * Attendance rows across dates with single-row create / edit / delete
 * (`attendance:record`). Days written by an approved leave are read-only:
 * cancelling the leave removes them (the server refuses too).
 */
export function AttendanceList({ canRecord }: { canRecord: boolean }) {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [page, setPage] = useState(1);
	const [employeeId, setEmployeeId] = useState('');
	const [from, setFrom] = useState('');
	const [to, setTo] = useState('');
	const [status, setStatus] = useState<TAttendanceStatus | ''>('');
	const { data, isPending, isError, error } = useQuery(
		attendanceListQueryOptions({ page, employeeId: employeeId || undefined, from: from || undefined, to: to || undefined, status: status || undefined }),
	);
	/** `undefined` = dialog closed, `null` = new row, a row = editing it. */
	const [editing, setEditing] = useState<TAttendanceListRow | null | undefined>(undefined);
	const [busy, setBusy] = useState(false);

	const remove = useCallback(
		async (row: TAttendanceListRow) => {
			if (!(await confirm({ title: t('hr:attendance.deleteConfirm'), destructive: true }))) return;
			setBusy(true);
			try {
				await removeAttendance(row.id);
				await queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
				toast.success(t('hr:attendance.deleted'));
			} catch (cause) {
				toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
			} finally {
				setBusy(false);
			}
		},
		[confirm, queryClient, t],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TAttendanceListRow, CellData>[]>(
		() => [
			{
				id: 'date',
				header: t('hr:field.date'),
				meta: { cellClassName: 'whitespace-nowrap' },
				cell: ({ row }) => formatBusinessDate(row.original.attendanceDate, i18n.language),
			},
			{
				id: 'employee',
				header: t('hr:field.employee'),
				cell: ({ row }) => (
					<>
						<div className='font-medium'>{row.original.employee?.fullName ?? '—'}</div>
						<div className='text-xs text-muted-foreground'>{row.original.employee?.employeeCode}</div>
					</>
				),
			},
			{
				id: 'status',
				header: t('hr:field.status'),
				cell: ({ row }) => (
					<Badge variant={row.original.source === 'leave' ? 'secondary' : 'outline'}>
						{t(`hr:status.${row.original.status}`)}
						{row.original.source === 'leave' ? ` · ${t('hr:attendance.fromLeave')}` : ''}
					</Badge>
				),
			},
			{
				id: 'times',
				header: `${t('hr:attendance.checkIn')} – ${t('hr:attendance.checkOut')}`,
				meta: { cellClassName: 'tabular-nums whitespace-nowrap' },
				cell: ({ row }) => `${row.original.checkIn ?? '—'} – ${row.original.checkOut ?? '—'}`,
			},
			{
				id: 'notes',
				header: t('hr:field.notes'),
				cell: ({ row }) => <span className='block max-w-64 truncate'>{row.original.notes ?? '—'}</span>,
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('hr:attendance.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('hr:attendance.actions')}
						disabled={busy}
						actions={[
							{
								key: 'edit',
								label: t('hr:attendance.edit'),
								icon: Pencil,
								hidden: !canRecord || row.original.source === 'leave',
								onSelect: () => setEditing(row.original),
							},
							{
								key: 'delete',
								label: t('hr:attendance.delete'),
								icon: Trash2,
								destructive: true,
								hidden: !canRecord || row.original.source === 'leave',
								onSelect: () => void remove(row.original),
							},
						]}
					/>
				),
			},
		],
		[busy, canRecord, i18n.language, remove, t],
	);

	const reset = () => setPage(1);

	return (
		<>
			<div className='flex flex-wrap items-center gap-2'>
				<EmployeeSelect
					className='h-9 max-w-xs rounded-md border bg-transparent px-3 text-sm'
					value={employeeId}
					allowAll={t('hr:field.employee')}
					onChange={(value) => {
						setEmployeeId(value);
						reset();
					}}
				/>
				<DatePicker
					className='w-40'
					aria-label={t('hr:attendance.from')}
					value={from}
					onChange={(value) => {
						setFrom(value);
						reset();
					}}
				/>
				<DatePicker
					className='w-40'
					aria-label={t('hr:attendance.to')}
					min={from || undefined}
					value={to}
					onChange={(value) => {
						setTo(value);
						reset();
					}}
				/>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === null || value === 'all' ? '' : (value as TAttendanceStatus));
						reset();
					}}
				>
					<SelectTrigger aria-label={t('hr:field.status')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('hr:attendance.allStatuses')}</SelectItem>
						{ATTENDANCE_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`hr:status.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{canRecord && (
					<Button className='ml-auto' onClick={() => setEditing(null)}>
						{t('hr:attendance.new')}
					</Button>
				)}
			</div>
			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && data.rows.length === 0 ? (
					<EmptyState title={t('hr:attendance.listEmpty')} />
				) : (
					<>
						<DataTable columns={columns} data={data?.rows ?? []} getRowId={(row) => row.id} loading={isPending} />
						{data && data.pagination.totalPages > 1 && (
							<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
						)}
					</>
				)}
			</DataTableCard>
			{editing !== undefined && (
				<AttendanceRecordDialog key={editing?.id ?? 'new'} row={editing} onClose={() => setEditing(undefined)} />
			)}
		</>
	);
}

function AttendanceRecordDialog({ row, onClose }: { row: TAttendanceListRow | null; onClose: () => void }) {
	const { t } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const [employeeId, setEmployeeId] = useState(row?.employeeId ?? '');
	const [date, setDate] = useState(row?.attendanceDate ?? todayBusinessDate());
	const [status, setStatus] = useState<TAttendanceStatus>(row?.status ?? 'present');
	const [checkIn, setCheckIn] = useState(row?.checkIn ?? '');
	const [checkOut, setCheckOut] = useState(row?.checkOut ?? '');
	const [notes, setNotes] = useState(row?.notes ?? '');
	const [busy, setBusy] = useState(false);

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						setBusy(true);
						try {
							const input = { employeeId, date, status, checkIn: checkIn || null, checkOut: checkOut || null, notes: notes.trim() || null };
							await (row ? updateAttendance(row.id, input) : createAttendance(input));
							await queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
							toast.success(row ? t('hr:attendance.updated') : t('hr:attendance.created'));
							onClose();
						} catch (cause) {
							toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
						} finally {
							setBusy(false);
						}
					}}
				>
					<DialogHeader>
						<DialogTitle>{row ? t('hr:attendance.edit') : t('hr:attendance.new')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='attendance-employee'>{t('hr:field.employee')}</FieldLabel>
							<EmployeeSelect id='attendance-employee' required value={employeeId} onChange={setEmployeeId} />
						</Field>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='attendance-date'>{t('hr:field.date')}</FieldLabel>
								<DatePicker id='attendance-date' required value={date} onChange={setDate} />
							</Field>
							<Field>
								<FieldLabel htmlFor='attendance-status'>{t('hr:field.status')}</FieldLabel>
								<Select value={status} onValueChange={(value: string | null) => setStatus((value ?? 'present') as TAttendanceStatus)}>
									<SelectTrigger id='attendance-status' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ATTENDANCE_STATUSES.map((value) => (
											<SelectItem key={value} value={value}>
												{t(`hr:status.${value}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor='attendance-in' optional>{t('hr:attendance.checkIn')}</FieldLabel>
								<TimePicker id='attendance-in' value={checkIn} onChange={setCheckIn} />
							</Field>
							<Field>
								<FieldLabel htmlFor='attendance-out' optional>{t('hr:attendance.checkOut')}</FieldLabel>
								<TimePicker id='attendance-out' value={checkOut} onChange={setCheckOut} />
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor='attendance-notes' optional>{t('hr:field.notes')}</FieldLabel>
							<Input id='attendance-notes' maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={busy || !employeeId || !date}>
							{row ? t('common:action.save') : t('hr:attendance.new')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
