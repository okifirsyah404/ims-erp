import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { EmployeeEditForm } from '@/components/hr/employee-edit-form';
import { employeeDetailQueryOptions } from '@/lib/hr-api';

/** `/hr/employees/$employeeId/edit` — edits an employee (`employee:update`, enforced by the backend). */
export const Route = createFileRoute('/_authed/hr/employees/$employeeId_/edit')({
	component: EmployeeEditPage,
});

function EmployeeEditPage() {
	const { t } = useTranslation('hr');
	const { employeeId } = Route.useParams();
	const { data: employee, isPending } = useQuery({ ...employeeDetailQueryOptions(employeeId), retry: false });

	if (isPending) {
		return (
			<div className='mx-auto max-w-2xl space-y-4 p-4'>
				<Skeleton className='h-8 w-48' />
				<Skeleton className='h-64' />
			</div>
		);
	}
	if (!employee) return <div className='p-4 text-sm text-muted-foreground'>{t('detail.notFound')}</div>;
	// Keyed so a refetch with another id remounts the form with fresh state.
	return <EmployeeEditForm key={employee.id} employee={employee} />;
}
