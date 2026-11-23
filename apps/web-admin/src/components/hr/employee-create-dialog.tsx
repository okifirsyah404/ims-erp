import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { CountryPhoneField } from '@/components/form/country-phone-field';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import { createEmployee, EMPLOYMENT_TYPES, type TEmploymentType, type TWorkType, WORK_TYPES } from '@/lib/hr-api';
import { useActiveOrganizationId } from '@/lib/use-active-organization';

/**
 * Invite-first employee creation in a dialog on the employee list (ERP-0034;
 * the former `/hr/employees/new` page, replaced on owner request).
 *
 * @remarks
 * One submit creates the invitation (the email becomes the login) and the
 * employee record, which also opens the draft employment agreement
 * (ERP-0121). The employee code is reserved server-side (EMP series). The
 * backend resolves the tenant from the request's organization context, and
 * `organizationId` in the body must match it, so the active organization is
 * sent. Mounted only while open, so every opening starts empty.
 */
export function EmployeeCreateDialog({ onClose }: { onClose: () => void }) {
	const { t } = useTranslation(['hr', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
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
				fullName: fullName.trim(),
				email: email.trim(),
				organizationId,
				phone: phone || null,
				nationalId: nationalId.trim() || null,
				employmentType,
				workType,
				hireDate: hireDate || null,
			}),
		onSuccess: async (employee) => {
			toast.success(t('hr:form.created', { code: employee.employeeCode }));
			await queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
			onClose();
			void navigate({ to: '/hr/employees/$employeeId', params: { employeeId: employee.id } });
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<ScrollDialogContent className='sm:max-w-2xl'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('hr:form.newEmployee')}</DialogTitle>
						<DialogDescription>{t('hr:form.newEmployeeDescription')}</DialogDescription>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='employee-full-name'>{t('hr:form.fullName')}</FieldLabel>
							<Input id='employee-full-name' required maxLength={200} value={fullName} onChange={(event) => setFullName(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='employee-email'>{t('hr:form.email')}</FieldLabel>
							<Input id='employee-email' type='email' required value={email} onChange={(event) => setEmail(event.target.value)} />
							<FieldDescription>{t('hr:form.emailHint')}</FieldDescription>
						</Field>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='employee-phone' optional>
									{t('hr:form.phone')}
								</FieldLabel>
								<CountryPhoneField id='employee-phone' required={false} onChange={setPhone} />
							</Field>
							<Field>
								<FieldLabel htmlFor='employee-nik' optional>
									{t('hr:form.nationalId')}
								</FieldLabel>
								<Input id='employee-nik' maxLength={32} value={nationalId} onChange={(event) => setNationalId(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='employee-type'>{t('hr:form.employmentType')}</FieldLabel>
								<Select value={employmentType} onValueChange={(value: string | null) => setEmploymentType((value ?? 'permanent') as TEmploymentType)}>
									<SelectTrigger id='employee-type' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{EMPLOYMENT_TYPES.map((type) => (
											<SelectItem key={type} value={type}>
												{t(`hr:employmentType.${type}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor='employee-work-type'>{t('hr:form.workType')}</FieldLabel>
								<Select value={workType} onValueChange={(value: string | null) => setWorkType((value ?? 'onsite') as TWorkType)}>
									<SelectTrigger id='employee-work-type' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{WORK_TYPES.map((type) => (
											<SelectItem key={type} value={type}>
												{t(`hr:workType.${type}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor='employee-hire-date' optional>
									{t('hr:form.hireDate')}
								</FieldLabel>
								<DatePicker id='employee-hire-date' value={hireDate} onChange={setHireDate} />
							</Field>
						</div>
					</FieldGroup>
					<DialogFooter className='pb-4'>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('hr:form.cancel')}
						</Button>
						<Button type='submit' disabled={save.isPending || !fullName.trim() || !email.trim()}>
							{t('hr:form.inviteAndCreate')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
