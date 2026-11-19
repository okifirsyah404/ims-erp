import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { NativeSelect } from '@ims-erp/ui/components/native-select';
import { CircleAlert, Wrench } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	assetDepreciationsQueryOptions,
	assetDetailQueryOptions,
	formatMoney,
	placeAsset,
	transferAsset,
	type TAssetCore,
} from '@/lib/asset-api';
import { linkedWarehousesQueryOptions } from '@/lib/warehouse-api';
import { usePermission } from '@/lib/use-permission';

/**
 * Asset detail (Phase A-4): stats, location, and history sections
 * (movements, condition checks, service records, depreciation, documents).
 * Actions: place/transfer location, deactivate/reactivate, dispose.
 */
export function AssetDetail({ assetId }: { assetId: string }) {
	const { t } = useTranslation(['assets', 'common']);
	const canUpdate = usePermission('asset.update');
	const canDispose = usePermission('asset.dispose');

	const { data, isPending, isError, error } = useQuery({
		...assetDetailQueryOptions(assetId),
		placeholderData: (previous) => previous,
	});
	// Depreciation is finance-owned now, so it is its own endpoint.
	const depreciations = useQuery(assetDepreciationsQueryOptions(assetId));

	if (isError) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('assets:detail.title')}
				description={error.message}
			/>
		);
	}

	if (isPending || !data) {
		return (
			<Card className='animate-pulse'>
				<CardHeader>
					<CardTitle className='h-6 w-1/3 rounded bg-muted' />
				</CardHeader>
				<CardContent className='h-40 rounded bg-muted' />
			</Card>
		);
	}

	// The history endpoint answers `null` for a unit unknown to this tenant.
	if (data === null) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('assets:detail.title')}
				description={t('assets:detail.notFound')}
			/>
		);
	}

	const { item: asset, history } = data;

	return (
		<div className='space-y-6'>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold'>{asset.name}</h1>
					<p className='font-mono text-xs text-muted-foreground'>
						{asset.code}
					</p>
				</div>
				<div className='flex flex-wrap gap-2'>
					{canUpdate && asset.status === 'ready' ? (
						<Button render={<Link to='/assets/borrowings/new' />} variant='outline'>
							{t('assets:detail.borrow')}
						</Button>
					) : null}
					{canUpdate && asset.status !== 'inactive' && asset.deletedAt === null ? (
						<Button
							render={<Link to='/assets/register' />}
							variant='outline'
						>
							{t('assets:detail.deactivate')}
						</Button>
					) : null}
					{canDispose && asset.status !== 'disposed' && asset.deletedAt === null ? (
						<Button render={<Link to='/assets/disposals' />} variant='outline'>
							{t('assets:detail.dispose')}
						</Button>
					) : null}
				</div>
			</div>

			<div className='grid gap-4 sm:grid-cols-3'>
				<Card>
					<CardHeader className='pb-2'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>
							{t('assets:register.status')}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<Badge variant='secondary'>
							{t(`assets:status.${asset.status}`)}
						</Badge>
						{asset.status === 'inactive' && asset.deactivationReason ? (
							<p className='mt-2 text-xs text-muted-foreground'>
								{asset.deactivationReason}
							</p>
						) : null}
					</CardContent>
				</Card>
				<Card>
					<CardHeader className='pb-2'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>
							{t('assets:register.bookValue')}
						</CardTitle>
					</CardHeader>
					<CardContent className='text-lg font-semibold'>
						{formatMoney(asset.bookValue, asset.currencyCode)}
					</CardContent>
				</Card>
				<Card>
					<CardHeader className='pb-2'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>
							{t('assets:register.condition')}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{t(`assets:condition.${asset.condition}`)}
					</CardContent>
				</Card>
			</div>

			{/* Location --------------------------------------------------- */}
			<LocationCard assetId={asset.id} asset={asset} canUpdate={canUpdate} />

			{/* History sections ------------------------------------------- */}
			<div className='grid gap-6 lg:grid-cols-2'>
				<HistorySection
					title={t('assets:detail.movements')}
					empty={t('assets:detail.noHistory')}
					rows={history.movements.map((movement) => ({
						id: movement.id,
						left: t(
							`assets:movementType.${movement.movementType}` as 'assets:movementType.receipt',
						),
						right: movement.toLocation ?? '—',
					}))}
				/>
				<HistorySection
					title={t('assets:detail.conditionChecks')}
					empty={t('assets:detail.noHistory')}
					rows={history.conditionChecks.map((check) => ({
						id: check.id,
						left: `${check.checkDate} · ${t(`assets:condition.${check.condition}`)}`,
						right: check.findings ?? '—',
					}))}
				/>
				<HistorySection
					title={t('assets:detail.maintenances')}
					empty={t('assets:detail.noHistory')}
					rows={history.maintenances.map((maintenance) => ({
						id: maintenance.id,
						left: `${maintenance.code} · ${t(`assets:maintenanceType.${maintenance.maintenanceType}`)}`,
						right: formatMoney(maintenance.cost, maintenance.currencyCode),
					}))}
				/>
				<HistorySection
					title={t('assets:detail.depreciations')}
					empty={t('assets:detail.noHistory')}
					rows={(depreciations.data?.rows ?? []).map((entry) => ({
						id: entry.id,
						left: `${entry.periodYear}-${String(entry.periodMonth).padStart(2, '0')}`,
						right: formatMoney(entry.depreciationAmount, entry.currencyCode),
					}))}
				/>
				<HistorySection
					title={t('assets:detail.documents')}
					empty={t('assets:detail.noHistory')}
					rows={history.documents.map((document) => ({
						id: document.id,
						left: document.documentType,
						right: document.fileName,
					}))}
				/>
			</div>
			<Wrench className='hidden' />
		</div>
	);
}

/** Current warehouse/storage plus the place/transfer actions (D3). */
function LocationCard({
	assetId,
	asset,
	canUpdate,
}: {
	assetId: string;
	asset: TAssetCore;
	canUpdate: boolean;
}) {
	const { t } = useTranslation(['assets', 'common']);
	const [mode, setMode] = useState<'place' | 'transfer' | null>(null);
	// ERP-0031: linked warehouses are the member-facing source — the admin
	// warehouse list is application-admin-only.
	const warehouses = useQuery({
		...linkedWarehousesQueryOptions(),
		enabled: canUpdate,
	});
	const current = (warehouses.data ?? []).find(
		(row) => row.id === asset.warehouseId,
	);
	const warehouseName = current?.name ?? asset.warehouseId ?? undefined;
	const storageName = current?.storages.find(
		(row) => row.id === asset.storageId,
	)?.name;

	return (
		<Card>
			<CardHeader className='flex flex-row items-start justify-between gap-2'>
				<CardTitle className='text-sm'>{t('assets:register.location')}</CardTitle>
				{canUpdate && asset.status === 'ready' ? (
					<div className='flex gap-2'>
						<Button
							size='sm'
							variant='outline'
							onClick={() => setMode('place')}
						>
							{t('assets:detail.place')}
						</Button>
						<Button
							size='sm'
							variant='outline'
							disabled={asset.warehouseId === null}
							onClick={() => setMode('transfer')}
						>
							{t('assets:detail.transfer')}
						</Button>
					</div>
				) : null}
			</CardHeader>
			<CardContent className='space-y-1 text-sm'>
				<p>
					{warehouseName ??
						asset.warehouseId ??
						t('assets:detail.noWarehouse')}
					{storageName ? ` · ${storageName}` : ''}
				</p>
				{asset.locationDescription ? (
					<p className='text-muted-foreground'>{asset.locationDescription}</p>
				) : null}
			</CardContent>
			{mode ? (
				<LocationDialog
					assetId={assetId}
					mode={mode}
					defaultWarehouseId={asset.warehouseId ?? ''}
					onClose={() => setMode(null)}
				/>
			) : null}
		</Card>
	);
}

/** Warehouse -> storage picker, submitting either `place` or `transfer`. */
function LocationDialog({
	assetId,
	mode,
	defaultWarehouseId,
	onClose,
}: {
	assetId: string;
	mode: 'place' | 'transfer';
	defaultWarehouseId: string;
	onClose: () => void;
}) {
	const { t } = useTranslation(['assets', 'common']);
	const queryClient = useQueryClient();
	const warehouses = useQuery(linkedWarehousesQueryOptions());
	const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
	const [storageId, setStorageId] = useState('');
	const current = (warehouses.data ?? []).find(
		(row) => row.id === warehouseId,
	);

	const save = useMutation({
		mutationFn: () =>
			mode === 'place'
				? placeAsset(assetId, {
						warehouseId,
						storageId: storageId || null,
					})
				: transferAsset(assetId, {
						toWarehouseId: warehouseId,
						toStorageId: storageId || null,
					}),
		onSuccess: async () => {
			toast.success(
				mode === 'place' ? t('assets:detail.placed') : t('assets:detail.transferred'),
			);
			await queryClient.invalidateQueries({ queryKey: ['assets'] });
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{mode === 'place'
							? t('assets:detail.place')
							: t('assets:detail.transfer')}
					</DialogTitle>
					<DialogDescription>
						{t('assets:detail.locationDescription')}
					</DialogDescription>
				</DialogHeader>
				<div className='space-y-3'>
					<NativeSelect
						value={warehouseId}
						onChange={(event) => {
							setWarehouseId(event.target.value);
							setStorageId('');
						}}
					>
						<option value=''>{t('assets:detail.selectWarehouse')}</option>
						{(warehouses.data ?? []).map((row) => (
							<option key={row.id} value={row.id}>
								{row.code} · {row.name}
							</option>
						))}
					</NativeSelect>
					<NativeSelect
						value={storageId}
						onChange={(event) => setStorageId(event.target.value)}
					>
						<option value=''>{t('assets:detail.selectStorage')}</option>
						{(current?.storages ?? []).map((row) => (
							<option key={row.id} value={row.id}>
								{row.code} · {row.name}
							</option>
						))}
					</NativeSelect>
				</div>
				<DialogFooter>
					<Button variant='ghost' onClick={onClose}>
						{t('assets:form.cancel')}
					</Button>
					<Button
						disabled={warehouseId === '' || save.isPending}
						onClick={() => save.mutate()}
					>
						{t('assets:form.save')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** A titled list of two-column history rows. */
function HistorySection({
	title,
	empty,
	rows,
}: {
	title: string;
	empty: string;
	rows: Array<{ id: string; left: string; right: string }>;
}) {
	return (
		<Card>
			<CardHeader className='pb-2'>
				<CardTitle className='text-sm'>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className='text-sm text-muted-foreground'>{empty}</p>
				) : (
					<ul className='space-y-1 text-sm'>
						{rows.map((row) => (
							<li
								key={row.id}
								className='flex items-center justify-between gap-2 border-b py-1 last:border-b-0'
							>
								<span>{row.left}</span>
								<span className='text-muted-foreground'>{row.right}</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
