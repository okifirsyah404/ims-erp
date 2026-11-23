import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { useConfirm } from '@/components/confirm-dialog';
import { EmployeeRecordCards } from '@/components/hr/employee-records';
import { toast } from '@/components/toast';
import { archiveEmployee, employeeDetailQueryOptions } from '@/lib/hr-api';
import { usePermission } from '@/lib/use-permission';

/** `/hr/employees/$employeeId` — employee detail. */
export const Route = createFileRoute('/_authed/hr/employees/$employeeId')({
	component: EmployeeDetailPage,
});

function EmployeeDetailPage() {
	const { t } = useTranslation(['hr', 'common']);
	const { employeeId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const canArchive = usePermission('employee.archive');
	const canUpdate = usePermission('employee.update');
	const confirm = useConfirm();

	const { data: employee, isPending } = useQuery({
		...employeeDetailQueryOptions(employeeId),
		retry: false,
	});

	const archive = useMutation({
		mutationFn: () => archiveEmployee(employeeId),
		onSuccess: async () => {
			toast.success(t('hr:list.archived'));
			await queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
			void navigate({ to: '/hr/employees' });
		},
		onError: (error: Error) => toast.error(error.message),
	});

	if (isPending) {
		return (
			<div className='mx-auto max-w-2xl space-y-4 p-4'>
				<Skeleton className='h-8 w-48' />
				<Skeleton className='h-64' />
			</div>
		);
	}

	if (!employee) {
		return (
			<div className='p-4 text-sm text-muted-foreground'>
				{t('hr:detail.notFound')}
			</div>
		);
	}

	const rows: Array<[string, string | null | undefined]> = [
		[t('hr:form.employeeCode'), employee.employeeCode],
		[t('hr:form.email'), employee.email],
		[t('hr:form.phone'), employee.phone],
		[t('hr:form.nationalId'), employee.nationalId],
		[t('hr:form.employmentType'), t(`hr:employmentType.${employee.employmentType}`)],
		[t('hr:form.workType'), t(`hr:workType.${employee.workType}`)],
		[
			t('hr:form.hireDate'),
			employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : null,
		],
		[
			t('hr:list.companyLevel'),
			employee.organizationId === null ? t('hr:list.companyLevel') : null,
		],
	];

	return (
		<div className='mx-auto max-w-4xl space-y-4 p-4'>
			<div className='flex items-start justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold'>{employee.fullName}</h1>
					<p className='text-muted-foreground font-mono text-sm'>
						{employee.employeeCode}
					</p>
				</div>
				<div className='flex items-center gap-2'>
				{canUpdate && (
					<Button
						variant='outline'
						size='sm'
						render={<Link to='/hr/employees/$employeeId/edit' params={{ employeeId: employee.id }} />}
					>
						{t('hr:detail.edit')}
					</Button>
				)}
				<Badge
					variant={
						employee.employmentStatus === 'active'
							? 'default'
							: employee.employmentStatus === 'inactive'
								? 'secondary'
								: 'destructive'
					}
				>
					{t(`hr:status.${employee.employmentStatus}`)}
				</Badge>
				</div>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>{t('hr:detail.details')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-2 text-sm'>
					<div className='grid grid-cols-[160px_1fr] gap-2'>
						{rows.map(([label, value]) => (
							<div key={label} className='contents'>
								<span className='text-muted-foreground'>{label}</span>
								<span>{value || '—'}</span>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
			<EmployeeRecordCards employeeId={employee.id} fullName={employee.fullName} />
			{canArchive && (
				<Button
					variant='destructive'
					disabled={archive.isPending}
					onClick={async () => {
						if (
							await confirm({
								title: t('hr:list.archiveConfirm', { name: employee.fullName }),
								description: t('hr:list.archiveConfirmDescription'),
								confirmLabel: t('hr:list.archive'),
								destructive: true,
							})
						) {
							archive.mutate();
						}
					}}
				>
					{t('hr:list.archive')}
				</Button>
			)}
		</div>
	);
}
