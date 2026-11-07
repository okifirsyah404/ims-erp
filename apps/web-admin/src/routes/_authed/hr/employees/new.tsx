import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { EmployeeForm } from '@/components/hr/employee-form';
import { toast } from '@/components/toast';
import { createEmployee } from '@/lib/hr-api';
import { usePermission } from '@/lib/use-permission';

/** `/hr/employees/new` — add an employee (numbered EMP-####). */
export const Route = createFileRoute('/_authed/hr/employees/new')({
	component: NewEmployeePage,
});

function NewEmployeePage() {
	const { t } = useTranslation(['hr', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const canReadPrivate = usePermission('employee.read_private');

	return (
		<div className='flex flex-col gap-6 p-6'>
			<h1 className='text-2xl font-bold'>{t('hr:employees.new')}</h1>
			<EmployeeForm
				canReadPrivate={canReadPrivate}
				submitLabel={t('hr:employees.submit')}
				onCancel={() => void navigate({ to: '/hr/employees' })}
				onSubmit={async (input) => {
					try {
						const created = await createEmployee(input);
						await queryClient.invalidateQueries({ queryKey: ['hr'] });
						toast.success(t('hr:employees.created'));
						void navigate({ to: '/hr/employees/$employeeId', params: { employeeId: created.id } });
					} catch (cause) {
						toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
					}
				}}
			/>
		</div>
	);
}
