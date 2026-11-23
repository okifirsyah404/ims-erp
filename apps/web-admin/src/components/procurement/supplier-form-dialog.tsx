import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	Dialog,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Separator } from '@ims-erp/ui/components/separator';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { CountryPhoneField } from '@/components/form/country-phone-field';
import {
	EMPTY_LOCATION_SELECTION,
	LocationCascade,
	type TLocationSelection,
} from '@/components/inventory/location-cascade';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import {
	SUPPLIER_TYPES,
	type TSupplierCompanyAddress,
	type TSupplierCompanyAddressInput,
	type TSupplierCompanyDetail,
	type TSupplierCompanyInput,
	type TSupplierType,
} from '@/lib/supplier-api';

type TTextField =
	| 'code'
	| 'name'
	| 'legalName'
	| 'taxId'
	| 'email'
	| 'phone'
	| 'website'
	| 'bankName'
	| 'bankAccountNumber'
	| 'bankAccountHolder'
	| 'notes';

const TEXT_KEYS: TTextField[] = [
	'code', 'name', 'legalName', 'taxId', 'email', 'phone', 'website',
	'bankName', 'bankAccountNumber', 'bankAccountHolder', 'notes',
];

const COMPANY_ADDRESS_KINDS = ['office', 'factory', 'warehouse', 'billing', 'other'] as const;

/** Address picked in the form: `id` is the existing row when editing. */
export type TSupplierAddressDraft = {
	id: string | null;
	values: TSupplierCompanyAddressInput;
};

/** One titled form section (the warehouse form's `FormSection` pattern). */
function FormSection({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<section className='flex flex-col gap-3'>
			<div>
				<h3 className='text-sm font-medium'>{title}</h3>
				<p className='text-xs text-muted-foreground'>{description}</p>
			</div>
			<div className='grid gap-4 sm:grid-cols-2'>{children}</div>
		</section>
	);
}

/**
 * Create/edit dialog for a supplier company, grouped like the warehouse form.
 *
 * @remarks
 * Bank fields are only shown to callers holding `supplier:read_bank` (UX only;
 * the server is authoritative) and are not sent otherwise, so nothing is
 * blanked. The address section edits the primary (else first) company address
 * inline, like the warehouse form: the caller persists it through the address
 * endpoints after the company write, because addresses are a collection.
 * WhatsApp and payment terms are gone (ERP-0114).
 */
export function SupplierFormDialog({
	supplier,
	canSeeBank,
	submitting,
	onClose,
	onSave,
}: {
	supplier: TSupplierCompanyDetail | null;
	canSeeBank: boolean;
	submitting: boolean;
	onClose: () => void;
	/** `address` is `null` when the section was left empty. */
	onSave: (
		input: Partial<TSupplierCompanyInput>,
		address: TSupplierAddressDraft | null,
	) => void;
}) {
	const { t } = useTranslation(['procurement', 'common']);
	const [supplierType, setSupplierType] = useState<TSupplierType>(supplier?.supplierType ?? 'company');
	const [values, setValues] = useState<Record<TTextField, string>>(
		() => Object.fromEntries(TEXT_KEYS.map((key) => [key, supplier?.[key] ?? ''])) as Record<TTextField, string>,
	);

	// The address section edits one address: the primary, else the first.
	const existingAddress: TSupplierCompanyAddress | null =
		supplier?.addresses.find((row) => row.isPrimary) ?? supplier?.addresses[0] ?? null;
	const [addressKind, setAddressKind] = useState<TSupplierCompanyAddress['kind']>(
		existingAddress?.kind ?? 'office',
	);
	const [addressLabel, setAddressLabel] = useState(existingAddress?.label ?? '');
	const [addressLine, setAddressLine] = useState(existingAddress?.addressLine ?? '');
	const [postalCode, setPostalCode] = useState(existingAddress?.postalCode ?? '');
	const [isPrimary, setIsPrimary] = useState(existingAddress?.isPrimary ?? true);
	const [location, setLocation] = useState<TLocationSelection>(EMPTY_LOCATION_SELECTION);

	const field = (key: TTextField, props: React.ComponentProps<typeof Input> = {}, hint?: string) => (
		<Field>
			<FieldLabel htmlFor={`supplier-${key}`}>{t(`procurement:supplier.${key}`)}</FieldLabel>
			<Input
				id={`supplier-${key}`}
				value={values[key]}
				onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
				{...props}
			/>
			{hint && <FieldDescription>{hint}</FieldDescription>}
		</Field>
	);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-3xl'>
				<form
					className='flex flex-col gap-5'
					onSubmit={(event) => {
						event.preventDefault();
						const text = (value: string) => value.trim() || null;
						const input: Partial<TSupplierCompanyInput> = {
							// Empty on create: the server generates the code.
							code: values.code.trim() || undefined,
							name: values.name.trim(),
							supplierType,
						};
						for (const key of TEXT_KEYS) {
							if (key === 'code' || key === 'name') continue;
							if (!canSeeBank && key.startsWith('bank')) continue;
							(input as Record<string, unknown>)[key] = text(values[key]);
						}
						// An empty street leaves the address alone (no write at all).
						const address: TSupplierAddressDraft | null = addressLine.trim()
							? {
									id: existingAddress?.id ?? null,
									values: {
										kind: addressKind,
										label: addressLabel.trim() || null,
										contactName: existingAddress?.contactName ?? null,
										contactPhone: existingAddress?.contactPhone ?? null,
										addressLine: addressLine.trim(),
										villageId: location.villageId ?? existingAddress?.villageId ?? null,
										postalCode: postalCode.trim() || null,
										isPrimary,
									},
								}
							: null;
						onSave(input, address);
					}}
				>
					<DialogHeader>
						<DialogTitle>{supplier ? t('procurement:suppliers.edit') : t('procurement:suppliers.new')}</DialogTitle>
					</DialogHeader>
					<FormSection
						title={t('procurement:suppliers.identity')}
						description={t('procurement:suppliers.identityDescription')}
					>
						{field(
							'code',
							{ required: !!supplier, maxLength: 32, minLength: 2, pattern: '[A-Za-z0-9]+', className: 'uppercase' },
							supplier ? t('procurement:supplier.codeHint') : t('procurement:supplier.codeAutoHint'),
						)}
						<Field>
							<FieldLabel htmlFor='supplier-type'>{t('procurement:supplier.supplierType')}</FieldLabel>
							<Select
								value={supplierType}
								onValueChange={(value: string | null) => setSupplierType(value as TSupplierType)}
							>
								<SelectTrigger id='supplier-type' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SUPPLIER_TYPES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`procurement:supplierType.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						{field('name', { required: true, maxLength: 200 })}
						{field('legalName', { maxLength: 200 })}
						{field('taxId', { inputMode: 'numeric', maxLength: 16 })}
						{field('website', { type: 'url', maxLength: 200, placeholder: 'https://' })}
					</FormSection>
					<Separator />
					<FormSection
						title={t('procurement:suppliers.contact')}
						description={t('procurement:suppliers.contactDescription')}
					>
						{field('email', { type: 'email', maxLength: 254 })}
						<Field>
							<FieldLabel htmlFor='supplier-phone'>{t('procurement:supplier.phone')}</FieldLabel>
							<CountryPhoneField
								id='supplier-phone'
								defaultValue={values.phone}
								required={false}
								disabled={submitting}
								onChange={(e164) => setValues((current) => ({ ...current, phone: e164 }))}
							/>
						</Field>
						{canSeeBank && (
							<>
								{field('bankName', { maxLength: 200 })}
								{field('bankAccountNumber', { inputMode: 'numeric', maxLength: 100 })}
								{field('bankAccountHolder', { maxLength: 200 })}
							</>
						)}
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='supplier-notes'>{t('procurement:supplier.notes')}</FieldLabel>
							<Textarea
								id='supplier-notes'
								rows={2}
								maxLength={2000}
								value={values.notes}
								onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
							/>
						</Field>
					</FormSection>
					<Separator />
					<FormSection
						title={t('procurement:suppliers.address')}
						description={t('procurement:suppliers.addressDescription')}
					>
						<Field>
							<FieldLabel htmlFor='supplier-address-kind'>{t('procurement:supplier.addressKind')}</FieldLabel>
							<Select
								value={addressKind}
								onValueChange={(value: string | null) =>
									setAddressKind((value ?? 'office') as TSupplierCompanyAddress['kind'])
								}
							>
								<SelectTrigger id='supplier-address-kind' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{COMPANY_ADDRESS_KINDS.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`procurement:addressKind.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='supplier-address-label'>{t('procurement:supplier.addressLabel')}</FieldLabel>
							<Input
								id='supplier-address-label'
								maxLength={100}
								value={addressLabel}
								onChange={(event) => setAddressLabel(event.target.value)}
							/>
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='supplier-address-line'>{t('procurement:supplier.addressLine')}</FieldLabel>
							<Textarea
								id='supplier-address-line'
								rows={2}
								maxLength={500}
								value={addressLine}
								onChange={(event) => setAddressLine(event.target.value)}
							/>
						</Field>
						<div className='sm:col-span-2'>
							<LocationCascade
								value={location}
								initialVillageId={existingAddress?.villageId}
								onChange={setLocation}
							/>
						</div>
						<Field>
							<FieldLabel htmlFor='supplier-address-postal'>{t('procurement:supplier.postalCode')}</FieldLabel>
							<Input
								id='supplier-address-postal'
								inputMode='numeric'
								pattern='[0-9]*'
								maxLength={10}
								value={postalCode}
								onChange={(event) => setPostalCode(event.target.value)}
							/>
						</Field>
						<Field orientation='horizontal' className='sm:col-span-2'>
							<Checkbox
								id='supplier-address-primary'
								checked={isPrimary}
								onCheckedChange={(checked) => setIsPrimary(checked === true)}
							/>
							<FieldLabel htmlFor='supplier-address-primary'>{t('procurement:supplier.addressPrimary')}</FieldLabel>
						</Field>
					</FormSection>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
