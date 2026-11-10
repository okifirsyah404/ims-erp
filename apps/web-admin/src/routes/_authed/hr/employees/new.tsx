import { createFileRoute } from '@tanstack/react-router';

import { EmployeeForm } from '@/components/hr/employee-form';
import { usePermission } from '@/lib/use-permission';

/** `/hr/employees/new` — invite-first employee creation (ERP-0034). */
export const Route = createFileRoute('/_authed/hr/employees/new')({
	component: NewEmployeePage,
});

function NewEmployeePage() {
	const canCreate = usePermission('employee.create');
	if (!canCreate) {
		void window.history.back();
		return null;
	}
	return <EmployeeForm />;
}
