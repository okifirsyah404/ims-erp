import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute } from '@tanstack/react-router';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { EmptyState, ErrorState, errorMessage } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { businessDate } from '@/lib/date';
import { requestStatusLabel, REQUEST_STATUS_VARIANT } from '@/lib/labels';
import { myOvertimeListQueryOptions, requestOvertime } from '@/lib/portal-api';

/**
 * `/overtime` — overtime only.
 *
 * @remarks
 * Separate from `/leave` the way web-admin separates `/hr/overtime` from
 * `/hr/leave`. The employee logs hours; HR still decides.
 */
export function OvertimePage() {
	const { t } = useTranslation('employee');
	const queryClient = useQueryClient();
	const today = businessDate();

	const overtime = useQuery(myOvertimeListQueryOptions());
	const [workDate, setWorkDate] = useState(today);
	const [hours, setHours] = useState('1');
	const [reason, setReason] = useState('');

	const submit = useMutation({
		mutationFn: () =>
			requestOvertime({
				workDate,
				hours: Number(hours),
				reason: reason.trim() === '' ? null : reason.trim(),
			}),
		onSuccess: async () => {
			toast.success(t('leave.submitted'));
			setReason('');
			await queryClient.invalidateQueries({ queryKey: ['employee-portal'] });
		},
		onError: (error) => toast.error(errorMessage(error)),
	});

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='space-y-1'>
				<h1 className='text-xl font-semibold md:text-2xl'>{t('overtime.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('overtime.subtitle')}</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>{t('overtime.request')}</CardTitle>
				</CardHeader>
				<CardContent>
					<form
						className='space-y-4'
						onSubmit={(event) => {
							event.preventDefault();
							submit.mutate();
						}}
					>
						<FieldGroup className='grid gap-4 sm:grid-cols-3'>
							<Field>
								<FieldLabel>{t('leave.workDate')}</FieldLabel>
								<Input type='date' value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel>{t('leave.hours')}</FieldLabel>
								<Input
									type='number'
									step='0.25'
									min='0.25'
									max='24'
									value={hours}
									onChange={(event) => setHours(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel>{t('leave.reason')}</FieldLabel>
								<Input value={reason} onChange={(event) => setReason(event.target.value)} />
							</Field>
						</FieldGroup>
						<Button type='submit' disabled={submit.isPending}>
							{t('overtime.request')}
						</Button>
					</form>
				</CardContent>
			</Card>

			{overtime.isPending ? (
				<PageSkeleton cards={1} />
			) : overtime.isError ? (
				<ErrorState error={overtime.error} />
			) : (overtime.data ?? []).length === 0 ? (
				<EmptyState title={t('overtime.empty')} bordered />
			) : (
				<ul className='divide-y rounded-lg border'>
					{(overtime.data ?? []).map((row) => (
						<li key={row.id} className='flex items-center justify-between gap-2 p-3 text-sm'>
							<div>
								<p className='font-medium'>{row.workDate}</p>
								<p className='text-xs text-muted-foreground'>
									{row.hours} {t('leave.hours').toLowerCase()}
								</p>
							</div>
							<Badge variant={REQUEST_STATUS_VARIANT[row.status]}>
								{requestStatusLabel(t, row.status)}
							</Badge>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export const Route = createFileRoute('/_authed/overtime')({
	component: OvertimePage,
});
