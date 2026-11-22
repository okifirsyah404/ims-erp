import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import {
	createFileRoute,
	Link,
	Outlet,
	useMatches,
	useParams,
} from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ims-erp/ui/components/tabs';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { Archive, MapPin, PackageOpen, Pencil, SearchX } from 'lucide-react';
import { RowActions } from '@/components/data-table/row-actions';
import { WarehouseAccessGate } from '@/components/inventory/warehouse-access-gate';
import { StorageDialog, useArchiveStorage } from '@/components/inventory/storage-dialog';
import { WarehouseItemTable } from '@/components/inventory/warehouse-item-table';
import { WarehouseOrganizationsTab } from '@/components/inventory/warehouse-organizations-tab';
import { WarehouseManagersTab } from '@/components/inventory/warehouse-managers-tab';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { useWarehouseAccess } from '@/lib/use-warehouse-access';
import { type TWarehouseStorage, warehouseQueryOptions } from '@/lib/warehouse-api';

/**
 * `/warehouses/$warehouseId` — one warehouse, read-only item tabs
 * plus the storage, organization, and person-in-charge tabs.
 */
export const Route = createFileRoute('/_authed/warehouses/$warehouseId')({
	component: WarehouseDetailPage,
});

function WarehouseDetailPage() {
	// Child route (edit) renders instead of the detail page; compare the last
	// match's routeId — `useChildMatches` also counts this route's own match.
	const matches = useMatches();
	const isChildActive = matches.at(-1)?.routeId !== Route.id;
	if (isChildActive) {
		return <Outlet />;
	}
	return <WarehouseDetail />;
}

function WarehouseDetail() {
	const { t } = useTranslation(['inventory', 'common', 'warehouse', 'product']);
	const { warehouseId } = useParams({ from: Route.id });
	const { isAppAdmin } = useWarehouseAccess();
	const { data: warehouse, isPending, isError, error } = useQuery(
		warehouseQueryOptions(warehouseId),
	);

	if (isPending) {
		return (
			<WarehouseAccessGate>
				<div className='flex flex-col gap-6' aria-busy='true'>
					{/* Header */}
					<div className='flex flex-wrap items-start justify-between gap-4'>
						<div className='flex flex-col gap-2'>
							<Skeleton className='h-8 w-64' />
							<Skeleton className='h-4 w-24' />
						</div>
						<Skeleton className='h-9 w-20' />
					</div>
					{/* Stats */}
					<div className='grid grid-cols-2 gap-4 sm:grid-cols-5'>
						{Array.from({ length: 5 }, (_, index) => (
							<Card key={index}>
								<CardHeader>
									<Skeleton className='h-3 w-16' />
								</CardHeader>
								<CardContent>
									<Skeleton className='h-7 w-10' />
								</CardContent>
							</Card>
						))}
					</div>
					{/* Address card */}
					<Card>
						<CardHeader>
							<Skeleton className='h-5 w-32' />
						</CardHeader>
						<CardContent>
							<Skeleton className='h-4 w-full max-w-md' />
						</CardContent>
					</Card>
					{/* Tabs */}
					<div className='flex flex-col gap-4'>
						<div className='flex gap-2'>
							{Array.from({ length: 5 }, (_, index) => (
								<Skeleton key={index} className='h-8 w-24' />
							))}
						</div>
						<Card>
							<CardContent className='flex flex-col gap-3 py-6'>
								{Array.from({ length: 4 }, (_, index) => (
									<Skeleton key={index} className='h-4 w-full' />
								))}
							</CardContent>
						</Card>
					</div>
				</div>
			</WarehouseAccessGate>
		);
	}

	if (isError) return <ErrorState error={error} bordered />;

	if (!warehouse) {
		return (
			<WarehouseAccessGate>
				<EmptyState icon={SearchX} title={t('warehouse:warehouses.notFound')} bordered />
			</WarehouseAccessGate>
		);
	}

	const stats: Array<[string, number]> = [
		[t('warehouse:warehouses.products'), warehouse.productsCount],
		[t('warehouse:warehouses.components'), warehouse.componentsCount],
		[t('warehouse:warehouses.materials'), warehouse.materialsCount],
		[t('warehouse:warehouses.equipments'), warehouse.equipmentsCount],
		[t('warehouse:warehouses.storages'), warehouse.storagesCount],
	];

	return (
		<WarehouseAccessGate>
			<div className='flex flex-col gap-6'>
				<div className='flex flex-wrap items-start justify-between gap-4'>
					<div>
						<h1 className='text-2xl font-bold'>{warehouse.name}</h1>
						<p className='font-mono text-sm text-muted-foreground'>
							{warehouse.code}
						</p>
					</div>
					<div className='flex shrink-0 items-center gap-2'>
						{warehouse.organizationId === null ? (
							<Badge variant='outline'>
								{t('warehouse:warehouses.global')}
							</Badge>
						) : (
							<Badge variant='secondary'>
								{t('warehouse:warehouses.organization')}
							</Badge>
						)}
						{warehouse.isDefault ? (
							<Badge>{t('warehouse:warehouses.default')}</Badge>
						) : null}
						{!warehouse.isActive ? (
							<Badge variant='outline'>
								{t('warehouse:warehouses.inactive')}
							</Badge>
						) : null}
						<Button
							variant='outline'
							render={
								<Link
									to='/warehouses/$warehouseId/edit'
									params={{ warehouseId }}
								/>
							}
						>
							{t('common:action.edit')}
						</Button>
					</div>
				</div>

				{/* Stats ------------------------------------------------------ */}
				<div className='grid grid-cols-2 gap-4 sm:grid-cols-5'>
					{stats.map(([label, value]) => (
						<Card key={label}>
							<CardHeader>
								<CardTitle className='text-sm font-medium text-muted-foreground'>
									{label}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className='text-2xl font-bold tabular-nums'>{value}</p>
							</CardContent>
						</Card>
					))}
				</div>

				{/* Meta ------------------------------------------------------- */}
				<Card>
					<CardHeader>
						<CardTitle>{t('warehouse:warehouseForm.address')}</CardTitle>
					</CardHeader>
					<CardContent className='text-sm'>
						{warehouse.address ? (
							<p className='text-muted-foreground'>
								{[
									warehouse.address.addressLine,
									warehouse.address.rt && `RT ${warehouse.address.rt}`,
									warehouse.address.rw && `RW ${warehouse.address.rw}`,
									warehouse.address.postalCode,
								]
									.filter(Boolean)
									.join(' ')}
							</p>
						) : (
							<EmptyState
								icon={MapPin}
								title={t('warehouse:warehouses.noAddressTitle')}
								description={t('warehouse:warehouses.noAddress')}
								className='py-4'
							/>
						)}
					</CardContent>
				</Card>

				{/* Tabs ------------------------------------------------------- */}
				{/* Product tabs read `/products`, which is organization
				    permission-gated; a PIC grant confers no stock reads, so they
				    are hidden for anyone but an app admin. */}
				<Tabs defaultValue={isAppAdmin ? 'products' : 'storage'}>
					<TabsList>
						{isAppAdmin ? (
							<>
								<TabsTrigger value='products'>
									{t('warehouse:warehouses.products')}
								</TabsTrigger>
								<TabsTrigger value='components'>
									{t('warehouse:warehouses.components')}
								</TabsTrigger>
								<TabsTrigger value='materials'>
									{t('warehouse:warehouses.materials')}
								</TabsTrigger>
							</>
						) : null}
						<TabsTrigger value='storage'>
							{t('warehouse:warehouses.storageTab')}
						</TabsTrigger>
						{/* Organization links and person-in-charge assignment are
						    application-admin facts; a PIC has no business here. */}
						{isAppAdmin ? (
							<TabsTrigger value='organizations'>
								{t('warehouse:warehouses.organizationsTab')}
							</TabsTrigger>
						) : null}
						{isAppAdmin ? (
							<TabsTrigger value='managers'>
								{t('warehouse:warehouses.managersTab')}
							</TabsTrigger>
						) : null}
					</TabsList>
					<TabsContent value='products'>
						{isAppAdmin ? (
							<WarehouseItemTable warehouseId={warehouseId} itemKind='product' />
						) : null}
					</TabsContent>
					<TabsContent value='components'>
						{isAppAdmin ? (
							<WarehouseItemTable warehouseId={warehouseId} itemKind='component' />
						) : null}
					</TabsContent>
					<TabsContent value='materials'>
						{isAppAdmin ? (
							<WarehouseItemTable warehouseId={warehouseId} itemKind='material' />
						) : null}
					</TabsContent>
					<TabsContent value='storage'>
						<StorageTab
							warehouseId={warehouseId}
							warehouseIsActive={warehouse.isActive}
						/>
					</TabsContent>
					<TabsContent value='organizations'>
						{isAppAdmin ? (
							<WarehouseOrganizationsTab warehouseId={warehouseId} />
						) : null}
					</TabsContent>
					<TabsContent value='managers'>
						{isAppAdmin ? (
							<WarehouseManagersTab warehouseId={warehouseId} />
						) : null}
					</TabsContent>
				</Tabs>
			</div>
		</WarehouseAccessGate>
	);
}

/**
 * The storage tab: bins table plus create/edit/archive actions.
 *
 * @remarks
 * The only managed tab — items are read-only here by design; their home is
 * the item master pages. Create is disabled when the warehouse is inactive
 * (the backend rejects it with `inventory.warehouseInactive`); archiving a
 * bin stays available for both active and inactive warehouses.
 */
function StorageTab({
	warehouseId,
	warehouseIsActive,
}: {
	warehouseId: string;
	warehouseIsActive: boolean;
}) {
	const { t } = useTranslation(['inventory', 'common', 'warehouse', 'product']);
	const archiveStorage = useArchiveStorage(warehouseId);
	const confirm = useConfirm();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<string | undefined>(undefined);
	const { data: warehouse } = useQuery(warehouseQueryOptions(warehouseId));
	const storages = warehouse?.storages ?? [];

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TWarehouseStorage, CellData>[]
	>(
		() => [
			{
				accessorKey: 'code',
				header: t('warehouse:warehouses.storageCode'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				id: 'name',
				header: t('warehouse:warehouses.storageName'),
				cell: ({ row }) => row.original.name ?? '—',
			},
			{
				id: 'binType',
				header: t('warehouse:warehouses.binType'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => row.original.binType ?? '—',
			},
			{
				id: 'capacity',
				header: t('warehouse:warehouses.capacity'),
				meta: { cellClassName: 'tabular-nums' },
				cell: ({ row }) => row.original.capacity ?? '—',
			},
			{
				id: 'state',
				header: t('warehouse:warehouses.state'),
				cell: ({ row }) =>
					row.original.isActive ? (
						<Badge variant='secondary'>
							{t('warehouse:warehouses.active')}
						</Badge>
					) : (
						<Badge variant='outline'>
							{t('warehouse:warehouses.inactive')}
						</Badge>
					),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('common:action.actions')}
						actions={[
							{
								key: 'edit',
								label: t('common:action.edit'),
								icon: Pencil,
								onSelect: () => {
									setEditing(row.original.id);
									setDialogOpen(true);
								},
							},
							{
								key: 'archive',
								label: t('product:detail.archive'),
								icon: Archive,
								destructive: true,
								disabled: archiveStorage.isPending,
								onSelect: async () => {
									if (
										await confirm({
											title: t('warehouse:warehouses.archiveConfirmTitle'),
											destructive: true,
										})
									) {
										archiveStorage.mutate(row.original.id);
									}
								},
							},
						]}
					/>
				),
			},
		],
		[archiveStorage, confirm, t],
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('warehouse:warehouses.storages')}</CardTitle>
				<CardAction>
					<Button
						size='sm'
						disabled={!warehouseIsActive}
						onClick={() => {
							setEditing(undefined);
							setDialogOpen(true);
						}}
					>
						{t('warehouse:warehouses.addStorage')}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				{storages.length === 0 ? (
					<EmptyState
						icon={PackageOpen}
						title={t('warehouse:warehouses.noStoragesTitle')}
						description={t('warehouse:warehouses.noStorages')}
						className='py-4'
					/>
				) : (
					<DataTable
						columns={columns}
						data={storages}
						getRowId={(storage) => storage.id}
						sortable
					/>
				)}
			</CardContent>
			<StorageDialog
				warehouseId={warehouseId}
				storage={
					editing
						? storages.find((storage) => storage.id === editing)
						: undefined
				}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</Card>
	);
}
