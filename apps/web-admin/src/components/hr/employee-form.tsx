import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Input } from '@ims-erp/ui/components/input';
import { Label } from '@ims-erp/ui/components/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { toast } from '@/components/toast';
import {
	createEmployee,
	EMPLOYMENT_TYPES,
	type TEmploymentType,
	type TWorkType,
	WORK_TYPES,
} from '@/lib/hr-api';
import { useActiveOrganizationId } from '@/lib/use-active-organization';
import { CountryPhoneField } from '@/components/form/country-phone-field';

/**
 * Invite-first employee creation form (ERP-0034).
 *
 * @remarks
 * One form creates both the invitation (email → the user module's pipeline
 * pre-creates the login) and the employee record. The employee code is
 * reserved server-side (EMP series) unless overridden.
 */
export function EmployeeForm() {
	const { t } = useTranslation('hr');
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	// The backend resolves the employee's tenant from the request's
	// organization context, and `organizationId` in the body must match it: an
	// org-scoped caller without one is rejected as a company-level creation
	// (`CompanyEmployeeForbiddenError`). The form used to omit it entirely, so
	// every organization HR user hit a 403 here.
	const organizationId = useActiveOrganizationId();

	const [fullName, setFullName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [nationalId, setNationalId] = useState('');
	const [employmentType, setEmploymentType] = useState<TEmploymentType>('permanent');
	const [workType, setWorkType] = useState<TWorkType>('onsite');
	const [hireDate, setHireDate] = useState('');

	const save = useMutation({
		mutationFn: () =>
			createEmployee({
				fullName,
				email,
				organizationId,
				phone: phone || null,
				nationalId: nationalId || null,
				employmentType,
				workType,
				hireDate: hireDate || null,
			}),
		onSuccess: async (employee) => {
			toast.success(t('form.created', { code: employee.employeeCode }));
			await queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
			void navigate({
				to: '/hr/employees/$employeeId',
				params: { employeeId: employee.id },
			});
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	return (
		<div className='mx-auto max-w-xl space-y-4 p-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('form.newEmployee')}</h1>
				<p className='text-muted-foreground text-sm'>
					{t('form.newEmployeeDescription')}
				</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>{t('form.identity')}</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4'>
					<div className='space-y-2'>
						<Label htmlFor='fullName'>{t('form.fullName')}</Label>
						<Input
							id='fullName'
							value={fullName}
							onChange={(event) => setFullName(event.target.value)}
							required
						/>
					</div>
					<div className='space-y-2'>
						<Label htmlFor='email'>{t('form.email')}</Label>
						<Input
							id='email'
							type='email'
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
						/>
						<p className='text-muted-foreground text-xs'>
							{t('form.emailHint')}
						</p>
					</div>
					<div className='grid gap-4 sm:grid-cols-2'>
						<div className='space-y-2'>
							<Label htmlFor='phone'>{t('form.phone')}</Label>
							<CountryPhoneField id='phone' required={false} onChange={setPhone} />
						</div>
						<div className='space-y-2'>
							<Label htmlFor='nationalId'>{t('form.nationalId')}</Label>
							<Input
								id='nationalId'
								value={nationalId}
								onChange={(event) => setNationalId(event.target.value)}
							/>
						</div>
						<div className='space-y-2'>
							<Label>{t('form.employmentType')}</Label>
							<Select
								value={employmentType}
								onValueChange={(value: string | null) =>
									setEmploymentType((value ?? 'permanent') as TEmploymentType)
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{EMPLOYMENT_TYPES.map((type) => (
										<SelectItem key={type} value={type}>
											{t(`employmentType.${type}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className='space-y-2'>
							<Label>{t('form.workType')}</Label>
							<Select
								value={workType}
								onValueChange={(value: string | null) =>
									setWorkType((value ?? 'onsite') as TWorkType)
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{WORK_TYPES.map((type) => (
										<SelectItem key={type} value={type}>
											{t(`workType.${type}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='hireDate'>{t('form.hireDate')}</Label>
							<DatePicker
								id='hireDate'
								value={hireDate}
								onChange={setHireDate}
							/>
						</div>
					</div>
				</CardContent>
			</Card>
			<div className='flex gap-2'>
				<Button
					disabled={save.isPending || !fullName || !email}
					onClick={() => save.mutate()}
				>
					{t('form.inviteAndCreate')}
				</Button>
				<Button variant='ghost' onClick={() => void navigate({ to: '/hr/employees' })}>
					{t('form.cancel')}
				</Button>
			</div>
		</div>
	);
}
