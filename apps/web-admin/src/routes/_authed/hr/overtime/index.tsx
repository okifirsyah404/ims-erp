import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { MonthPicker } from '@ims-erp/ui/components/month-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmployeeSelect } from '@/components/hr/employee-select';
import { RequestActions } from '@/components/hr/request-actions';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import { authClient } from '@/lib/auth-client';
import { formatBusinessDate, todayBusinessDate } from '@/lib/format';
import {
	createOvertime,
	decideOvertime,
	overtimeQueryOptions,
	REQUEST_STATUS_VARIANT,
	REQUEST_STATUSES,
	type TOvertime,
	type TRequestStatus,
} from '@/lib/hr-records-api';
import { usePermission } from '@/lib/use-permission';
import { EmptyState, ErrorState } from '@/components/empty-state';

/** `/hr/overtime` — overtime recorded by HR and approved by someone else (M08). */
export const Route = createFileRoute('/_authed/hr/overtime/')({
	component: OvertimePage,
});

function OvertimePage() {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const canCreate = usePermission('overtime.create');
	const canApprove = usePermission('overtime.approve');
	const canReject = usePermission('overtime.reject');
	const canCancel = usePermission('overtime.cancel');
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<TRequestStatus | ''>('');
	const [period, setPeriod] = useState(todayBusinessDate().slice(0, 7));
	const { data, isPending, isError, error } = useQuery(overtimeQueryOptions({ page, status: status || undefined, period: period || undefined }));
	const [recording, setRecording] = useState(false);
	const [employeeId, setEmployeeId] = useState('');
	const [workDate, setWorkDate] = useState(todayBusinessDate());
	const [hours, setHours] = useState('1');
	const [reason, setReason] = useState('');
	const [busy, setBusy] = useState(false);

	const run = useCallback(
		async (work: () => Promise<unknown>, done: string) => {
			setBusy(true);
			try {
				await work();
				await queryClient.invalidateQueries({ queryKey: ['hr'] });
				toast.success(done);
				return true;
			} catch (cause) {
				toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
				return false;
			} finally {
				setBusy(false);
			}
		},
		[queryClient, t],
	);

	const userId = session?.user.id;
	const columns = useMemo<ColumnDef<DataTableFeatures, TOvertime, CellData>[]>(
		() => [
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
				id: 'date',
				header: t('hr:field.date'),
				meta: { cellClassName: 'whitespace-nowrap' },
				cell: ({ row }) => formatBusinessDate(row.original.workDate, i18n.language),
			},
			{
				id: 'hours',
				header: t('hr:overtime.hours'),
				meta: { align: 'right', cellClassName: 'tabular-nums' },
				cell: ({ row }) => Number(row.original.hours),
			},
			{
				id: 'reason',
				header: t('hr:field.reason'),
				meta: { cellClassName: 'max-w-64 truncate' },
				cell: ({ row }) => row.original.reason ?? '—',
			},
			{
				id: 'status',
				header: t('hr:field.status'),
				cell: ({ row }) => (
					<Badge variant={REQUEST_STATUS_VARIANT[row.original.status]}>
						{t(`hr:request.status.${row.original.status}`)}
					</Badge>
				),
			},
			{
				id: 'actions',
				header: '',
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RequestActions
						status={row.original.status}
						recordedByMe={row.original.recordedBy === userId}
						canApprove={canApprove}
						canReject={canReject}
						canCancel={canCancel}
						busy={busy}
						onAction={(action) =>
							void run(() => decideOvertime(row.original.id, action, null), t(`hr:request.done.${action}`))
						}
					/>
				),
			},
		],
		[busy, canApprove, canCancel, canReject, i18n.language, run, t, userId],
	);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('hr:overtime.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('hr:overtime.description')}</p>
				</div>
				{canCreate && <Button onClick={() => setRecording(true)}>{t('hr:overtime.new')}</Button>}
			</div>
			<div className='flex flex-wrap gap-2'>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === null || value === 'all' ? '' : (value as TRequestStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('hr:field.status')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('hr:request.allStatuses')}</SelectItem>
						{REQUEST_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`hr:request.status.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<MonthPicker
					className='w-44'
					aria-label={t('hr:attendance.period')}
					value={period}
					onChange={(value) => {
						setPeriod(value);
						setPage(1);
					}}
				/>
			</div>
			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && data.rows.length === 0 ? (
				<EmptyState title={t('hr:overtime.empty')} bordered />
			) : (
				<>
					<DataTable columns={columns} data={data?.rows ?? []} getRowId={(row) => row.id} loading={isPending} bordered />
					{data && data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
			<Dialog open={recording} onOpenChange={setRecording}>
				<DialogContent>
					<form
						onSubmit={async (event) => {
							event.preventDefault();
							const done = await run(
								() => createOvertime({ employeeId, workDate, hours: Number(hours), reason: reason.trim() || null }),
								t('hr:overtime.created'),
							);
							if (done) {
								setRecording(false);
								setReason('');
							}
						}}
					>
						<DialogHeader>
							<DialogTitle>{t('hr:overtime.new')}</DialogTitle>
						</DialogHeader>
						<FieldGroup className='py-4'>
							<Field>
								<FieldLabel htmlFor='overtime-employee'>{t('hr:field.employee')}</FieldLabel>
								<EmployeeSelect id='overtime-employee' required value={employeeId} onChange={setEmployeeId} />
							</Field>
							<div className='grid gap-4 sm:grid-cols-2'>
								<Field>
									<FieldLabel htmlFor='overtime-date'>{t('hr:field.date')}</FieldLabel>
									<DatePicker id='overtime-date' required value={workDate} onChange={setWorkDate} />
								</Field>
								<Field>
									<FieldLabel htmlFor='overtime-hours'>{t('hr:overtime.hours')}</FieldLabel>
									<Input
										id='overtime-hours'
										type='number'
										min='0.25'
										max='24'
										step='0.25'
										inputMode='decimal'
										required
										value={hours}
										onChange={(event) => setHours(event.target.value)}
									/>
								</Field>
							</div>
							<Field>
								<FieldLabel htmlFor='overtime-reason'>{t('hr:field.reason')}</FieldLabel>
								<Textarea id='overtime-reason' rows={2} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setRecording(false)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || !employeeId || !(Number(hours) > 0)}>
								{t('hr:overtime.new')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
