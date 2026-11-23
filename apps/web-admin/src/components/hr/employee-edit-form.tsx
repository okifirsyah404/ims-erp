import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Input } from '@ims-erp/ui/components/input';
import { Label } from '@ims-erp/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { toast } from '@/components/toast';
import {
	EMPLOYMENT_STATUSES,
	EMPLOYMENT_TYPES,
	type TEmployee,
	type TEmploymentStatus,
	type TEmploymentType,
	type TWorkType,
	updateEmployee,
	WORK_TYPES,
} from '@/lib/hr-api';

/**
 * The employee API returns hire/termination dates as Jakarta midnight
 * instants; the form edits them as `YYYY-MM-DD` business dates.
 */
function toBusinessDate(value: string | null): string {
	if (!value) return '';
	return new Date(Date.parse(value) + 7 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Edits the mutable fields of an employee (`PATCH /human-resources/employees/:id`).
 *
 * @remarks
 * The login email belongs to the invitation and is not edited here; gender,
 * birth data and marital status live on the user account (ERP-0034).
 */
export function EmployeeEditForm({ employee }: { employee: TEmployee }) {
	const { t } = useTranslation(['hr', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [employeeCode, setEmployeeCode] = useState(employee.employeeCode);
	const [fullName, setFullName] = useState(employee.fullName);
	const [legalName, setLegalName] = useState(employee.legalName ?? '');
	const [nickname, setNickname] = useState(employee.nickname ?? '');
	const [phone, setPhone] = useState(employee.phone ?? '');
	const [whatsapp, setWhatsapp] = useState(employee.whatsapp ?? '');
	const [nationalId, setNationalId] = useState(employee.nationalId ?? '');
	const [employmentStatus, setEmploymentStatus] = useState<TEmploymentStatus>(employee.employmentStatus);
	const [employmentType, setEmploymentType] = useState<TEmploymentType>(employee.employmentType);
	const [workType, setWorkType] = useState<TWorkType>(employee.workType);
	const [hireDate, setHireDate] = useState(toBusinessDate(employee.hireDate));
	const [terminationDate, setTerminationDate] = useState(toBusinessDate(employee.terminationDate));

	const back = () => void navigate({ to: '/hr/employees/$employeeId', params: { employeeId: employee.id } });

	const save = useMutation({
		mutationFn: () =>
			updateEmployee(employee.id, {
				employeeCode: employeeCode.trim() || null,
				fullName: fullName.trim(),
				legalName: legalName.trim() || null,
				nickname: nickname.trim() || null,
				phone: phone.trim() || null,
				whatsapp: whatsapp.trim() || null,
				nationalId: nationalId.trim() || null,
				employmentStatus,
				employmentType,
				workType,
				hireDate: hireDate || null,
				terminationDate: terminationDate || null,
			}),
		onSuccess: async () => {
			toast.success(t('hr:form.saved'));
			await queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
			back();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const text = (id: string, label: string, value: string, set: (value: string) => void, required = false) => (
		<div className='space-y-2'>
			<Label htmlFor={id}>{label}</Label>
			<Input id={id} value={value} required={required} onChange={(event) => set(event.target.value)} />
		</div>
	);

	return (
		<form
			className='space-y-4 p-6'
			onSubmit={(event) => {
				event.preventDefault();
				save.mutate();
			}}
		>
			<div>
				<h1 className='text-xl font-semibold'>{t('hr:form.editEmployee')}</h1>
				<p className='text-muted-foreground font-mono text-sm'>{employee.employeeCode}</p>
			</div>
			<div className='grid gap-4 lg:grid-cols-2'>
			<Card>
				<CardHeader>
					<CardTitle>{t('hr:form.identity')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-4 sm:grid-cols-2'>
					{text('employeeCode', t('hr:form.employeeCode'), employeeCode, setEmployeeCode)}
					{text('fullName', t('hr:form.fullName'), fullName, setFullName, true)}
					{text('legalName', t('hr:form.legalName'), legalName, setLegalName)}
					{text('nickname', t('hr:form.nickname'), nickname, setNickname)}
					{text('nationalId', t('hr:form.nationalId'), nationalId, setNationalId)}
					{text('phone', t('hr:form.phone'), phone, setPhone)}
					{text('whatsapp', t('hr:form.whatsapp'), whatsapp, setWhatsapp)}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>{t('hr:form.employment')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-4 sm:grid-cols-2'>
					<div className='space-y-2'>
						<Label>{t('hr:form.employmentStatus')}</Label>
						<Select
							value={employmentStatus}
							onValueChange={(value: string | null) => setEmploymentStatus((value ?? 'active') as TEmploymentStatus)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EMPLOYMENT_STATUSES.map((value) => (
									<SelectItem key={value} value={value}>
										{t(`hr:status.${value}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className='space-y-2'>
						<Label>{t('hr:form.employmentType')}</Label>
						<Select
							value={employmentType}
							onValueChange={(value: string | null) => setEmploymentType((value ?? 'permanent') as TEmploymentType)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EMPLOYMENT_TYPES.map((value) => (
									<SelectItem key={value} value={value}>
										{t(`hr:employmentType.${value}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className='space-y-2'>
						<Label>{t('hr:form.workType')}</Label>
						<Select value={workType} onValueChange={(value: string | null) => setWorkType((value ?? 'onsite') as TWorkType)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{WORK_TYPES.map((value) => (
									<SelectItem key={value} value={value}>
										{t(`hr:workType.${value}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className='space-y-2'>
						<Label htmlFor='hireDate'>{t('hr:form.hireDate')}</Label>
						<DatePicker id='hireDate' value={hireDate} onChange={setHireDate} />
					</div>
					<div className='space-y-2'>
						<Label htmlFor='terminationDate'>{t('hr:form.terminationDate')}</Label>
						<DatePicker id='terminationDate' value={terminationDate} onChange={setTerminationDate} />
					</div>
				</CardContent>
			</Card>
			</div>
			<div className='flex gap-2'>
				<Button type='submit' disabled={save.isPending || !fullName.trim()}>
					{t('hr:form.save')}
				</Button>
				<Button type='button' variant='ghost' onClick={back}>
					{t('hr:form.cancel')}
				</Button>
			</div>
		</form>
	);
}
