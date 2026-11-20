import { useQuery } from '@tanstack/react-query';
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
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { itemCategoriesQueryOptions } from '@/lib/item-category-api';
import {
	ITEM_UNIT_LABELS,
	PRODUCT_KINDS,
	type TItemUnitLabel,
	type TProduct,
	type TProductCreateInput,
	type TProductKind,
	type TProductUpdateInput,
} from '@/lib/inventory-api';

/**
 * The product create/edit form.
 *
 * @remarks
 * `sku` and `productKind` are rendered read-only when editing: the backend
 * treats both as immutable because they drive uniqueness and the serial status
 * matrix, so surfacing them as editable would only produce a 400.
 *
 * A product kind is product, component or material (consumables only); tools
 * are physical `items` managed under assets, and services are neither stocked
 * nor serialized.
 */
export function ItemForm({
	item,
	defaultItemKind,
	compact,
	submitting,
	onSubmit,
	onCancel,
}: {
	/** Existing product when editing; absent when creating. */
	item?: TProduct;
	/** Preselects the kind on create, so a kind page creates its own kind. */
	defaultItemKind?: TProductKind;
	/** Hides the page heading — the dialog wrapper supplies its own. */
	compact?: boolean;
	submitting: boolean;
	onSubmit: (input: TProductCreateInput | TProductUpdateInput) => void;
	onCancel: () => void;
}) {
	const { t } = useTranslation(['inventory', 'common']);
	const isEdit = item != null;

	const [sku, setSku] = useState(item?.sku ?? '');
	const [serialNumber, setSerialNumber] = useState(item?.serialNumber ?? '');
	const [name, setName] = useState(item?.name ?? '');
	const [productKind, setProductKind] = useState<TProductKind>(
		item?.productKind ?? defaultItemKind ?? 'product',
	);
	const [categoryId, setCategoryId] = useState(item?.productCategoryId ?? '');
	const [unitLabel, setUnitLabel] = useState<TItemUnitLabel>(item?.unitLabel ?? 'pcs');
	const [brand, setBrand] = useState(item?.brand ?? '');
	const [specification, setSpecification] = useState(item?.specification ?? '');
	const [isActive, setIsActive] = useState(item?.isActive ?? true);
	// Active categories for the picker, plus the item's own (maybe inactive).
	const { data: allCategories = [] } = useQuery(itemCategoriesQueryOptions(true));
	const categoryOptions = allCategories.filter(
		(category) => category.isActive || category.id === item?.productCategoryId,
	);
	const [description, setDescription] = useState(item?.description ?? '');
	const [barcode, setBarcode] = useState(item?.barcode ?? '');
	const [isSerialized, setIsSerialized] = useState(item?.isSerialized ?? false);
	const [isStockTracked, setIsStockTracked] = useState(item?.isStockTracked ?? true);
	const [minStockQty, setMinStockQty] = useState(item?.minStockQty ?? '0');
	const [sellingPrice, setSellingPrice] = useState(String(item?.sellingPrice ?? 0));
	const [purchasePrice, setPurchasePrice] = useState(
		String(item?.purchasePrice ?? 0),
	);

	function handleKindChange(next: TProductKind) {
		setProductKind(next);
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const shared = {
			name,
			serialNumber: serialNumber.trim() || null,
			description: description || null,
			productCategoryId: categoryId || null,
			unitLabel,
			brand: brand.trim() || null,
			specification: specification.trim() || null,
			isActive,
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
				: { ...shared, sku, productKind, currencyCode: 'IDR' },
		);
	}

	return (
		<div className='flex flex-col gap-6'>
			{compact ? null : (
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
			)}

			<Card>
				<CardHeader>
					<CardTitle>{t('inventory:items.name')}</CardTitle>
					<CardDescription>{t('inventory:items.description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							{isEdit && (
								<Field>
									<FieldLabel htmlFor='code'>{t('inventory:items.code')}</FieldLabel>
									<Input id='code' value={item?.code ?? ''} readOnly disabled />
									<FieldDescription>
										{t('inventory:items.codeAutoHint')}
									</FieldDescription>
								</Field>
							)}

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
								<FieldLabel htmlFor='serialNumber'>
									{t('inventory:items.serialNumber')}
								</FieldLabel>
								<Input
									id='serialNumber'
									value={serialNumber}
									maxLength={200}
									onChange={(event) => setSerialNumber(event.target.value)}
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
								<FieldLabel htmlFor='productKind'>
									{t('inventory:items.kind')}
								</FieldLabel>
								<Select
									value={productKind}
									disabled={isEdit}
									onValueChange={(value: string | null) =>
										handleKindChange(value as TProductKind)
									}
								>
									<SelectTrigger id='productKind' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PRODUCT_KINDS.map((kind) => (
											<SelectItem key={kind} value={kind}>
												{t(`inventory:kind.${kind}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>

							<Field>
								<FieldLabel htmlFor='category'>
									{t('inventory:items.category')}
								</FieldLabel>
								<Select
									value={categoryId === '' ? 'none' : categoryId}
									onValueChange={(value: string | null) =>
										setCategoryId(value == null || value === 'none' ? '' : value)
									}
								>
									<SelectTrigger id='category' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='none'>{t('inventory:items.noCategory')}</SelectItem>
										{categoryOptions.map((category) => (
											<SelectItem key={category.id} value={category.id}>
												{category.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>

							<Field>
								<FieldLabel htmlFor='unitLabel'>
									{t('inventory:items.unitLabel')}
								</FieldLabel>
								<Select
									value={unitLabel}
									onValueChange={(value: string | null) => setUnitLabel(value as TItemUnitLabel)}
								>
									<SelectTrigger id='unitLabel' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ITEM_UNIT_LABELS.map((unit) => (
											<SelectItem key={unit} value={unit}>
												{unit}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>

							<Field>
								<FieldLabel htmlFor='brand'>{t('inventory:items.brand')}</FieldLabel>
								<Input
									id='brand'
									value={brand}
									maxLength={100}
									onChange={(event) => setBrand(event.target.value)}
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor='specification'>
									{t('inventory:items.specification')}
								</FieldLabel>
								<Textarea
									id='specification'
									rows={4}
									maxLength={4000}
									value={specification}
									onChange={(event) => setSpecification(event.target.value)}
								/>
								<FieldDescription>{t('inventory:items.specificationHint')}</FieldDescription>
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
									onCheckedChange={(checked) => setIsSerialized(checked === true)}
								/>
								{t('inventory:items.serialized')}
							</label>
							<p className='text-xs text-muted-foreground'>
								{t('inventory:form.serializedHint')}
							</p>

							<label className='flex items-center gap-2 text-sm'>
								<Checkbox
									checked={isStockTracked}
									disabled={isSerialized}
									onCheckedChange={(checked) =>
										setIsStockTracked(checked === true)
									}
								/>
								{t('inventory:items.quantityTracked')}
							</label>

							<label className='flex items-center gap-2 text-sm'>
								<Checkbox
									checked={isActive}
									onCheckedChange={(checked) => setIsActive(checked === true)}
								/>
								{t('inventory:items.isActive')}
							</label>
							<p className='text-xs text-muted-foreground'>
								{t('inventory:items.isActiveHint')}
							</p>

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
