import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
	assetTypesQueryOptions,
	createAsset,
	updateAsset,
	type TAsset,
	type TAssetType,
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
	asset?: TAsset;
	/** Called after a successful save instead of navigating (dialog usage). */
	onSuccess?: () => void;
	/** Called by Cancel instead of navigating (dialog usage). */
	onCancel?: () => void;
	/** Drops the page heading, for the create dialog. */
	compact?: boolean;
}) {
	const { t } = useTranslation('assets');
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [name, setName] = useState(asset?.name ?? '');
	const [assetType, setAssetType] = useState<TAssetType>(asset?.assetType ?? 'equipment');
	const types = useQuery(assetTypesQueryOptions());
	const [serialNumber, setSerialNumber] = useState(asset?.serialNumber ?? '');
	const [acquisitionCost, setAcquisitionCost] = useState(
		String(asset?.acquisitionCost ?? '0'),
	);
	const [acquisitionDate, setAcquisitionDate] = useState(
		asset?.acquisitionDate ?? '',
	);
	const [location, setLocation] = useState(asset?.locationDescription ?? '');

	const save = useMutation({
		mutationFn: () => {
			const payload = {
				name,
				assetType,
				serialNumber: serialNumber || null,
				acquisitionCost: Number(acquisitionCost) || 0,
				acquisitionDate: acquisitionDate || null,
				locationDescription: location || null,
			};
			return asset
				? updateAsset(asset.id, payload)
				: createAsset(payload);
		},
		onSuccess: async () => {
			toast.success(asset ? t('updated') : t('created'));
			await queryClient.invalidateQueries({ queryKey: ['assets'] });
			if (onSuccess) onSuccess();
			else void navigate({ to: '/assets/register' });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	return (
		<div className='mx-auto max-w-xl space-y-4'>
			{compact ? null : (
				<div>
					<h1 className='text-xl font-semibold'>
						{asset ? t('form.editAsset') : t('form.newAsset')}
					</h1>
					<p className='text-sm text-muted-foreground'>
						{asset
							? t('form.editAssetDescription')
							: t('form.newAssetDescription')}
					</p>
				</div>
			)}
			<Card>
				<CardHeader>
					<CardTitle className='text-sm'>
						{t('register.name')}
					</CardTitle>
				</CardHeader>
				<CardContent className='space-y-3'>
					<Input
						placeholder={t('register.name')}
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
					<Select
						value={assetType}
						onValueChange={(value: string | null) => setAssetType(value as TAssetType)}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(types.data ?? []).map((type) => (
								<SelectItem key={type.code} value={type.code}>
									{type.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						placeholder={t('register.serialNumber')}
						value={serialNumber}
						onChange={(event) => setSerialNumber(event.target.value)}
					/>
					<Input
						type='number'
						placeholder={t('register.acquisitionCost')}
						value={acquisitionCost}
						onChange={(event) => setAcquisitionCost(event.target.value)}
					/>
					<DatePicker
						value={acquisitionDate}
						onChange={setAcquisitionDate}
					/>
					<Input
						placeholder={t('register.location')}
						value={location}
						onChange={(event) => setLocation(event.target.value)}
					/>
				</CardContent>
			</Card>
			<div className='flex justify-end gap-2'>
				<Button
					variant='outline'
					onClick={() =>
						onCancel ? onCancel() : void navigate({ to: '/assets/register' })
					}
				>
					{t('form.cancel')}
				</Button>
				<Button
					disabled={!name || save.isPending}
					onClick={() => void save.mutateAsync()}
				>
					{save.isPending
						? asset
							? t('form.saving')
							: t('form.creating')
						: asset
							? t('form.save')
							: t('form.create')}
				</Button>
			</div>
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
