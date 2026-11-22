import { MoneyInput } from '@/components/money-input';
import { ImageDropzone } from '@/components/image-dropzone';
import { uploadDocumentImage } from '@/lib/document-image-api';
import { minorToRupiah, rupiahToMinor } from '@/lib/format';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/components/toast';
import {
	createAsset,
	ITEM_KINDS,
	updateAsset,
	type TAssetCore,
	type TItemKind,
} from '@/lib/asset-api';

/**
 * Create/edit asset form (Phase A-4). Create posts the manual acquisition
 * fields; the code is allocated server-side. Edit omits server-owned
 * columns (code, status, valuation).
 */
export function AssetForm({
	asset,
	onSuccess,
	onCancel,
	compact = false,
}: {
	asset?: TAssetCore;
	/** Called after a successful save instead of navigating (dialog usage). */
	onSuccess?: () => void;
	/** Called by Cancel instead of navigating (dialog usage). */
	onCancel?: () => void;
	/** Drops the page heading, for the create dialog. */
	compact?: boolean;
}) {
	const { t } = useTranslation(['assets', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [name, setName] = useState(asset?.name ?? '');
	const [itemKind, setItemKind] = useState<TItemKind>(asset?.itemKind ?? 'equipment');
	const [serialNumber, setSerialNumber] = useState(asset?.serialNumber ?? '');
	const [acquisitionCost, setAcquisitionCost] = useState(
		minorToRupiah(asset?.acquisitionCost ?? 0),
	);
	// Create only: the photo endpoint is id-scoped, so the picked file is
	// uploaded right after the asset exists.
	const [imageFile, setImageFile] = useState<File | null>(null);
	const imagePreviewUrl = useMemo(
		() => (imageFile ? URL.createObjectURL(imageFile) : null),
		[imageFile],
	);
	useEffect(() => {
		if (!imagePreviewUrl) return;
		return () => URL.revokeObjectURL(imagePreviewUrl);
	}, [imagePreviewUrl]);
	const [acquisitionDate, setAcquisitionDate] = useState(
		asset?.acquisitionDate ?? '',
	);
	const [location, setLocation] = useState(asset?.locationDescription ?? '');

	const save = useMutation({
		mutationFn: async () => {
			const payload = {
				name,
				serialNumber: serialNumber || null,
				acquisitionCost: rupiahToMinor(acquisitionCost),
				acquisitionDate: acquisitionDate || null,
				locationDescription: location || null,
			};
			// The kind is fixed at registration; the update contract has no field for it.
			if (asset) return updateAsset(asset.id, payload);
			const created = await createAsset({ ...payload, itemKind });
			// A failed photo upload must not lose the asset that was just created.
			if (imageFile) {
				try {
					await uploadDocumentImage(`/inventory/items/${created.id}/image`, imageFile);
				} catch (error) {
					toast.error(error instanceof Error ? error.message : t('common:error.failed'));
				}
			}
			return created;
		},
		onSuccess: async () => {
			toast.success(asset ? t('updated') : t('created'));
			await queryClient.invalidateQueries({ queryKey: ['assets'] });
			if (onSuccess) onSuccess();
			else void navigate({ to: '/assets/register' });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const fields = (
		<>
			<Input
				placeholder={t('register.name')}
				value={name}
				onChange={(event) => setName(event.target.value)}
			/>
			<Select
				value={itemKind}
				disabled={asset !== undefined}
				onValueChange={(value: string | null) => setItemKind(value as TItemKind)}
			>
				<SelectTrigger>
					<SelectValue>
						{(value: string | null) =>
							value ? t(`itemKind.${value as TItemKind}`) : null
						}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{ITEM_KINDS.map((kind) => (
						<SelectItem key={kind} value={kind}>
							{t(`itemKind.${kind}`)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Input
				placeholder={t('register.serialNumber')}
				value={serialNumber}
				onChange={(event) => setSerialNumber(event.target.value)}
			/>
			<MoneyInput
				placeholder={t('register.acquisitionCost')}
				value={acquisitionCost}
				onValueChange={setAcquisitionCost}
			/>
			<DatePicker value={acquisitionDate} onChange={setAcquisitionDate} />
			<Input
				placeholder={t('register.location')}
				value={location}
				onChange={(event) => setLocation(event.target.value)}
			/>
		</>
	);

	const actions = (
		<>
			<Button
				variant='outline'
				onClick={() => (onCancel ? onCancel() : void navigate({ to: '/assets/register' }))}
			>
				{t('form.cancel')}
			</Button>
			<Button disabled={!name || save.isPending} onClick={() => void save.mutateAsync()}>
				{save.isPending
					? asset
						? t('form.saving')
						: t('form.creating')
					: asset
						? t('form.save')
						: t('form.create')}
			</Button>
		</>
	);

	// Inside a dialog the dialog is the surface: no card, and the shared sticky
	// `DialogFooter` keeps the actions visible while the form scrolls.
	if (compact) {
		return (
			<div className='flex flex-col gap-4'>
				{!asset && (
					<div className='flex flex-col items-center gap-2'>
						<ImageDropzone
							previewUrl={imagePreviewUrl}
							disabled={save.isPending}
							label={t('register.photo')}
							hint={t('common:image.drop')}
							onSelect={setImageFile}
							onReject={(reason) =>
								toast.error(
									t(reason === 'size' ? 'common:image.sourceTooLarge' : 'common:image.wrongType'),
								)
							}
						/>
						{imageFile && (
							<>
								<p className='max-w-full truncate text-xs leading-snug text-muted-foreground'>
									{imageFile.name}
								</p>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									disabled={save.isPending}
									onClick={() => setImageFile(null)}
								>
									{t('common:image.remove')}
								</Button>
							</>
						)}
					</div>
				)}
				<div className='flex flex-col gap-3'>{fields}</div>
				<DialogFooter>{actions}</DialogFooter>
			</div>
		);
	}

	return (
		<div className='mx-auto max-w-xl space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>
					{asset ? t('form.editAsset') : t('form.newAsset')}
				</h1>
				<p className='text-sm text-muted-foreground'>
					{asset ? t('form.editAssetDescription') : t('form.newAssetDescription')}
				</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle className='text-sm'>{t('register.name')}</CardTitle>
				</CardHeader>
				<CardContent className='space-y-3'>{fields}</CardContent>
				<CardFooter className='justify-end gap-2'>{actions}</CardFooter>
			</Card>
		</div>
	);
}

/** Deactivate-with-reason dialog (D18) — used by the register detail page. */
export function DeactivateAssetDialog({
	assetId,
	onClose,
}: {
	assetId: string;
	onClose: () => void;
}) {
	const { t } = useTranslation('assets');
	const queryClient = useQueryClient();
	const [reason, setReason] = useState('');

	const deactivate = useMutation({
		mutationFn: async () => {
			const { deactivateAsset } = await import('@/lib/asset-api');
			return deactivateAsset(assetId, reason);
		},
		onSuccess: async () => {
			toast.success(t('deactivated'));
			onClose();
			await queryClient.invalidateQueries({ queryKey: ['assets'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('form.deactivateTitle')}</DialogTitle>
					<DialogDescription>{t('form.deactivateDescription')}</DialogDescription>
				</DialogHeader>
				<Input
					placeholder={t('form.reasonPlaceholder')}
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
				<DialogFooter>
					<Button variant='outline' onClick={onClose}>
						{t('form.cancel')}
					</Button>
					<Button
						disabled={!reason || deactivate.isPending}
						onClick={() => void deactivate.mutateAsync()}
					>
						{deactivate.isPending ? t('form.deactivating') : t('form.deactivate')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
