import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { FieldLabel } from '@/components/form/field-label';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import {
	SUPPLIER_TYPES,
	type TSupplierCompany,
	type TSupplierCompanyInput,
	type TSupplierType,
} from '@/lib/supplier-api';
import { CountryPhoneField } from '@/components/form/country-phone-field';

type TTextField =
	| 'code'
	| 'name'
	| 'legalName'
	| 'taxId'
	| 'email'
	| 'phone'
	| 'whatsapp'
	| 'website'
	| 'paymentTermNote'
	| 'bankName'
	| 'bankAccountNumber'
	| 'bankAccountHolder'
	| 'notes';

const TEXT_KEYS: TTextField[] = [
	'code', 'name', 'legalName', 'taxId', 'email', 'phone', 'whatsapp', 'website', 'paymentTermNote',
	'bankName', 'bankAccountNumber', 'bankAccountHolder', 'notes',
];

/**
 * Create/edit dialog for a supplier company. Bank fields are only shown to
 * callers holding `supplier:read_bank` (UX only; the server is authoritative),
 * and are not sent otherwise, so nothing is blanked.
 */
export function SupplierFormDialog({
	supplier,
	canSeeBank,
	submitting,
	onClose,
	onSave,
}: {
	supplier: TSupplierCompany | null;
	canSeeBank: boolean;
	submitting: boolean;
	onClose: () => void;
	onSave: (input: Partial<TSupplierCompanyInput>) => void;
}) {
	const { t } = useTranslation(['procurement', 'common']);
	const [supplierType, setSupplierType] = useState<TSupplierType>(supplier?.supplierType ?? 'company');
	const [days, setDays] = useState(String(supplier?.paymentTermsDays ?? 0));
	const [values, setValues] = useState<Record<TTextField, string>>(
		() => Object.fromEntries(TEXT_KEYS.map((key) => [key, supplier?.[key] ?? ''])) as Record<TTextField, string>,
	);

	const field = (key: TTextField, props: React.ComponentProps<typeof Input> = {}, hint?: string) => (
		<Field>
			<FieldLabel htmlFor={`supplier-${key}`} optional={!props.required}>
				{t(`procurement:supplier.${key}`)}
			</FieldLabel>
			{key === 'phone' || key === 'whatsapp' ? (
				// E.164 like every phone of the ERP (ERP-0114).
				<CountryPhoneField
					id={`supplier-${key}`}
					defaultValue={supplier?.[key]}
					required={false}
					onChange={(value) => setValues((current) => ({ ...current, [key]: value }))}
				/>
			) : (
				<Input
					id={`supplier-${key}`}
					value={values[key]}
					onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
					{...props}
				/>
			)}
			{hint && <FieldDescription>{hint}</FieldDescription>}
		</Field>
	);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-3xl'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						const text = (value: string) => value.trim() || null;
						const input: Partial<TSupplierCompanyInput> = {
							// Empty on create: the server generates the code.
							code: values.code.trim() || undefined,
							name: values.name.trim(),
							supplierType,
							paymentTermsDays: Number(days || '0'),
						};
						for (const key of TEXT_KEYS) {
							if (key === 'code' || key === 'name') continue;
							if (!canSeeBank && key.startsWith('bank')) continue;
							(input as Record<string, unknown>)[key] = text(values[key]);
						}
						onSave(input);
					}}
				>
					<DialogHeader>
						<DialogTitle>{supplier ? t('procurement:suppliers.edit') : t('procurement:suppliers.new')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='grid gap-4 py-4 sm:grid-cols-2'>
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
						{field('email', { type: 'email', maxLength: 254 })}
						{field('phone')}
						{field('whatsapp')}
						<Field>
							<FieldLabel htmlFor='supplier-days' optional>{t('procurement:supplier.paymentTermsDays')}</FieldLabel>
							<Input
								id='supplier-days'
								type='number'
								min='0'
								max='365'
								step='1'
								value={days}
								onChange={(event) => setDays(event.target.value)}
							/>
						</Field>
						{field('paymentTermNote', { maxLength: 300 }, t('procurement:supplier.paymentTermNoteHint'))}
						{canSeeBank && (
							<>
								{field('bankName', { maxLength: 200 })}
								{field('bankAccountNumber', { inputMode: 'numeric', maxLength: 100 })}
								{field('bankAccountHolder', { maxLength: 200 })}
							</>
						)}
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='supplier-notes' optional>{t('procurement:supplier.notes')}</FieldLabel>
							<Textarea
								id='supplier-notes'
								rows={2}
								maxLength={2000}
								value={values.notes}
								onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
							/>
						</Field>
					</FieldGroup>
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
