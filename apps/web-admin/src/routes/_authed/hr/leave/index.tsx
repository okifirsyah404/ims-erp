import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { EmployeeSelect } from '@/components/hr/employee-select';
import { RequestActions } from '@/components/hr/request-actions';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import { authClient } from '@/lib/auth-client';
import { formatBusinessDate, todayBusinessDate } from '@/lib/format';
import {
	createLeave,
	decideLeave,
	leaveBalancesQueryOptions,
	leaveRequestsQueryOptions,
	leaveTypesQueryOptions,
	REQUEST_STATUS_VARIANT,
	REQUEST_STATUSES,
	type TRequestStatus,
} from '@/lib/hr-records-api';
import { usePermission } from '@/lib/use-permission';

/** `/hr/leave` — leave recorded by HR and approved by someone else (M08). */
export const Route = createFileRoute('/_authed/hr/leave/')({
	component: LeavePage,
});


function LeavePage() {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const canCreate = usePermission('leave.create');
	const canApprove = usePermission('leave.approve');
	const canReject = usePermission('leave.reject');
	const canCancel = usePermission('leave.cancel');
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<TRequestStatus | ''>('');
	const [period, setPeriod] = useState('');
	const { data, isPending, isError, error } = useQuery(
		leaveRequestsQueryOptions({ page, status: status || undefined, period: period || undefined }),
	);
	const [recording, setRecording] = useState(false);
	const [busy, setBusy] = useState(false);

	const act = async (id: string, action: 'approve' | 'reject' | 'cancel') => {
		setBusy(true);
		try {
			await decideLeave(id, action, null);
			await queryClient.invalidateQueries({ queryKey: ['hr'] });
			toast.success(t(`hr:request.done.${action}`));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('hr:leave.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('hr:leave.description')}</p>
				</div>
				{canCreate && <Button onClick={() => setRecording(true)}>{t('hr:leave.new')}</Button>}
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
				<Input
					type='month'
					className='w-44'
					aria-label={t('hr:attendance.period')}
					value={period}
					onChange={(event) => {
						setPeriod(event.target.value);
						setPage(1);
					}}
				/>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('hr:leave.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('hr:field.employee')}</TableHead>
										<TableHead>{t('hr:leave.type')}</TableHead>
										<TableHead>{t('hr:leave.start')}</TableHead>
										<TableHead className='text-right'>{t('hr:leave.days')}</TableHead>
										<TableHead>{t('hr:field.status')}</TableHead>
										<TableHead />
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((row) => (
										<TableRow key={row.id}>
											<TableCell>
												<div className='font-medium'>{row.employee?.fullName ?? '—'}</div>
												<div className='text-xs text-muted-foreground'>{row.employee?.employeeCode}</div>
											</TableCell>
											<TableCell>
												{row.leaveType?.name ?? '—'}
												{row.reason && <div className='max-w-64 truncate text-xs text-muted-foreground'>{row.reason}</div>}
											</TableCell>
											<TableCell className='whitespace-nowrap'>
												{formatBusinessDate(row.startDate, i18n.language)} – {formatBusinessDate(row.endDate, i18n.language)}
											</TableCell>
											<TableCell className='text-right tabular-nums'>{row.days}</TableCell>
											<TableCell>
												<Badge variant={REQUEST_STATUS_VARIANT[row.status]}>{t(`hr:request.status.${row.status}`)}</Badge>
											</TableCell>
											<TableCell className='text-right'>
												<RequestActions
													status={row.status}
													recordedByMe={row.recordedBy === session?.user.id}
													canApprove={canApprove}
													canReject={canReject}
													canCancel={canCancel}
													busy={busy}
													onAction={(action) => void act(row.id, action)}
												/>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
					{data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
			{recording && <RecordLeaveDialog onClose={() => setRecording(false)} />}
		</div>
	);
}

function RecordLeaveDialog({ onClose }: { onClose: () => void }) {
	const { t } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const types = useQuery(leaveTypesQueryOptions());
	const [employeeId, setEmployeeId] = useState('');
	const [leaveTypeId, setLeaveTypeId] = useState('');
	const [startDate, setStartDate] = useState(todayBusinessDate());
	const [endDate, setEndDate] = useState(todayBusinessDate());
	const [reason, setReason] = useState('');
	const [busy, setBusy] = useState(false);
	const year = Number((startDate || todayBusinessDate()).slice(0, 4));
	const balances = useQuery(leaveBalancesQueryOptions(employeeId, year));
	const type = (types.data ?? []).find((item) => item.id === leaveTypeId);
	const balance = (balances.data ?? []).find((item) => item.leaveType.id === leaveTypeId);

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						setBusy(true);
						try {
							await createLeave({ employeeId, leaveTypeId, startDate, endDate, reason: reason.trim() || null });
							await queryClient.invalidateQueries({ queryKey: ['hr'] });
							toast.success(t('hr:leave.created'));
							onClose();
						} catch (cause) {
							toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
						} finally {
							setBusy(false);
						}
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('hr:leave.new')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='leave-employee'>{t('hr:field.employee')}</FieldLabel>
							<EmployeeSelect id='leave-employee' required value={employeeId} onChange={setEmployeeId} />
						</Field>
						<Field>
							<FieldLabel htmlFor='leave-type'>{t('hr:leave.type')}</FieldLabel>
							<Select value={leaveTypeId || 'none'} onValueChange={(value: string | null) => setLeaveTypeId(value === null || value === 'none' ? '' : value)}>
								<SelectTrigger id='leave-type' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>—</SelectItem>
									{(types.data ?? []).map((item) => (
										<SelectItem key={item.id} value={item.id}>
											{item.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{type?.usesQuota && balance && (
								<FieldDescription>
									{t('hr:balance.line', {
										remaining: balance.remaining,
										quota: balance.leaveType.annualQuotaDays,
										approved: balance.approved,
										pending: balance.pending,
									})}
								</FieldDescription>
							)}
						</Field>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='leave-start'>{t('hr:leave.start')}</FieldLabel>
								<DatePicker id='leave-start' required value={startDate} onChange={setStartDate} />
							</Field>
							<Field>
								<FieldLabel htmlFor='leave-end'>{t('hr:leave.end')}</FieldLabel>
								<DatePicker id='leave-end' required min={startDate} value={endDate} onChange={setEndDate} />
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor='leave-reason'>{t('hr:field.reason')}</FieldLabel>
							<Textarea id='leave-reason' rows={2} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={busy || !employeeId || !leaveTypeId}>
							{t('hr:leave.new')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
