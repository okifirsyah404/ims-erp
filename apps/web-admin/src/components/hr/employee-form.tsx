import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { minorToRupiah, rupiahToMinor } from '@/lib/format';
import type { TEmployee, TEmployeeInput } from '@/lib/hr-api';

/**
 * The employee form (new and edit). NIK and the base salary are only
 * editable for callers who may see them (`canReadPrivate`).
 */
export function EmployeeForm({
	initial,
	canReadPrivate,
	submitLabel,
	onSubmit,
	onCancel,
}: {
	initial?: TEmployee;
	canReadPrivate: boolean;
	submitLabel: string;
	onSubmit: (input: TEmployeeInput) => Promise<void>;
	onCancel: () => void;
}) {
	const { t } = useTranslation(['hr', 'common']);
	const [fullName, setFullName] = useState(initial?.fullName ?? '');
	const [nationalId, setNationalId] = useState(initial?.nationalId ?? '');
	const [position, setPosition] = useState(initial?.position ?? '');
	const [email, setEmail] = useState(initial?.email ?? '');
	const [phone, setPhone] = useState(initial?.phone ?? '');
	const [hireDate, setHireDate] = useState(initial?.hireDate ?? '');
	const [baseSalary, setBaseSalary] = useState(initial?.baseSalary != null ? minorToRupiah(initial.baseSalary) : '');
	const [userId, setUserId] = useState(initial?.userId ?? '');
	const [notes, setNotes] = useState(initial?.notes ?? '');
	const [busy, setBusy] = useState(false);

	return (
		<form
			onSubmit={async (event) => {
				event.preventDefault();
				setBusy(true);
				try {
					await onSubmit({
						fullName: fullName.trim(),
						nationalId: nationalId.trim() || null,
						position: position.trim() || null,
						email: email.trim() || null,
						phone: phone.trim() || null,
						hireDate: hireDate || null,
						baseSalary: canReadPrivate ? rupiahToMinor(baseSalary) : 0,
						userId: userId.trim() || null,
						notes: notes.trim() || null,
					});
				} finally {
					setBusy(false);
				}
			}}
		>
			<Card>
				<CardContent className='pt-6'>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='employee-name'>{t('hr:field.name')}</FieldLabel>
							<Input id='employee-name' required maxLength={200} value={fullName} onChange={(event) => setFullName(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='employee-position'>{t('hr:field.position')}</FieldLabel>
							<Input id='employee-position' maxLength={200} value={position} onChange={(event) => setPosition(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='employee-nik'>{t('hr:field.nik')}</FieldLabel>
							<Input
								id='employee-nik'
								inputMode='numeric'
								pattern='\d{16}'
								maxLength={16}
								disabled={!canReadPrivate}
								value={nationalId}
								onChange={(event) => setNationalId(event.target.value.replace(/\D/g, ''))}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='employee-hire'>{t('hr:field.hireDate')}</FieldLabel>
							<Input id='employee-hire' type='date' value={hireDate} onChange={(event) => setHireDate(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='employee-email'>{t('hr:field.email')}</FieldLabel>
							<Input id='employee-email' type='email' maxLength={200} value={email} onChange={(event) => setEmail(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='employee-phone'>{t('hr:field.phone')}</FieldLabel>
							<Input id='employee-phone' type='tel' maxLength={32} value={phone} onChange={(event) => setPhone(event.target.value)} />
						</Field>
						{canReadPrivate && (
							<Field>
								<FieldLabel htmlFor='employee-salary'>{t('hr:field.baseSalaryRp')}</FieldLabel>
								<Input
									id='employee-salary'
									type='number'
									min='0'
									step='0.01'
									inputMode='decimal'
									value={baseSalary}
									onChange={(event) => setBaseSalary(event.target.value)}
								/>
							</Field>
						)}
						<Field>
							<FieldLabel htmlFor='employee-login'>{t('hr:field.login')}</FieldLabel>
							<Input id='employee-login' maxLength={64} value={userId} onChange={(event) => setUserId(event.target.value)} />
							<FieldDescription>{t('hr:field.loginHint')}</FieldDescription>
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='employee-notes'>{t('hr:field.notes')}</FieldLabel>
							<Textarea id='employee-notes' rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>
			<div className='mt-6 flex justify-end gap-2'>
				<Button type='button' variant='outline' onClick={onCancel}>
					{t('common:action.cancel')}
				</Button>
				<Button type='submit' disabled={busy || !fullName.trim()}>
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}
