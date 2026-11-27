import { MoneyInput } from '@/components/money-input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import {
	createTaxRecord,
	previewTax,
	type TTaxType,
} from '@/lib/tax-api';

const NONE = 'none';

/**
 * Creates one draft tax workpaper (ERP-0016).
 *
 * @remarks
 * The preview reads the effective rate for the chosen period without saving
 * anything. Only the taxable base is entered here; the tax amount is computed
 * by the server and cannot be typed directly.
 */
export function TaxRecordCreateDialog({
	types,
	onClose,
}: {
	types: TTaxType[];
	onClose: () => void;
}) {
	const { t } = useTranslation(['tax', 'common']);
	const queryClient = useQueryClient();
	const [taxTypeId, setTaxTypeId] = useState(NONE);
	const [periodYear, setPeriodYear] = useState(() => String(new Date().getFullYear()));
	const [periodMonth, setPeriodMonth] = useState(
		() => String(new Date().getMonth() + 1),
	);
	const [taxableBase, setTaxableBase] = useState('');
	const [preview, setPreview] = useState<string | null>(null);

	const activeTypes = types.filter((type) => type.isActive);
	const date = `${periodYear}-${periodMonth.padStart(2, '0')}-01`;
	const baseMinor = Math.round(Number(taxableBase) * 100);
	const valid =
		taxTypeId !== NONE &&
		/^\d{4}$/.test(periodYear) &&
		taxableBase !== '' &&
		Number.isFinite(Number(taxableBase)) &&
		Number(taxableBase) >= 0;

	const runPreview = useMutation({
		mutationFn: () => previewTax({ taxTypeId, taxableBase: baseMinor, date }),
		onSuccess: (result) =>
			setPreview(
				t('tax:records.previewResult', {
					amount: (result.taxAmount / 100).toLocaleString(),
					rate: result.rate,
					date: result.effectiveFrom,
				}),
			),
		onError: (error: Error) => toast.error(error.message),
	});

	const create = useMutation({
		mutationFn: () =>
			createTaxRecord({
				taxTypeId,
				periodYear: Number(periodYear),
				periodMonth: Number(periodMonth),
				taxableBase: baseMinor,
			}),
		onSuccess: async () => {
			toast.success(t('tax:records.created'));
			await queryClient.invalidateQueries({ queryKey: ['tax-records'] });
			await queryClient.invalidateQueries({ queryKey: ['tax-recap'] });
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-lg'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) create.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('tax:records.create')}</DialogTitle>
						<DialogDescription>{t('tax:records.description')}</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='tax-record-type'>{t('tax:records.taxType')}</FieldLabel>
						<Select value={taxTypeId} onValueChange={(value: string | null) => setTaxTypeId(value ?? NONE)}>
							<SelectTrigger id='tax-record-type'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>{t('tax:records.taxType')}</SelectItem>
								{activeTypes.map((type) => (
									<SelectItem key={type.id} value={type.id}>
										{type.code} — {type.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<div className='grid gap-3 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='tax-record-year'>{t('tax:recap.year')}</FieldLabel>
							<Input
								id='tax-record-year'
								type='number'
								min={2000}
								max={2100}
								value={periodYear}
								onChange={(event) => setPeriodYear(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='tax-record-month'>{t('tax:recap.month')}</FieldLabel>
							<Select value={periodMonth} onValueChange={(value: string | null) => setPeriodMonth(value ?? '1')}>
								<SelectTrigger id='tax-record-month'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
										<SelectItem key={value} value={String(value)}>
											{value}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor='tax-record-base'>{t('tax:records.taxableBase')}</FieldLabel>
						<MoneyInput
							id='tax-record-base'
							value={taxableBase}
							onValueChange={setTaxableBase}
						/>
					</Field>
					<div className='flex flex-wrap items-center gap-2'>
						<Button
							type='button'
							variant='outline'
							disabled={!valid || runPreview.isPending}
							onClick={() => runPreview.mutate()}
						>
							{t('tax:records.preview')}
						</Button>
						{preview ? (
							<p className='text-muted-foreground text-sm'>{preview}</p>
						) : null}
					</div>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!valid || create.isPending}>
							{create.isPending ? t('tax:records.creating') : t('tax:records.create')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
