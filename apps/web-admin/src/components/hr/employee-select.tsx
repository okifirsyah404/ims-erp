import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { activeEmployeesQueryOptions } from '@/lib/hr-records-api';

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
		<Select
			required={required}
			value={value === '' ? 'none' : value}
			onValueChange={(next: string | null) =>
				onChange(next == null || next === 'none' ? '' : next)
			}
		>
			<SelectTrigger id={id} className={className ?? 'w-full'} aria-label={t('field.employee')}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value='none'>{allowAll ?? t('pick.employee')}</SelectItem>
				{(data ?? []).map((employee) => (
					<SelectItem key={employee.id} value={employee.id}>
						{employee.employeeCode} — {employee.fullName}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
