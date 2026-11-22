import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { toast } from '@/components/toast';
import { uploadDocumentImage } from '@/lib/document-image-api';
import {
	createWarehouse,
	type TWarehouseCreateInput,
	type TWarehouseUpdateInput,
} from '@/lib/warehouse-api';
import { WarehouseForm } from './warehouse-form';

/**
 * Create-warehouse dialog, opened from the warehouse list.
 *
 * @remarks
 * Application admins only: the caller gates the trigger, the backend enforces
 * it. The form only mounts while the dialog is open, so every open starts blank.
 * The photo is uploaded right after the warehouse exists (the endpoint is
 * id-scoped); a failed upload reports an error but keeps the new warehouse.
 */
export function CreateWarehouseDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{open && <CreateWarehouseDialogBody onOpenChange={onOpenChange} />}
		</Dialog>
	);
}

function CreateWarehouseDialogBody({
	onOpenChange,
}: {
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation(['inventory', 'common', 'warehouse']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(
		input: TWarehouseCreateInput | TWarehouseUpdateInput,
		imageFile?: File | null,
	) {
		setSubmitting(true);
		try {
			const created = await createWarehouse(input as TWarehouseCreateInput);
			if (created && imageFile) {
				try {
					await uploadDocumentImage(`/warehouses/${created.id}/image`, imageFile);
				} catch (error) {
					toast.error(
						error instanceof Error ? error.message : t('common:error.failed'),
					);
				}
			}
			toast.success(t('warehouse:warehouseForm.created'));
			await queryClient.invalidateQueries({ queryKey: ['warehouses'] });
			onOpenChange(false);
			if (created) {
				void navigate({
					to: '/warehouses/$warehouseId',
					params: { warehouseId: created.id },
				});
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
			<DialogHeader>
				<DialogTitle>{t('warehouse:warehouseForm.new')}</DialogTitle>
				<DialogDescription>
					{t('warehouse:warehouseForm.newDescription')}
				</DialogDescription>
			</DialogHeader>
			<WarehouseForm
				compact
				submitting={submitting}
				onSubmit={(input, imageFile) => void handleSubmit(input, imageFile)}
				onCancel={() => onOpenChange(false)}
			/>
		</DialogContent>
	);
}
