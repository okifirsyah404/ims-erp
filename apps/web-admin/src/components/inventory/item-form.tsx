import { MoneyInput } from '@/components/money-input';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { FieldLabel } from '@/components/form/field-label';
import { DialogFooter } from '@ims-erp/ui/components/dialog';
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
import { minorToRupiah, rupiahToMinor } from '@/lib/format';
import { ImageGalleryField } from '@/components/image-gallery-field';
import { ProductCompositionEditor } from '@/components/inventory/product-composition';
import { toCompositionDrafts, toCompositionLines, type TCompositionDraft } from '@/lib/product-composition';
import { toast } from '@/components/toast';
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
	/**
	 * `imageFiles` are the pictures picked but not uploaded yet (create and
	 * edit). The gallery endpoints are id-scoped, so the caller uploads them
	 * once the item exists. Pictures already saved are managed in the form
	 * itself, immediately.
	 */
	onSubmit: (
		input: TProductCreateInput | TProductUpdateInput,
		imageFiles: File[],
		/** The edited composition, or `null` when it does not apply or did not change. */
		composition: TCompositionDraft[] | null,
	) => void;
	onCancel: () => void;
}) {
	const { t } = useTranslation(['inventory', 'common', 'product']);
	const isEdit = item != null;

	const [imageFiles, setImageFiles] = useState<File[]>([]);
	const initialComposition = toCompositionDrafts(item?.components);
	const [composition, setComposition] = useState<TCompositionDraft[]>(initialComposition);

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
	const [warrantyMonths, setWarrantyMonths] = useState(item?.warrantyMonths == null ? '' : String(item.warrantyMonths));
	const [sellingPrice, setSellingPrice] = useState(minorToRupiah(item?.sellingPrice ?? 0));
	const [purchasePrice, setPurchasePrice] = useState(minorToRupiah(item?.purchasePrice ?? 0));

	function handleKindChange(next: TProductKind) {
		setProductKind(next);
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const compositionApplies = productKind === 'product';
		if (compositionApplies && toCompositionLines(composition) === null) {
			toast.error(t('product:composition.invalidQuantity'));
			return;
		}
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
			// B-30: empty = no standard warranty.
			warrantyMonths: warrantyMonths.trim() === '' ? null : Math.trunc(Number(warrantyMonths)),
			barcode: barcode || null,
			sellingPrice: rupiahToMinor(sellingPrice),
			purchasePrice: rupiahToMinor(purchasePrice),
		};

		onSubmit(
			isEdit
				? shared
				: { ...shared, sku, productKind, currencyCode: 'IDR' },
			imageFiles,
			compositionApplies && JSON.stringify(composition) !== JSON.stringify(initialComposition)
				? composition
				: null,
		);
	}

	const submitLabel = submitting
		? isEdit
			? t('product:form.saving')
			: t('product:form.creating')
		: isEdit
			? t('product:form.save')
			: t('product:form.create');

	const actions = (
		<>
			<Button type='submit' disabled={submitting || !name || !sku}>
				{submitLabel}
			</Button>
			<Button type='button' variant='outline' onClick={onCancel}>
				{t('common:action.cancel')}
			</Button>
		</>
	);

	const identity = (
		<FormSection
			compact={compact}
			title={t('product:form.section.identity')}
			description={t('product:form.section.identityDescription')}
		>
			<FieldGroup className='grid gap-4 sm:grid-cols-2'>
				{isEdit && (
					<Field>
						<FieldLabel htmlFor='code'>{t('product:items.code')}</FieldLabel>
						<Input id='code' value={item?.code ?? ''} readOnly disabled />
						<FieldDescription>{t('product:items.codeAutoHint')}</FieldDescription>
					</Field>
				)}

				<Field>
					<FieldLabel htmlFor='productKind'>{t('product:items.kind')}</FieldLabel>
					<Select
						value={productKind}
						disabled={isEdit}
						onValueChange={(value: string | null) => handleKindChange(value as TProductKind)}
					>
						<SelectTrigger id='productKind' className='w-full'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PRODUCT_KINDS.map((kind) => (
								<SelectItem key={kind} value={kind}>
									{t(`product:kind.${kind}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>

				<Field className='sm:col-span-2'>
					<FieldLabel htmlFor='name'>{t('product:items.name')}</FieldLabel>
					<Input id='name' value={name} required onChange={(event) => setName(event.target.value)} />
				</Field>

				<Field>
					<FieldLabel htmlFor='sku'>{t('product:items.sku')}</FieldLabel>
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
					<FieldLabel htmlFor='serialNumber' optional>{t('product:items.serialNumber')}</FieldLabel>
					<Input
						id='serialNumber'
						value={serialNumber}
						maxLength={200}
						onChange={(event) => setSerialNumber(event.target.value)}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor='category'>{t('product:items.category')}</FieldLabel>
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
							<SelectItem value='none'>{t('product:items.noCategory')}</SelectItem>
							{categoryOptions.map((category) => (
								<SelectItem key={category.id} value={category.id}>
									{category.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>

				<Field>
					<FieldLabel htmlFor='brand' optional>{t('product:items.brand')}</FieldLabel>
					<Input
						id='brand'
						value={brand}
						maxLength={100}
						onChange={(event) => setBrand(event.target.value)}
					/>
				</Field>

				<Field className='sm:col-span-2'>
					<FieldLabel htmlFor='description' optional>{t('product:items.description_label')}</FieldLabel>
					<Input
						id='description'
						value={description}
						onChange={(event) => setDescription(event.target.value)}
					/>
				</Field>
			</FieldGroup>
		</FormSection>
	);

	const media = (
		<FormSection
			compact={compact}
			title={t('product:form.section.media')}
			description={t('product:form.section.mediaDescription')}
		>
			<ImageGalleryField
				label={t('product:items.documentPhoto')}
				entityPath={item ? `/products/${item.id}` : undefined}
				queue={imageFiles}
				onQueueChange={setImageFiles}
				disabled={submitting}
			/>
		</FormSection>
	);

	const pricing = (
		<FormSection
			compact={compact}
			title={t('product:form.section.pricing')}
			description={t('product:form.section.pricingDescription')}
		>
			<FieldGroup className='grid gap-4 sm:grid-cols-2'>
				<Field>
					<FieldLabel htmlFor='sellingPrice' optional>{t('product:items.sellingPrice')}</FieldLabel>
					<MoneyInput id='sellingPrice' value={sellingPrice} onValueChange={setSellingPrice} />
				</Field>
				<Field>
					<FieldLabel htmlFor='purchasePrice' optional>{t('product:items.purchasePrice')}</FieldLabel>
					<MoneyInput id='purchasePrice' value={purchasePrice} onValueChange={setPurchasePrice} />
				</Field>
			</FieldGroup>
		</FormSection>
	);

	const stock = (
		<FormSection
			compact={compact}
			title={t('product:form.section.stock')}
			description={t('product:form.section.stockDescription')}
		>
			<FieldGroup className='grid gap-4 sm:grid-cols-2'>
				<Field>
					<FieldLabel htmlFor='unitLabel'>{t('product:items.unitLabel')}</FieldLabel>
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
					<FieldLabel htmlFor='minStockQty' optional>{t('product:items.minStockQty')}</FieldLabel>
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
					<FieldLabel htmlFor='warrantyMonths' optional>{t('product:items.warrantyMonths')}</FieldLabel>
					<Input
						id='warrantyMonths'
						type='number'
						inputMode='numeric'
						min={0}
						max={120}
						step={1}
						value={warrantyMonths}
						onChange={(event) => setWarrantyMonths(event.target.value)}
					/>
					<FieldDescription>{t('product:items.warrantyMonthsHint')}</FieldDescription>
				</Field>

				<Field className='sm:col-span-2'>
					<FieldLabel htmlFor='barcode' optional>{t('product:items.barcode')}</FieldLabel>
					<Input id='barcode' value={barcode} onChange={(event) => setBarcode(event.target.value)} />
				</Field>
			</FieldGroup>

			<div className='mt-4 flex flex-col gap-3 rounded-lg border bg-muted/30 p-3'>
				<div className='flex flex-col gap-1'>
					<Field orientation='horizontal'>
						<Checkbox
							id='isSerialized'
							checked={isSerialized}
							onCheckedChange={(checked) => setIsSerialized(checked === true)}
						/>
						<FieldLabel htmlFor='isSerialized'>{t('product:items.serialized')}</FieldLabel>
					</Field>
					<p className='pl-7 text-xs text-muted-foreground'>{t('product:form.serializedHint')}</p>
				</div>

				<Field orientation='horizontal'>
					<Checkbox
						id='isStockTracked'
						checked={isStockTracked}
						disabled={isSerialized}
						onCheckedChange={(checked) => setIsStockTracked(checked === true)}
					/>
					<FieldLabel htmlFor='isStockTracked'>{t('product:items.quantityTracked')}</FieldLabel>
				</Field>

				<div className='flex flex-col gap-1'>
					<Field orientation='horizontal'>
						<Checkbox
							id='isActive'
							checked={isActive}
							onCheckedChange={(checked) => setIsActive(checked === true)}
						/>
						<FieldLabel htmlFor='isActive'>{t('product:items.isActive')}</FieldLabel>
					</Field>
					<p className='pl-7 text-xs text-muted-foreground'>{t('product:items.isActiveHint')}</p>
				</div>
			</div>
		</FormSection>
	);

	const specificationSection = (
		<FormSection
			compact={compact}
			title={t('product:form.section.specification')}
			description={t('product:form.section.specificationDescription')}
		>
			<Field>
				<Textarea
					id='specification'
					aria-label={t('product:items.specification')}
					rows={4}
					maxLength={4000}
					value={specification}
					onChange={(event) => setSpecification(event.target.value)}
				/>
				<FieldDescription>{t('product:items.specificationHint')}</FieldDescription>
			</Field>
		</FormSection>
	);

	const compositionSection =
		productKind === 'product' ? (
			<FormSection
				compact={compact}
				title={t('product:composition.title')}
				description={t('product:form.section.compositionDescription')}
			>
				<ProductCompositionEditor value={composition} onChange={setComposition} disabled={submitting} />
			</FormSection>
		) : null;

	return (
		<div className='flex flex-col gap-6'>
			{compact ? null : (
				<div>
					<h1 className='text-2xl font-bold'>
						{isEdit ? t('product:form.editItem') : t('product:form.newItem')}
					</h1>
					<p className='text-sm text-muted-foreground'>
						{isEdit ? t('product:form.editItemDescription') : t('product:form.newItemDescription')}
					</p>
				</div>
			)}

			<form onSubmit={handleSubmit} className='flex flex-col gap-6'>
				{compact ? (
					// A dialog is already a surface: plain stacked sections, sticky footer.
					<div className='flex flex-col gap-6'>
						{identity}
						{media}
						{pricing}
						{stock}
						{specificationSection}
						{compositionSection}
						<DialogFooter>{actions}</DialogFooter>
					</div>
				) : (
					<>
						<div className='grid gap-6 lg:grid-cols-3'>
							<div className='flex flex-col gap-6 lg:col-span-2'>
								{identity}
								{pricing}
								{specificationSection}
								{compositionSection}
							</div>
							<div className='flex flex-col gap-6'>
								{media}
								{stock}
							</div>
						</div>
						<div className='sticky bottom-0 z-10 -mx-1 flex justify-end gap-2 rounded-lg border bg-background/95 p-3 backdrop-blur'>
							{actions}
						</div>
					</>
				)}
			</form>
		</div>
	);
}

/**
 * One titled block of the form: a card on the page, a plain headed block
 * inside a dialog (the dialog is already the surface).
 */
function FormSection({
	compact,
	title,
	description,
	children,
}: {
	compact?: boolean;
	title: string;
	description: string;
	children: ReactNode;
}) {
	if (compact) {
		return (
			<section className='flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0'>
				<div>
					<h3 className='text-sm font-semibold'>{title}</h3>
					<p className='text-xs text-muted-foreground'>{description}</p>
				</div>
				{children}
			</section>
		);
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}
