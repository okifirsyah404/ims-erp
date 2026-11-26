import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute } from '@tanstack/react-router';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { EmptyState, ErrorState, errorMessage } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-dialog';
import { businessDate } from '@/lib/date';
import { requestStatusLabel, REQUEST_STATUS_VARIANT } from '@/lib/labels';
import {
	cancelLeave,
	myLeaveBalancesQueryOptions,
	myLeaveListQueryOptions,
	myLeaveTypesQueryOptions,
	requestLeave,
} from '@/lib/portal-api';

/**
 * `/leave` — leave only.
 *
 * @remarks
 * Leave and overtime are separate screens, matching web-admin's `/hr/leave` and
 * `/hr/overtime`: they are different records with different fields, and a tab
 * hid whichever one the employee did not open first.
 */
export function LeavePage() {
	const { t } = useTranslation('employee');
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const today = businessDate();

	const types = useQuery(myLeaveTypesQueryOptions);
	const balances = useQuery(myLeaveBalancesQueryOptions);
	const leaves = useQuery(myLeaveListQueryOptions());

	const [leaveTypeId, setLeaveTypeId] = useState('');
	const [startDate, setStartDate] = useState(today);
	const [endDate, setEndDate] = useState(today);
	const [reason, setReason] = useState('');

	const refresh = async () => {
		await queryClient.invalidateQueries({ queryKey: ['employee-portal'] });
	};

	const submit = useMutation({
		mutationFn: () =>
			requestLeave({
				leaveTypeId,
				startDate,
				endDate,
				reason: reason.trim() === '' ? null : reason.trim(),
			}),
		onSuccess: async () => {
			toast.success(t('leave.submitted'));
			setReason('');
			await refresh();
		},
		onError: (error) => toast.error(errorMessage(error)),
	});

	const cancel = useMutation({
		mutationFn: (id: string) => cancelLeave(id),
		onSuccess: async () => {
			toast.success(t('leave.cancelled'));
			await refresh();
		},
		onError: (error) => toast.error(errorMessage(error)),
	});

	if (types.isPending) return <PageSkeleton cards={2} />;

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='space-y-1'>
				<h1 className='text-xl font-semibold md:text-2xl'>{t('leave.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('leave.subtitle')}</p>
			</header>

			{(balances.data ?? []).length > 0 ? (
				<div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
					{(balances.data ?? []).map((balance) => (
						<Card key={balance.leaveType.id}>
							<CardHeader className='pb-2'>
								<CardTitle className='text-sm'>{balance.leaveType.name}</CardTitle>
							</CardHeader>
							<CardContent className='text-sm text-muted-foreground'>
								{balance.leaveType.annualQuotaDays > 0
									? t('leave.balanceDays', {
											used: balance.approved + balance.pending,
											quota: balance.leaveType.annualQuotaDays,
										})
									: t('leave.notLimited')}
							</CardContent>
						</Card>
					))}
				</div>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>{t('leave.request')}</CardTitle>
				</CardHeader>
				<CardContent>
					<form
						className='space-y-4'
						onSubmit={(event) => {
							event.preventDefault();
							submit.mutate();
						}}
					>
						<FieldGroup className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel>{t('leave.type')}</FieldLabel>
								<Select value={leaveTypeId} onValueChange={(value) => setLeaveTypeId(value ?? '')}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{(types.data ?? []).map((type) => (
											<SelectItem key={type.id} value={type.id}>
												{type.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel>{t('leave.reason')}</FieldLabel>
								<Input value={reason} onChange={(event) => setReason(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel>{t('leave.startDate')}</FieldLabel>
								<Input type='date' value={startDate} onChange={(event) => setStartDate(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel>{t('leave.endDate')}</FieldLabel>
								<Input type='date' value={endDate} onChange={(event) => setEndDate(event.target.value)} />
							</Field>
						</FieldGroup>
						<Button type='submit' disabled={!leaveTypeId || submit.isPending}>
							{t('leave.request')}
						</Button>
					</form>
				</CardContent>
			</Card>

			{leaves.isPending ? (
				<PageSkeleton cards={1} />
			) : leaves.isError ? (
				<ErrorState error={leaves.error} />
			) : (leaves.data ?? []).length === 0 ? (
				<EmptyState title={t('leave.empty')} bordered />
			) : (
				<ul className='divide-y rounded-lg border'>
					{(leaves.data ?? []).map((row) => (
						<li key={row.id} className='flex flex-wrap items-center justify-between gap-2 p-3 text-sm'>
							<div>
								<p className='font-medium'>
									{row.leaveType?.name} · {row.startDate} → {row.endDate}
								</p>
								<p className='text-xs text-muted-foreground'>{t('leave.days', { count: row.days })}</p>
							</div>
							<div className='flex items-center gap-2'>
								<Badge variant={REQUEST_STATUS_VARIANT[row.status]}>
									{requestStatusLabel(t, row.status)}
								</Badge>
								{row.status === 'submitted' || row.status === 'approved' ? (
									<Button
										size='sm'
										variant='outline'
										disabled={cancel.isPending}
										onClick={async () => {
											if (await confirm({ title: t('leave.cancelConfirm') })) cancel.mutate(row.id);
										}}
									>
										{t('leave.cancel')}
									</Button>
								) : null}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export const Route = createFileRoute('/_authed/leave')({
	component: LeavePage,
});
