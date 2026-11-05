import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { SUPPLIER_TYPES, type TSupplier, type TSupplierInput, type TSupplierType } from '@/lib/procurement-api';

type TTextField = Exclude<keyof TSupplierInput, 'supplierType' | 'paymentTermsDays'>;

/**
 * Create/edit dialog for a supplier. Bank fields are only shown when the
 * caller may see them (a new supplier, or `bankVisible`); otherwise they are
 * not sent, so nothing is blanked.
 */
export function SupplierFormDialog({
	supplier,
	canSeeBank,
	submitting,
	onClose,
	onSave,
}: {
	supplier: TSupplier | null;
	canSeeBank: boolean;
	submitting: boolean;
	onClose: () => void;
	onSave: (input: Partial<TSupplierInput>) => void;
}) {
	const { t } = useTranslation(['procurement', 'common']);
	const showBank = supplier ? supplier.bankVisible : canSeeBank;
	const [supplierType, setSupplierType] = useState<TSupplierType>(supplier?.supplierType ?? 'company');
	const [days, setDays] = useState(String(supplier?.paymentTermsDays ?? 0));
	const [values, setValues] = useState<Record<TTextField, string>>(() => {
		const keys: TTextField[] = [
			'code', 'name', 'legalName', 'taxId', 'email', 'phone', 'whatsapp', 'website', 'addressLine', 'postalCode',
			'picName', 'picTitle', 'picPhone', 'picEmail', 'paymentTermNote', 'bankName', 'bankAccountNumber',
			'bankAccountHolder', 'notes',
		];
		return Object.fromEntries(keys.map((key) => [key, (supplier?.[key] as string | null) ?? ''])) as Record<TTextField, string>;
	});

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
			<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-3xl'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						const text = (value: string) => value.trim() || null;
						const input: Partial<TSupplierInput> = {
							code: values.code.trim(),
							name: values.name.trim(),
							supplierType,
							paymentTermsDays: Number(days || '0'),
						};
						for (const key of Object.keys(values) as TTextField[]) {
							if (key === 'code' || key === 'name') continue;
							if (!showBank && key.startsWith('bank')) continue;
							(input as Record<string, unknown>)[key] = text(values[key]);
						}
						onSave(input);
					}}
				>
					<DialogHeader>
						<DialogTitle>{supplier ? t('procurement:suppliers.edit') : t('procurement:suppliers.new')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='grid gap-4 py-4 sm:grid-cols-2'>
						{field('code', { required: true, maxLength: 32, pattern: '[A-Za-z0-9]+', className: 'uppercase' }, t('procurement:supplier.codeHint'))}
						<Field>
							<FieldLabel htmlFor='supplier-type'>{t('procurement:supplier.supplierType')}</FieldLabel>
							<select
								id='supplier-type'
								className='h-9 w-full rounded-md border bg-transparent px-3 text-sm'
								value={supplierType}
								onChange={(event) => setSupplierType(event.target.value as TSupplierType)}
							>
								{SUPPLIER_TYPES.map((value) => (
									<option key={value} value={value}>
										{t(`procurement:supplierType.${value}`)}
									</option>
								))}
							</select>
						</Field>
						{field('name', { required: true, maxLength: 200 })}
						{field('legalName', { maxLength: 200 })}
						{field('taxId', { inputMode: 'numeric', maxLength: 25 })}
						{field('website', { type: 'url', maxLength: 200, placeholder: 'https://' })}
						{field('email', { type: 'email', maxLength: 254 })}
						{field('phone', { type: 'tel', maxLength: 30 })}
						{field('whatsapp', { type: 'tel', maxLength: 30 })}
						{field('postalCode', { inputMode: 'numeric', maxLength: 10, pattern: '[0-9]*' })}
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='supplier-addressLine'>{t('procurement:supplier.addressLine')}</FieldLabel>
							<Textarea
								id='supplier-addressLine'
								rows={2}
								maxLength={500}
								value={values.addressLine}
								onChange={(event) => setValues((current) => ({ ...current, addressLine: event.target.value }))}
							/>
						</Field>
						{field('picName', { maxLength: 120 })}
						{field('picTitle', { maxLength: 100 })}
						{field('picPhone', { type: 'tel', maxLength: 30 })}
						{field('picEmail', { type: 'email', maxLength: 254 })}
						<Field>
							<FieldLabel htmlFor='supplier-days'>{t('procurement:supplier.paymentTermsDays')}</FieldLabel>
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
						{showBank && (
							<>
								{field('bankName', { maxLength: 100 })}
								{field('bankAccountNumber', { inputMode: 'numeric', maxLength: 40 })}
								{field('bankAccountHolder', { maxLength: 150 })}
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
			</DialogContent>
		</Dialog>
	);
}
