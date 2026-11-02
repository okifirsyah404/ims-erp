import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Field,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	ITEM_KINDS,
	type TItem,
	type TItemCreateInput,
	type TItemKind,
	type TItemUpdateInput,
} from '@/lib/inventory-api';

/**
 * The item create/edit form.
 *
 * @remarks
 * `sku` and `itemKind` are rendered read-only when editing: the backend treats
 * both as immutable because they drive uniqueness and the unit status matrix,
 * so surfacing them as editable would only produce a 400.
 *
 * The service/stock coupling is mirrored here — choosing `service` clears and
 * disables both tracking flags, because a service is never serialized and
 * never stocked (enforced again server-side).
 */
export function ItemForm({
	item,
	submitting,
	onSubmit,
	onCancel,
}: {
	/** Existing item when editing; absent when creating. */
	item?: TItem;
	submitting: boolean;
	onSubmit: (input: TItemCreateInput | TItemUpdateInput) => void;
	onCancel: () => void;
}) {
	const { t } = useTranslation(['inventory', 'common']);
	const isEdit = item != null;

	const [sku, setSku] = useState(item?.sku ?? '');
	const [name, setName] = useState(item?.name ?? '');
	const [itemKind, setItemKind] = useState<TItemKind>(item?.itemKind ?? 'product');
	const [category, setCategory] = useState(item?.category ?? '');
	const [unitLabel, setUnitLabel] = useState(item?.unitLabel ?? '');
	const [description, setDescription] = useState(item?.description ?? '');
	const [barcode, setBarcode] = useState(item?.barcode ?? '');
	const [isSerialized, setIsSerialized] = useState(item?.isSerialized ?? false);
	const [isStockTracked, setIsStockTracked] = useState(item?.isStockTracked ?? true);
	const [minStockQty, setMinStockQty] = useState(item?.minStockQty ?? '0');
	const [sellingPrice, setSellingPrice] = useState(String(item?.sellingPrice ?? 0));
	const [purchasePrice, setPurchasePrice] = useState(
		String(item?.purchasePrice ?? 0),
	);

	const isService = itemKind === 'service';

	function handleKindChange(next: TItemKind) {
		setItemKind(next);
		if (next === 'service') {
			setIsSerialized(false);
			setIsStockTracked(false);
		}
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const shared = {
			name,
			description: description || null,
			category: category || null,
			unitLabel: unitLabel || null,
			isSerialized,
			isStockTracked,
			minStockQty: Number(minStockQty) || 0,
			barcode: barcode || null,
			sellingPrice: Number(sellingPrice) || 0,
			purchasePrice: Number(purchasePrice) || 0,
		};

		onSubmit(
			isEdit
				? shared
				: { ...shared, sku, itemKind, currencyCode: 'IDR' },
		);
	}

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div>
				<h1 className='text-2xl font-bold'>
					{isEdit ? t('inventory:form.editItem') : t('inventory:form.newItem')}
				</h1>
				<p className='text-sm text-muted-foreground'>
					{isEdit
						? t('inventory:form.editItemDescription')
						: t('inventory:form.newItemDescription')}
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('inventory:items.name')}</CardTitle>
					<CardDescription>{t('inventory:items.description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='sku'>{t('inventory:items.sku')}</FieldLabel>
								<Input
									id='sku'
									value={sku}
									required
									maxLength={64}
									readOnly={isEdit}
									disabled={isEdit}
									onChange={(event) => setSku(event.target.value)}
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor='name'>{t('inventory:items.name')}</FieldLabel>
								<Input
									id='name'
									value={name}
									required
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor='itemKind'>
									{t('inventory:items.kind')}
								</FieldLabel>
								<select
									id='itemKind'
									className='h-9 w-full rounded-md border bg-transparent px-3 text-sm'
									value={itemKind}
									disabled={isEdit}
									onChange={(event) =>
										handleKindChange(event.target.value as TItemKind)
									}
								>
									{ITEM_KINDS.map((kind) => (
										<option key={kind} value={kind}>
											{t(`inventory:kind.${kind}`)}
										</option>
									))}
								</select>
							</Field>

							<Field>
								<FieldLabel htmlFor='category'>
									{t('inventory:items.category')}
								</FieldLabel>
								<Input
									id='category'
									value={category}
									onChange={(event) => setCategory(event.target.value)}
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor='unitLabel'>
									{t('inventory:items.unitLabel')}
								</FieldLabel>
								<Input
									id='unitLabel'
									value={unitLabel}
									maxLength={32}
									placeholder='pcs'
									onChange={(event) => setUnitLabel(event.target.value)}
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor='barcode'>
									{t('inventory:items.barcode')}
								</FieldLabel>
								<Input
									id='barcode'
									value={barcode}
									onChange={(event) => setBarcode(event.target.value)}
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor='description'>
									{t('inventory:items.description_label')}
								</FieldLabel>
								<Input
									id='description'
									value={description}
									onChange={(event) => setDescription(event.target.value)}
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor='minStockQty'>
									{t('inventory:items.minStockQty')}
								</FieldLabel>
								<Input
									id='minStockQty'
									type='number'
									min={0}
									step='0.001'
									value={minStockQty}
									disabled={isService}
									onChange={(event) => setMinStockQty(event.target.value)}
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor='sellingPrice'>
									{t('inventory:items.sellingPrice')}
								</FieldLabel>
								<Input
									id='sellingPrice'
									type='number'
									min={0}
									step={1}
									value={sellingPrice}
									onChange={(event) => setSellingPrice(event.target.value)}
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor='purchasePrice'>
									{t('inventory:items.purchasePrice')}
								</FieldLabel>
								<Input
									id='purchasePrice'
									type='number'
									min={0}
									step={1}
									value={purchasePrice}
									onChange={(event) => setPurchasePrice(event.target.value)}
								/>
							</Field>

							<label className='flex items-center gap-2 text-sm'>
								<Checkbox
									checked={isSerialized}
									disabled={isService}
									onCheckedChange={(checked) => setIsSerialized(checked === true)}
								/>
								{t('inventory:items.serialized')}
							</label>
							<p className='text-xs text-muted-foreground'>
								{isService
									? t('inventory:form.serviceHint')
									: t('inventory:form.serializedHint')}
							</p>

							<label className='flex items-center gap-2 text-sm'>
								<Checkbox
									checked={isStockTracked}
									disabled={isService || isSerialized}
									onCheckedChange={(checked) =>
										setIsStockTracked(checked === true)
									}
								/>
								{t('inventory:items.quantityTracked')}
							</label>

							<div className='flex gap-2'>
								<Button type='submit' disabled={submitting || !name || !sku}>
									{submitting
										? isEdit
											? t('inventory:form.saving')
											: t('inventory:form.creating')
										: isEdit
											? t('inventory:form.save')
											: t('inventory:form.create')}
								</Button>
								<Button type='button' variant='outline' onClick={onCancel}>
									{t('common:action.cancel')}
								</Button>
							</div>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
