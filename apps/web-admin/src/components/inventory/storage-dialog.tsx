import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import {
	Field,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { toast } from '@/components/toast';
import {
	archiveStorage,
	createStorage,
	updateStorage,
	type TWarehouseStorage,
} from '@/lib/warehouse-api';

/**
 * Create-or-edit storage dialog.
 *
 * @remarks
 * One dialog for both modes: `storage` present means edit (code immutable),
 * absent means create. The backend enforces the same rules — unique code per
 * warehouse and no writes into an inactive warehouse — and their messages
 * surface here as toasts via the thrown Error.
 */
export function StorageDialog({
	warehouseId,
	storage,
	open,
	onOpenChange,
}: {
	warehouseId: string;
	storage?: TWarehouseStorage;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation(['inventory', 'common']);
	const queryClient = useQueryClient();
	const isEdit = storage !== undefined;

	const [code, setCode] = useState(storage?.code ?? '');
	const [name, setName] = useState(storage?.name ?? '');
	const [binType, setBinType] = useState(storage?.binType ?? '');
	const [capacity, setCapacity] = useState(storage?.capacity ?? '');
	const [isActive, setIsActive] = useState(storage?.isActive ?? true);
	const [submitting, setSubmitting] = useState(false);

	// Resync the fields whenever a different storage opens.
	useEffect(() => {
		if (open) {
			setCode(storage?.code ?? '');
			setName(storage?.name ?? '');
			setBinType(storage?.binType ?? '');
			setCapacity(storage?.capacity ?? '');
			setIsActive(storage?.isActive ?? true);
		}
	}, [open, storage]);

	async function handleSubmit() {
		setSubmitting(true);
		try {
			if (isEdit && storage) {
				await updateStorage(warehouseId, storage.id, {
					name: name || null,
					binType: binType || null,
					capacity: capacity || null,
					isActive,
				});
				toast.success(t('inventory:warehouses.storageUpdated'));
			} else {
				await createStorage(warehouseId, {
					code,
					name: name || null,
					binType: binType || null,
					capacity: capacity || null,
					isActive,
				});
				toast.success(t('inventory:warehouses.storageCreated'));
			}
			await queryClient.invalidateQueries({ queryKey: ['warehouses'] });
			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isEdit
							? t('inventory:warehouses.editStorage')
							: t('inventory:warehouses.addStorage')}
					</DialogTitle>
					<DialogDescription>
						{storage?.code ? (
							<span className='font-mono'>{storage.code}</span>
						) : (
							t('inventory:warehouses.storageCodeHint')
						)}
					</DialogDescription>
				</DialogHeader>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						void handleSubmit();
					}}
				>
					<Field>
						<FieldLabel>{t('inventory:warehouses.storageCode')}</FieldLabel>
						<Input
							value={code}
							onChange={(event) => setCode(event.target.value)}
							disabled={isEdit}
							required
							maxLength={32}
						/>
					</Field>
					<Field>
						<FieldLabel>{t('inventory:warehouses.storageName')}</FieldLabel>
						<Input
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel>{t('inventory:warehouses.binType')}</FieldLabel>
						<Input
							value={binType}
							onChange={(event) => setBinType(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel>{t('inventory:warehouses.capacity')}</FieldLabel>
						<Input
							type='number'
							min='0'
							step='0.001'
							value={capacity}
							onChange={(event) => setCapacity(event.target.value)}
						/>
					</Field>
					<Field orientation='horizontal'>
						<Checkbox
							id='storage-is-active'
							checked={isActive}
							onCheckedChange={(checked) => setIsActive(checked === true)}
						/>
						<FieldLabel htmlFor='storage-is-active'>
							{t('inventory:warehouseForm.isActive')}
						</FieldLabel>
					</Field>
					<DialogFooter>
						<Button
							type='button'
							variant='outline'
							onClick={() => onOpenChange(false)}
						>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting}>
							{isEdit ? t('common:action.save') : t('inventory:warehouses.addStorage')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Archive-storage helper hook.
 *
 * @remarks
 * Small enough to inline at one call site, kept as a hook so the storage
 * tab stays declarative about its mutations.
 */
export function useArchiveStorage(warehouseId: string) {
	const { t } = useTranslation(['inventory', 'common']);
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (storageId: string) => archiveStorage(warehouseId, storageId),
		onSuccess: async () => {
			toast.success(t('inventory:warehouses.storageArchived'));
			await queryClient.invalidateQueries({ queryKey: ['warehouses'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});
}
