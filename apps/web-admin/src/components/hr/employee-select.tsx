import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { activeEmployeesQueryOptions } from '@/lib/hr-records-api';

const select = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm';

/** Picks an active employee (`EMP-0001 — Name`). */
export function EmployeeSelect({
	id,
	value,
	onChange,
	required,
	allowAll,
	className,
}: {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	required?: boolean;
	/** Adds an empty "all" choice with this label (filters). */
	allowAll?: string;
	className?: string;
}) {
	const { t } = useTranslation('hr');
	const { data } = useQuery(activeEmployeesQueryOptions());
	return (
		<select
			id={id}
			required={required}
			aria-label={t('field.employee')}
			className={className ?? select}
			value={value}
			onChange={(event) => onChange(event.target.value)}
		>
			<option value=''>{allowAll ?? t('pick.employee')}</option>
			{(data ?? []).map((employee) => (
				<option key={employee.id} value={employee.id}>
					{employee.employeeCode} — {employee.fullName}
				</option>
			))}
		</select>
	);
}
