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
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	Field,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
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
	submitting,
	onSubmit,
	onCancel,
}: {
	/** Existing warehouse when editing; absent when creating. */
	warehouse?: TWarehouseDetail;
	submitting: boolean;
	onSubmit: (input: TWarehouseCreateInput | TWarehouseUpdateInput) => void;
	onCancel: () => void;
}) {
	const { t } = useTranslation(['inventory', 'common']);
	const isEdit = warehouse != null;

	const [code, setCode] = useState(warehouse?.code ?? '');
	const [name, setName] = useState(warehouse?.name ?? '');
	const [isDefault, setIsDefault] = useState(warehouse?.isDefault ?? false);
	const [isActive, setIsActive] = useState(warehouse?.isActive ?? true);

	// Address sub-form.
	const [label, setLabel] = useState(warehouse?.address?.label ?? '');
	const [street, setStreet] = useState(warehouse?.address?.street ?? '');
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
					street,
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
		);
	}

	return (
		<form className='flex flex-col gap-6' onSubmit={handleSubmit}>
			<div>
				<h1 className='text-2xl font-bold'>
					{isEdit ? t('inventory:warehouseForm.edit') : t('inventory:warehouseForm.new')}
				</h1>
				<p className='text-sm text-muted-foreground'>
					{isEdit
						? t('inventory:warehouseForm.editDescription')
						: t('inventory:warehouseForm.newDescription')}
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('inventory:warehouseForm.details')}</CardTitle>
					<CardDescription>
						{t('inventory:warehouseForm.detailsDescription')}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='warehouse-code'>
								{t('inventory:warehouseForm.code')}
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
								{t('inventory:warehouseForm.name')}
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
						<label className='flex items-center gap-2 text-sm'>
							<Checkbox
								checked={isDefault}
								onCheckedChange={(checked) => setIsDefault(checked === true)}
							/>
							{t('inventory:warehouseForm.isDefault')}
						</label>
						<p className='text-xs text-muted-foreground'>
							{t('inventory:warehouseForm.isDefaultHint')}
						</p>
						<label className='flex items-center gap-2 text-sm'>
							<Checkbox
								checked={isActive}
								onCheckedChange={(checked) => setIsActive(checked === true)}
							/>
							{t('inventory:warehouseForm.isActive')}
						</label>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('inventory:warehouseForm.address')}</CardTitle>
					<CardDescription>
						{t('inventory:warehouseForm.addressDescription')}
					</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='warehouse-address-label'>
								{t('inventory:address.label')}
							</FieldLabel>
							<Input
								id='warehouse-address-label'
								value={label}
								onChange={(event) => setLabel(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='warehouse-address-street'>
								{t('inventory:address.street')}
							</FieldLabel>
							<Input
								id='warehouse-address-street'
								value={street}
								onChange={(event) => setStreet(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='warehouse-address-rt'>
								{t('inventory:address.rt')}
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
								{t('inventory:address.rw')}
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
								{t('inventory:address.postalCode')}
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
				</CardContent>
			</Card>

			<div className='flex gap-2'>
				<Button type='submit' disabled={submitting}>
					{submitting
						? t('inventory:warehouseForm.saving')
						: isEdit
							? t('common:action.save')
							: t('inventory:warehouseForm.create')}
				</Button>
				<Button type='button' variant='outline' onClick={onCancel}>
					{t('common:action.cancel')}
				</Button>
			</div>
		</form>
	);
}
