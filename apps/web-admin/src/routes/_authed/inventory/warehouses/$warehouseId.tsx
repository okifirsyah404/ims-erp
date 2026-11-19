import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ims-erp/ui/components/tabs';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { MapPin, PackageOpen } from 'lucide-react';
import { WarehouseAccessGate } from '@/components/inventory/warehouse-access-gate';
import { StorageDialog, useArchiveStorage } from '@/components/inventory/storage-dialog';
import { WarehouseItemTable } from '@/components/inventory/warehouse-item-table';
import { WarehouseOrganizationsTab } from '@/components/inventory/warehouse-organizations-tab';
import { WarehouseManagersTab } from '@/components/inventory/warehouse-managers-tab';
import { EmptyState } from '@/components/empty-state';
import { useWarehouseAccess } from '@/lib/use-warehouse-access';
import { warehouseQueryOptions } from '@/lib/warehouse-api';

/**
 * `/inventory/warehouses/$warehouseId` — one warehouse, read-only item tabs
 * plus the storage, organization, and person-in-charge tabs.
 */
export const Route = createFileRoute('/_authed/inventory/warehouses/$warehouseId')({
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
	const { t } = useTranslation(['inventory', 'common']);
	const { warehouseId } = useParams({ from: Route.id });
	const { isAppAdmin } = useWarehouseAccess();
	const { data: warehouse, isPending, isError } = useQuery(
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
								<CardHeader className='space-y-0 pb-2'>
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

	if (isError || !warehouse) {
		return (
			<WarehouseAccessGate>
				<p className='text-sm text-muted-foreground'>
					{t('inventory:warehouses.notFound')}
				</p>
			</WarehouseAccessGate>
		);
	}

	const stats: Array<[string, number]> = [
		[t('inventory:warehouses.products'), warehouse.productsCount],
		[t('inventory:warehouses.components'), warehouse.componentsCount],
		[t('inventory:warehouses.materials'), warehouse.materialsCount],
		[t('inventory:warehouses.equipments'), warehouse.equipmentsCount],
		[t('inventory:warehouses.storages'), warehouse.storagesCount],
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
								{t('inventory:warehouses.global')}
							</Badge>
						) : (
							<Badge variant='secondary'>
								{t('inventory:warehouses.organization')}
							</Badge>
						)}
						{warehouse.isDefault ? (
							<Badge>{t('inventory:warehouses.default')}</Badge>
						) : null}
						{!warehouse.isActive ? (
							<Badge variant='outline'>
								{t('inventory:warehouses.inactive')}
							</Badge>
						) : null}
						<Button
							variant='outline'
							render={
								<Link
									to='/inventory/warehouses/$warehouseId/edit'
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
							<CardHeader className='space-y-0 pb-2'>
								<p className='text-xs text-muted-foreground'>{label}</p>
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
						<CardTitle>{t('inventory:warehouseForm.address')}</CardTitle>
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
								title={t('inventory:warehouses.noAddressTitle')}
								description={t('inventory:warehouses.noAddress')}
								className='py-4'
							/>
						)}
					</CardContent>
				</Card>

				{/* Tabs ------------------------------------------------------- */}
				{/* Product tabs read `/inventory/products`, which is organization
				    permission-gated; a PIC grant confers no stock reads, so they
				    are hidden for anyone but an app admin. */}
				<Tabs defaultValue={isAppAdmin ? 'products' : 'storage'}>
					<TabsList>
						{isAppAdmin ? (
							<>
								<TabsTrigger value='products'>
									{t('inventory:warehouses.products')}
								</TabsTrigger>
								<TabsTrigger value='components'>
									{t('inventory:warehouses.components')}
								</TabsTrigger>
								<TabsTrigger value='materials'>
									{t('inventory:warehouses.materials')}
								</TabsTrigger>
							</>
						) : null}
						<TabsTrigger value='storage'>
							{t('inventory:warehouses.storageTab')}
						</TabsTrigger>
						{/* Organization links and person-in-charge assignment are
						    application-admin facts; a PIC has no business here. */}
						{isAppAdmin ? (
							<TabsTrigger value='organizations'>
								{t('inventory:warehouses.organizationsTab')}
							</TabsTrigger>
						) : null}
						{isAppAdmin ? (
							<TabsTrigger value='managers'>
								{t('inventory:warehouses.managersTab')}
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
	const { t } = useTranslation(['inventory', 'common']);
	const archiveStorage = useArchiveStorage(warehouseId);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<string | undefined>(undefined);
	const { data: warehouse } = useQuery(warehouseQueryOptions(warehouseId));
	const storages = warehouse?.storages ?? [];

	return (
		<Card>
			<CardContent className='flex flex-col gap-3'>
				<div className='flex items-center justify-between gap-3'>
					<span className='text-sm text-muted-foreground'>
						{t('inventory:warehouses.storages')}
					</span>
					<Button
						size='sm'
						disabled={!warehouseIsActive}
						onClick={() => {
							setEditing(undefined);
							setDialogOpen(true);
						}}
					>
						{t('inventory:warehouses.addStorage')}
					</Button>
				</div>
				{storages.length === 0 ? (
					<EmptyState
						icon={PackageOpen}
						title={t('inventory:warehouses.noStoragesTitle')}
						description={t('inventory:warehouses.noStorages')}
						className='py-4'
					/>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('inventory:warehouses.storageCode')}</TableHead>
								<TableHead>{t('inventory:warehouses.storageName')}</TableHead>
								<TableHead>{t('inventory:warehouses.binType')}</TableHead>
								<TableHead>{t('inventory:warehouses.capacity')}</TableHead>
								<TableHead>{t('inventory:warehouses.state')}</TableHead>
								<TableHead className='text-right'>
									<span className='sr-only'>{t('common:action.edit')}</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{storages.map((storage) => (
								<TableRow key={storage.id}>
									<TableCell className='font-mono text-xs'>
										{storage.code}
									</TableCell>
									<TableCell>{storage.name ?? '—'}</TableCell>
									<TableCell className='text-muted-foreground'>
										{storage.binType ?? '—'}
									</TableCell>
									<TableCell className='tabular-nums'>
										{storage.capacity ?? '—'}
									</TableCell>
									<TableCell>
										{storage.isActive ? (
											<Badge variant='secondary'>
												{t('inventory:warehouses.active')}
											</Badge>
										) : (
											<Badge variant='outline'>
												{t('inventory:warehouses.inactive')}
											</Badge>
										)}
									</TableCell>
									<TableCell className='text-right'>
										<div className='flex justify-end gap-1'>
											<Button
												variant='ghost'
												size='sm'
												onClick={() => {
													setEditing(storage.id);
													setDialogOpen(true);
												}}
											>
												{t('common:action.edit')}
											</Button>
											<Button
												variant='ghost'
												size='sm'
												disabled={archiveStorage.isPending}
												onClick={() => {
													if (window.confirm(t('inventory:warehouses.archiveConfirmTitle'))) {
														archiveStorage.mutate(storage.id);
													}
												}}
											>
												{t('inventory:detail.archive')}
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
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
