import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { erpRoleLabel } from '@ims-erp/common';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Input } from '@ims-erp/ui/components/input';
import { Label } from '@ims-erp/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { toast } from '@/components/toast';
import { CountryPhoneField } from '@/components/form/country-phone-field';
import {
	EMPLOYMENT_STATUSES,
	EMPLOYMENT_TYPES,
	type TEmployee,
	type TEmploymentStatus,
	type TEmploymentType,
	type TWorkType,
	updateEmployee,
	WORK_TYPES,
	PTKP_STATUSES,
	type TPtkpStatus,
} from '@/lib/hr-api';
import { organizationMembersQueryOptions, updateMemberRole } from '@/lib/organization-api';
import { useAssignableOrgRoles } from '@/lib/use-caller-org-roles';
import { usePermission } from '@/lib/use-permission';

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
/** Select value for "no PTKP status" (Base UI selects need a non-empty value). */
const NO_PTKP = 'none';

export function EmployeeEditForm({ employee }: { employee: TEmployee }) {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [employeeCode, setEmployeeCode] = useState(employee.employeeCode);
	const [fullName, setFullName] = useState(employee.fullName);
	const [nickname, setNickname] = useState(employee.nickname ?? '');
	const [phone, setPhone] = useState(employee.phone ?? '');
	const [nationalId, setNationalId] = useState(employee.nationalId ?? '');
	const [taxId, setTaxId] = useState(employee.taxId ?? '');
	const [ptkpStatus, setPtkpStatus] = useState<string>(employee.ptkpStatus ?? NO_PTKP);
	const [bpjsHealthNumber, setBpjsHealthNumber] = useState(employee.bpjsHealthNumber ?? '');
	const [bpjsEmploymentNumber, setBpjsEmploymentNumber] = useState(employee.bpjsEmploymentNumber ?? '');
	const [employmentStatus, setEmploymentStatus] = useState<TEmploymentStatus>(employee.employmentStatus);
	const [employmentType, setEmploymentType] = useState<TEmploymentType>(employee.employmentType);
	const [workType, setWorkType] = useState<TWorkType>(employee.workType);
	const [hireDate, setHireDate] = useState(toBusinessDate(employee.hireDate));
	const [terminationDate, setTerminationDate] = useState(toBusinessDate(employee.terminationDate));

	const back = () => void navigate({ to: '/hr/employees/$employeeId', params: { employeeId: employee.id } });

	// The organization role is a membership fact, not an employee column, so it
	// is saved through the organization member endpoint (the same one the
	// organization member page uses) rather than `PATCH /human-resources/...`.
	// A pending invite has no membership row yet: the roles land on claim.
	//
	// The card always renders (the roles are worth seeing even without the
	// grant), but only a caller holding `member.update` can change them. UX
	// only: the backend re-checks every assignment.
	const organizationId = employee.organizationId;
	const canUpdateRoles = usePermission('member.update');
	const members = useQuery({
		...organizationMembersQueryOptions(organizationId ?? '', 1, 100),
		enabled: Boolean(organizationId && employee.userId),
	});
	const member = members.data?.rows.find((row) => row.userId === employee.userId);
	const currentRoles = (member?.role ?? '')
		.split(',')
		.map((role) => role.trim())
		.filter(Boolean);
	const { roles: assignableRoles } = useAssignableOrgRoles(organizationId, currentRoles);
	// `null` until the user edits: the member query is async, so the saved role
	// is derived at render, not copied in an effect.
	const [role, setRole] = useState<string | null>(null);
	// One role in the dropdown, like `/admin/users` (the invite dialog). A
	// member that already holds several keeps the first until the user picks.
	const chosen = role ?? currentRoles[0] ?? 'member';
	const effectiveRole = assignableRoles.includes(chosen as never)
		? chosen
		: assignableRoles.includes('member')
			? 'member'
			: (assignableRoles[0] ?? 'member');
	const hiddenRoles = currentRoles.filter((roleName) => !assignableRoles.includes(roleName as never));

	const saveRoles = useMutation({
		mutationFn: () => {
			if (!organizationId || !member) throw new Error('No organization membership');
			// Single-role dropdown: the save replaces the whole comma-joined set.
			return updateMemberRole(organizationId, member.id, [effectiveRole]);
		},
		onSuccess: async () => {
			toast.success(t('hr:form.saved'));
			await queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const save = useMutation({
		mutationFn: () =>
			updateEmployee(employee.id, {
				employeeCode: employeeCode.trim() || null,
				fullName: fullName.trim(),
				nickname: nickname.trim() || null,
				phone: phone || null,
				nationalId: nationalId.trim() || null,
				taxId: taxId.trim() || null,
				ptkpStatus: ptkpStatus === NO_PTKP ? null : (ptkpStatus as TPtkpStatus),
				bpjsHealthNumber: bpjsHealthNumber.trim() || null,
				bpjsEmploymentNumber: bpjsEmploymentNumber.trim() || null,
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
					{text('nickname', t('hr:form.nickname'), nickname, setNickname)}
					{text('nationalId', t('hr:form.nationalId'), nationalId, setNationalId)}
					<div className='space-y-2 sm:col-span-2'>
						<Label htmlFor='phone'>{t('hr:form.phone')}</Label>
						<CountryPhoneField id='phone' defaultValue={employee.phone} required={false} onChange={setPhone} />
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>{t('hr:form.employment')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-4 sm:grid-cols-2'>
					<div className='space-y-2'>
						<Label htmlFor='employmentStatus'>{t('hr:form.employmentStatus')}</Label>
						<Select
							value={employmentStatus}
							onValueChange={(value: string | null) => setEmploymentStatus((value ?? 'active') as TEmploymentStatus)}
						>
							<SelectTrigger id='employmentStatus' className='w-full'>
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
						<Label htmlFor='employmentType'>{t('hr:form.employmentType')}</Label>
						<Select
							value={employmentType}
							onValueChange={(value: string | null) => setEmploymentType((value ?? 'permanent') as TEmploymentType)}
						>
							<SelectTrigger id='employmentType' className='w-full'>
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
						<Label htmlFor='workType'>{t('hr:form.workType')}</Label>
						<Select value={workType} onValueChange={(value: string | null) => setWorkType((value ?? 'onsite') as TWorkType)}>
							<SelectTrigger id='workType' className='w-full'>
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
					{/* Organization role sits with the other employment fields (a
					    membership fact, saved through the organization member
					    endpoint); only the write controls are gated. */}
					<div className='space-y-2'>
						<Label htmlFor='employee-role'>{t('hr:form.role')}</Label>
						{member ? (
							<Select
								value={effectiveRole}
								disabled={!canUpdateRoles}
								onValueChange={(value: string | null) => setRole(value ?? 'member')}
							>
								<SelectTrigger id='employee-role' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{assignableRoles.map((roleName) => (
										<SelectItem key={roleName} value={roleName}>
											{erpRoleLabel(roleName, i18n.language)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<p className='text-sm text-muted-foreground'>{t('hr:form.roleNoMember')}</p>
						)}
					</div>
					<div className='space-y-2'>
						<Label htmlFor='hireDate'>{t('hr:form.hireDate')}</Label>
						<DatePicker id='hireDate' value={hireDate} onChange={setHireDate} />
					</div>
					<div className='space-y-2'>
						<Label htmlFor='terminationDate'>{t('hr:form.terminationDate')}</Label>
						<DatePicker id='terminationDate' value={terminationDate} onChange={setTerminationDate} />
					</div>
					{member && (
						<div className='flex flex-wrap items-center gap-2 sm:col-span-2'>
							<p className='text-xs text-muted-foreground'>
								{canUpdateRoles ? t('hr:form.roleHint') : t('hr:form.roleReadOnly')}
								{hiddenRoles.length > 0 &&
									` ${t('hr:form.rolesLocked', {
										roles: hiddenRoles.map((roleName) => erpRoleLabel(roleName, i18n.language)).join(', '),
									})}`}
								{currentRoles.length > 1 && ` ${t('hr:form.rolesMultiple')}`}
							</p>
							{canUpdateRoles && (
								<Button
									type='button'
									size='sm'
									variant='outline'
									className='ml-auto'
									disabled={saveRoles.isPending || effectiveRole === member.role}
									onClick={() => saveRoles.mutate()}
								>
									{t('hr:form.saveRole')}
								</Button>
							)}
						</div>
					)}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>{t('hr:form.taxBpjs')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-4 sm:grid-cols-2'>
					{text('taxId', t('hr:form.taxId'), taxId, setTaxId)}
					<div className='space-y-2'>
						<Label htmlFor='ptkpStatus'>{t('hr:form.ptkpStatus')}</Label>
						<Select value={ptkpStatus} onValueChange={(value: string | null) => setPtkpStatus(value ?? NO_PTKP)}>
							<SelectTrigger id='ptkpStatus' className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_PTKP}>{t('hr:form.ptkpNone')}</SelectItem>
								{PTKP_STATUSES.map((value) => (
									<SelectItem key={value} value={value}>
										{value}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{text('bpjsHealthNumber', t('hr:form.bpjsHealthNumber'), bpjsHealthNumber, setBpjsHealthNumber)}
					{text('bpjsEmploymentNumber', t('hr:form.bpjsEmploymentNumber'), bpjsEmploymentNumber, setBpjsEmploymentNumber)}
					<p className='text-xs text-muted-foreground sm:col-span-2'>{t('hr:form.taxBpjsHint')}</p>
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
