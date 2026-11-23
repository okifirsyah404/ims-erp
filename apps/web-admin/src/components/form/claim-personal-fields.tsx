import { useTranslation } from 'react-i18next';

import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { LocationCascade } from '@/components/inventory/location-cascade';
import { CLAIM_GENDERS, CLAIM_MARITAL_STATUSES, type TClaimPersonalData } from '@/lib/claim-api';
import type { TClaimPersonalDraft } from '@/lib/claim-personal';

/**
 * The personal-data part of the claim form (ERP-0121, grill-me Q19): NIK,
 * birth place and date, gender and residence address are required; marital
 * status is optional. The location endpoints are public, so the cascade works
 * before the invitee has a session.
 */
export function ClaimPersonalFields({ value, onChange }: { value: TClaimPersonalDraft; onChange: (next: TClaimPersonalDraft) => void }) {
	const { t } = useTranslation('claim');
	const set = (patch: Partial<TClaimPersonalDraft>) => onChange({ ...value, ...patch });

	return (
		<FieldSet>
			<FieldLegend>{t('personal.title')}</FieldLegend>
			<FieldDescription>{t('personal.description')}</FieldDescription>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor='claim-nik'>{t('personal.nationalId')}</FieldLabel>
					<Input
						id='claim-nik'
						required
						inputMode='numeric'
						maxLength={16}
						value={value.nationalId}
						onChange={(event) => set({ nationalId: event.target.value.replace(/\D/g, '') })}
					/>
				</Field>
				<div className='grid gap-4 sm:grid-cols-2'>
					<Field>
						<FieldLabel htmlFor='claim-birth-place'>{t('personal.birthPlace')}</FieldLabel>
						<Input id='claim-birth-place' required maxLength={200} value={value.birthPlace} onChange={(event) => set({ birthPlace: event.target.value })} />
					</Field>
					<Field>
						<FieldLabel htmlFor='claim-birth-date'>{t('personal.birthDate')}</FieldLabel>
						<DatePicker id='claim-birth-date' required value={value.birthDate} onChange={(birthDate) => set({ birthDate })} />
					</Field>
					<Field>
						<FieldLabel htmlFor='claim-gender'>{t('personal.gender')}</FieldLabel>
						<Select value={value.gender ?? ''} onValueChange={(next: string | null) => set({ gender: (next || null) as TClaimPersonalDraft['gender'] })}>
							<SelectTrigger id='claim-gender' className='w-full'>
								<SelectValue placeholder={t('personal.choose')} />
							</SelectTrigger>
							<SelectContent>
								{CLAIM_GENDERS.map((gender) => (
									<SelectItem key={gender} value={gender}>
										{t(`personal.genderOption.${gender}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor='claim-marital'>
							{t('personal.maritalStatus')} <span className='text-muted-foreground'>({t('personal.optional')})</span>
						</FieldLabel>
						<Select
							value={value.maritalStatus ?? 'none'}
							onValueChange={(next: string | null) => set({ maritalStatus: next && next !== 'none' ? (next as TClaimPersonalData['maritalStatus']) : null })}
						>
							<SelectTrigger id='claim-marital' className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='none'>—</SelectItem>
								{CLAIM_MARITAL_STATUSES.map((status) => (
									<SelectItem key={status} value={status}>
										{t(`personal.maritalOption.${status}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor='claim-address'>{t('personal.address')}</FieldLabel>
					<Textarea id='claim-address' required rows={2} maxLength={500} value={value.addressLine} onChange={(event) => set({ addressLine: event.target.value })} />
				</Field>
				<LocationCascade value={value.location} onChange={(location) => set({ location })} />
				<Field>
					<FieldLabel htmlFor='claim-postal'>{t('personal.postalCode')}</FieldLabel>
					<Input
						id='claim-postal'
						required
						className='w-32'
						inputMode='numeric'
						maxLength={5}
						value={value.postalCode}
						onChange={(event) => set({ postalCode: event.target.value.replace(/\D/g, '') })}
					/>
				</Field>
			</FieldGroup>
		</FieldSet>
	);
}
