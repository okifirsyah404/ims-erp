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
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	Field,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { DialogFooter } from '@ims-erp/ui/components/dialog';
import { Input } from '@ims-erp/ui/components/input';
import { Separator } from '@ims-erp/ui/components/separator';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { ImageGalleryField } from '@/components/image-gallery-field';
import type {
	TWarehouseDetail,
	TWarehouseCreateInput,
	TWarehouseUpdateInput,
} from '@/lib/warehouse-api';
import {
	EMPTY_LOCATION_SELECTION,
	LocationCascade,
	type TLocationSelection,
} from './location-cascade';

/**
 * One titled block of the form: a card on a page, a plain section in a dialog
 * (the dialog is already the surface, so a card would only add dead space).
 */
function FormSection({
	compact,
	title,
	description,
	className,
	children,
}: {
	compact?: boolean;
	title: string;
	description: string;
	className?: string;
	children: ReactNode;
}) {
	if (compact) {
		return (
			<section className='flex flex-col gap-3'>
				<div>
					<h3 className='text-sm font-medium'>{title}</h3>
					<p className='text-xs text-muted-foreground'>{description}</p>
				</div>
				<div className={className}>{children}</div>
			</section>
		);
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className={className}>{children}</CardContent>
		</Card>
	);
}

/**
 * The warehouse create/edit form.
 *
 * @remarks
 * `code` and the owning organization are rendered read-only when editing: the
 * backend treats both as immutable after creation, so surfacing them as
 * editable would only produce a 400.
 *
 * Organization defaults to **empty = global** (plan §6 D-C). This differs from
 * the item form, where an omitted organization means "mine" — warehouses are
 * application-admin-only and global inventory is a first-class concept, so the
 * form says so explicitly instead of leaving it to inference.
 */
export function WarehouseForm({
	warehouse,
	compact,
	submitting,
	onSubmit,
	onCancel,
}: {
	/** Existing warehouse when editing; absent when creating. */
	warehouse?: TWarehouseDetail;
	/** Inside a dialog: no page heading or card chrome, the dialog supplies both. */
	compact?: boolean;
	submitting: boolean;
	/** `imageFiles` are the pictures picked but not uploaded yet (the caller uploads them). */
	onSubmit: (
		input: TWarehouseCreateInput | TWarehouseUpdateInput,
		imageFiles: File[],
	) => void;
	onCancel: () => void;
}) {
	const { t } = useTranslation(['inventory', 'common', 'warehouse']);
	const isEdit = warehouse != null;

	const [imageFiles, setImageFiles] = useState<File[]>([]);

	const [code, setCode] = useState(warehouse?.code ?? '');
	const [name, setName] = useState(warehouse?.name ?? '');
	const [isDefault, setIsDefault] = useState(warehouse?.isDefault ?? false);
	const [isActive, setIsActive] = useState(warehouse?.isActive ?? true);

	// Address sub-form.
	const [label, setLabel] = useState(warehouse?.address?.label ?? '');
	const [street, setStreet] = useState(warehouse?.address?.addressLine ?? '');
	const [rt, setRt] = useState(warehouse?.address?.rt ?? '');
	const [rw, setRw] = useState(warehouse?.address?.rw ?? '');
	const [postalCode, setPostalCode] = useState(
		warehouse?.address?.postalCode ?? '',
	);
	const [location, setLocation] = useState<TLocationSelection>(
		EMPTY_LOCATION_SELECTION,
	);

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const address = street.trim()
			? {
					label: label || null,
					addressLine: street,
					rt: rt || null,
					rw: rw || null,
					postalCode: postalCode || null,
					villageId: location.villageId,
				}
			: undefined;

		onSubmit(
			isEdit
				? { name, isDefault, isActive }
				: {
						code,
						name,
						isDefault,
						isActive,
						// Omitted organizationId means global.
						address,
					},
			imageFiles,
		);
	}

	return (
		<form className='flex flex-col gap-6' onSubmit={handleSubmit}>
			{compact ? null : (
				<div>
					<h1 className='text-2xl font-bold'>
						{isEdit ? t('warehouse:warehouseForm.edit') : t('warehouse:warehouseForm.new')}
					</h1>
					<p className='text-sm text-muted-foreground'>
						{isEdit
							? t('warehouse:warehouseForm.editDescription')
							: t('warehouse:warehouseForm.newDescription')}
					</p>
				</div>
			)}

			<FormSection
				compact={compact}
				title={t('warehouse:warehouseForm.details')}
				description={t('warehouse:warehouseForm.detailsDescription')}
			>
				<div className='mb-4'>
					<ImageGalleryField
						label={t('warehouse:warehouseForm.photo')}
						entityPath={warehouse ? `/warehouses/${warehouse.id}` : undefined}
						queue={imageFiles}
						onQueueChange={setImageFiles}
						disabled={submitting}
					/>
				</div>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='warehouse-code'>
								{t('warehouse:warehouseForm.code')}
							</FieldLabel>
							<Input
								id='warehouse-code'
								value={code}
								onChange={(event) => setCode(event.target.value)}
								readOnly={isEdit}
								required
								maxLength={32}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='warehouse-name'>
								{t('warehouse:warehouseForm.name')}
							</FieldLabel>
							<Input
								id='warehouse-name'
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
							/>
						</Field>
					</FieldGroup>

					<div className='mt-4 flex flex-col gap-3'>
						<Field orientation='horizontal'>
							<Checkbox
								id='warehouse-is-default'
								checked={isDefault}
								onCheckedChange={(checked) => setIsDefault(checked === true)}
							/>
							<FieldLabel htmlFor='warehouse-is-default'>
								{t('warehouse:warehouseForm.isDefault')}
							</FieldLabel>
						</Field>
						<p className='text-xs text-muted-foreground'>
							{t('warehouse:warehouseForm.isDefaultHint')}
						</p>
						<Field orientation='horizontal'>
							<Checkbox
								id='warehouse-is-active'
								checked={isActive}
								onCheckedChange={(checked) => setIsActive(checked === true)}
							/>
							<FieldLabel htmlFor='warehouse-is-active'>
								{t('warehouse:warehouseForm.isActive')}
							</FieldLabel>
						</Field>
					</div>
			</FormSection>

			<FormSection
				compact={compact}
				title={t('warehouse:warehouseForm.address')}
				description={t('warehouse:warehouseForm.addressDescription')}
				className='flex flex-col gap-4'
			>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor='warehouse-address-label'>
								{t('warehouse:address.label')}
							</FieldLabel>
							<Input
								id='warehouse-address-label'
								value={label}
								onChange={(event) => setLabel(event.target.value)}
							/>
						</Field>
					</FieldGroup>
					<Separator />
					<FieldGroup className='grid gap-4 sm:grid-cols-3'>
						<Field className='sm:col-span-3'>
							<FieldLabel htmlFor='warehouse-address-street'>
								{t('warehouse:address.street')}
							</FieldLabel>
							<Textarea
								id='warehouse-address-street'
								rows={3}
								value={street}
								onChange={(event) => setStreet(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='warehouse-address-rt'>
								{t('warehouse:address.rt')}
							</FieldLabel>
							<Input
								id='warehouse-address-rt'
								value={rt}
								onChange={(event) => setRt(event.target.value)}
								maxLength={8}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='warehouse-address-rw'>
								{t('warehouse:address.rw')}
							</FieldLabel>
							<Input
								id='warehouse-address-rw'
								value={rw}
								onChange={(event) => setRw(event.target.value)}
								maxLength={8}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='warehouse-address-postal'>
								{t('warehouse:address.postalCode')}
							</FieldLabel>
							<Input
								id='warehouse-address-postal'
								value={postalCode}
								onChange={(event) => setPostalCode(event.target.value)}
								maxLength={10}
							/>
						</Field>
					</FieldGroup>

					<LocationCascade
						value={location}
						initialVillageId={warehouse?.address?.villageId}
						onChange={setLocation}
					/>
			</FormSection>

			{(() => {
				const actions = (
					<>
						<Button type='submit' disabled={submitting}>
							{submitting
								? t('warehouse:warehouseForm.saving')
								: isEdit
									? t('common:action.save')
									: t('warehouse:warehouseForm.create')}
						</Button>
						<Button type='button' variant='outline' onClick={onCancel}>
							{t('common:action.cancel')}
						</Button>
					</>
				);
				// In a dialog the shared sticky `DialogFooter` keeps the actions
				// visible while the form scrolls.
				return compact ? (
					<DialogFooter>{actions}</DialogFooter>
				) : (
					<div className='flex gap-2'>{actions}</div>
				);
			})()}
		</form>
	);
}
