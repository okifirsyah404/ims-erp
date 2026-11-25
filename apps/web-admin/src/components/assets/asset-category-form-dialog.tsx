import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import {
	DEPRECIATION_METHODS,
	ITEM_KINDS,
	type TAssetCategory,
	type TDepreciationMethod,
	type TItemKind,
} from '@/lib/asset-api';

/** Values the create/edit dialog hands to the caller. */
export type TAssetCategoryFormValues = {
	code: string;
	name: string;
	itemKind: TItemKind;
	defaultUsefulLifeMonths: number | null;
	defaultDepreciationMethod: TDepreciationMethod;
};

/**
 * Create/edit dialog for an asset category (Phase A-4).
 *
 * @remarks
 * `code` is create-only: the backend's update contract has no `code` field,
 * and it is the key printed on asset labels. Editing shows it disabled with a
 * hint rather than pretending it is editable.
 */
export function AssetCategoryFormDialog({
	category,
	submitting,
	onClose,
	onSave,
}: {
	category: TAssetCategory | null;
	submitting: boolean;
	onClose: () => void;
	onSave: (values: TAssetCategoryFormValues) => void;
}) {
	const { t } = useTranslation(['assets', 'common']);
	const editing = category !== null;

	const [code, setCode] = useState(category?.code ?? '');
	const [name, setName] = useState(category?.name ?? '');
	const [itemKind, setItemKind] = useState<TItemKind>(
		category?.itemKind ?? 'equipment',
	);
	const [method, setMethod] = useState<TDepreciationMethod>(
		(category?.defaultDepreciationMethod as TDepreciationMethod) ??
			'straight_line',
	);
	const [lifeMonths, setLifeMonths] = useState(
		category?.defaultUsefulLifeMonths != null
			? String(category.defaultUsefulLifeMonths)
			: '',
	);

	const life = lifeMonths.trim() === '' ? null : Number(lifeMonths);
	const lifeInvalid = life !== null && (!Number.isInteger(life) || life <= 0);
	const valid = code.trim() !== '' && name.trim() !== '' && !lifeInvalid;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-lg'>
				<form
					className='flex flex-col gap-5'
					onSubmit={(event) => {
						event.preventDefault();
						if (!valid) return;
						onSave({
							code: code.trim().toUpperCase(),
							name: name.trim(),
							itemKind,
							defaultUsefulLifeMonths: life,
							defaultDepreciationMethod: method,
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>
							{editing
								? t('assets:categories.edit')
								: t('assets:categories.new')}
						</DialogTitle>
					</DialogHeader>

					<div className='grid gap-4 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='category-code'>
								{t('assets:categories.code')}
							</FieldLabel>
							<Input
								id='category-code'
								required
								maxLength={32}
								className='font-mono uppercase'
								value={code}
								disabled={editing}
								onChange={(event) => setCode(event.target.value)}
							/>
							{editing ? (
								<FieldDescription>
									{t('assets:categories.immutableHint')}
								</FieldDescription>
							) : null}
						</Field>
						<Field>
							<FieldLabel htmlFor='category-name'>
								{t('assets:categories.name')}
							</FieldLabel>
							<Input
								id='category-name'
								required
								maxLength={200}
								value={name}
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='category-kind'>
								{t('assets:categories.itemKind')}
							</FieldLabel>
							<Select
								value={itemKind}
								onValueChange={(value: string | null) =>
									setItemKind((value ?? 'equipment') as TItemKind)
								}
							>
								<SelectTrigger id='category-kind' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ITEM_KINDS.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`assets:itemKind.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='category-method'>
								{t('assets:categories.depMethod')}
							</FieldLabel>
							<Select
								value={method}
								onValueChange={(value: string | null) =>
									setMethod((value ?? 'straight_line') as TDepreciationMethod)
								}
							>
								<SelectTrigger id='category-method' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{DEPRECIATION_METHODS.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`assets:depreciationMethod.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='category-life' optional>
								{t('assets:categories.lifeMonths')}
							</FieldLabel>
							<Input
								id='category-life'
								type='number'
								min={1}
								step={1}
								value={lifeMonths}
								onChange={(event) => setLifeMonths(event.target.value)}
							/>
							{lifeInvalid ? (
								<FieldDescription>
									{t('assets:categories.lifeMonthsInvalid')}
								</FieldDescription>
							) : null}
						</Field>
					</div>

					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting || !valid}>
							{submitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
