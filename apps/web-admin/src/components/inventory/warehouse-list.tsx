import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Input } from '@ims-erp/ui/components/input';
import { CircleAlert, Warehouse } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	archiveWarehouse,
	updateWarehouse,
	warehousesQueryOptions,
	type TWarehouseWithCounts,
} from '@/lib/warehouse-api';

/** The route API for `/inventory/warehouses` (validated search params). */
const routeApi = getRouteApi('/_authed/inventory/warehouses/');

/** Rows per page. A card grid is wider than a table, so fewer per page. */
const PAGE_SIZE = 12;

/**
 * The warehouse list.
 *
 * @remarks
 * Card grid modeled on the organizations page: one card per warehouse with
 * scope/status badges and the backend-computed kind counts, plus URL-backed
 * search, an include-archived toggle, and server-side pagination. The only
 * callers are application administrators, so every scope is shown at once —
 * the scope badge tells them apart.
 */
export function WarehouseList() {
	const { t } = useTranslation(['inventory', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const [searchDraft, setSearchDraft] = useState(search.search ?? '');

	const page = search.page ?? 1;

	const { data, isPending, isError, error } = useQuery({
		...warehousesQueryOptions({
			page,
			limit: PAGE_SIZE,
			search: search.search,
			includeArchived: search.includeArchived,
		}),
		placeholderData: (previous) => previous,
	});

	const archive = useMutation({
		mutationFn: (warehouseId: string) => archiveWarehouse(warehouseId),
		onSuccess: async () => {
			toast.success(t('inventory:warehouses.archived'));
			await queryClient.invalidateQueries({ queryKey: ['warehouses'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const toggleActive = useMutation({
		mutationFn: (input: { warehouseId: string; isActive: boolean }) =>
			updateWarehouse(input.warehouseId, { isActive: input.isActive }),
		onSuccess: async (_data, variables) => {
			toast.success(
				variables.isActive
					? t('inventory:warehouses.activated')
					: t('inventory:warehouses.deactivated'),
			);
			await queryClient.invalidateQueries({ queryKey: ['warehouses'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>
						{t('inventory:warehouses.title')}
					</h1>
					<p className='text-sm text-muted-foreground'>
						{t('inventory:warehouses.description')}
					</p>
				</div>
				<Button
					render={<Link to='/inventory/warehouses/new' />}
					className='shrink-0'
				>
					{t('inventory:warehouses.new')}
				</Button>
			</div>

			{/* Filters ------------------------------------------------------ */}
			<div className='flex flex-wrap items-center gap-3'>
				<Input
					className='w-64'
					placeholder={t('inventory:warehouses.searchPlaceholder')}
					value={searchDraft}
					onChange={(event) => setSearchDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							void navigate({
								search: (prev) => ({
									...prev,
									page: 1,
									search: searchDraft || undefined,
								}),
							});
						}
					}}
				/>
				<label className='flex items-center gap-2 text-sm text-muted-foreground'>
					<Checkbox
						checked={search.includeArchived === true}
						onCheckedChange={(checked) =>
							void navigate({
								search: (prev) => ({
									...prev,
									page: 1,
									includeArchived: checked === true || undefined,
								}),
							})
						}
					/>
					{t('inventory:warehouses.includeArchived')}
				</label>
			</div>

			{/* Cards -------------------------------------------------------- */}
			{isError ? (
				<EmptyState
					icon={CircleAlert}
					title={t('common:error.failed')}
					description={
						error instanceof Error ? error.message : undefined
					}
					className='border'
				/>
			) : rows.length === 0 && !isPending ? (
				<EmptyState
					icon={Warehouse}
					title={t('inventory:warehouses.emptyTitle')}
					description={t('inventory:warehouses.empty')}
					className='border'
					action={
						<Button render={<Link to='/inventory/warehouses/new' />}>
							{t('inventory:warehouses.new')}
						</Button>
					}
				/>
			) : (
				<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
					{isPending
						? Array.from({ length: 6 }, (_, index) => (
								<WarehouseCard key={index} busy={false} />
							))
						: rows.map((warehouse) => (
								<WarehouseCard
									key={warehouse.id}
									warehouse={warehouse}
									busy={toggleActive.isPending || archive.isPending}
									onToggleActive={() =>
										toggleActive.mutate({
											warehouseId: warehouse.id,
											isActive: !warehouse.isActive,
										})
									}
									onArchive={() => {
										if (
											window.confirm(
												`${t('inventory:warehouses.archiveConfirmTitle')}\n\n${t('inventory:warehouses.archiveConfirmBody')}`,
											)
										) {
											archive.mutate(warehouse.id);
										}
									}}
								/>
							))}
				</div>
			)}

			{pagination && (
				<PaginationControls
					page={pagination.page}
					totalPages={pagination.totalPages}
					onPageChange={(nextPage) =>
						void navigate({ search: (prev) => ({ ...prev, page: nextPage }) })
					}
				/>
			)}
		</div>
	);
}

/**
 * One warehouse card.
 *
 * @param warehouse - The row, or omitted for a pending placeholder card
 */
function WarehouseCard({
	warehouse,
	busy,
	onToggleActive,
	onArchive,
}: {
	warehouse?: TWarehouseWithCounts;
	busy: boolean;
	onToggleActive?: () => void;
	onArchive?: () => void;
}) {
	const { t } = useTranslation(['inventory', 'common']);

	if (!warehouse) {
		return (
			<Card className='h-full' aria-hidden='true'>
				<CardHeader className='space-y-2'>
					<div className='h-5 w-2/3 rounded bg-muted' />
					<div className='h-4 w-1/3 rounded bg-muted' />
				</CardHeader>
				<CardContent>
					<div className='grid grid-cols-4 gap-2'>
						{Array.from({ length: 4 }, (_, index) => (
							<div key={index} className='flex flex-col gap-1'>
								<div className='mx-auto h-4 w-6 rounded bg-muted' />
								<div className='mx-auto h-3 w-12 rounded bg-muted' />
							</div>
						))}
					</div>
				</CardContent>
				<CardFooter />
			</Card>
		);
	}

	const stats: Array<[string, number]> = [
		[t('inventory:warehouses.products'), warehouse.productsCount],
		[t('inventory:warehouses.materials'), warehouse.materialsCount],
		[t('inventory:warehouses.tools'), warehouse.toolsCount],
		[t('inventory:warehouses.storages'), warehouse.storagesCount],
	];

	return (
		<Link
			to='/inventory/warehouses/$warehouseId'
			params={{ warehouseId: warehouse.id }}
			className='group'
		>
			<Card className='h-full transition-shadow group-hover:shadow-md'>
				<CardHeader className='flex items-start justify-between gap-2 space-y-0'>
					<div className='flex min-w-0 flex-col gap-0.5'>
						<CardTitle className='truncate text-base'>
							{warehouse.name}
						</CardTitle>
						<p className='truncate font-mono text-xs text-muted-foreground'>
							{warehouse.code}
						</p>
					</div>
					<div className='flex shrink-0 flex-col items-end gap-1'>
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
					</div>
				</CardHeader>
				<CardContent>
					<div className='grid grid-cols-4 gap-2 text-center text-sm'>
						{stats.map(([label, value]) => (
							<div key={label} className='flex flex-col'>
								<span className='font-semibold tabular-nums'>{value}</span>
								<span className='text-xs text-muted-foreground'>{label}</span>
							</div>
						))}
					</div>
				</CardContent>
				<CardFooter className='justify-between gap-2'>
					<Button
						variant='outline'
						size='sm'
						disabled={busy}
						onClick={(event) => {
							event.preventDefault();
							onToggleActive?.();
						}}
					>
						{warehouse.isActive
							? t('inventory:warehouses.deactivate')
							: t('inventory:warehouses.activate')}
					</Button>
					<Button
						variant='ghost'
						size='sm'
						disabled={busy}
						onClick={(event) => {
							event.preventDefault();
							onArchive?.();
						}}
					>
						{t('inventory:detail.archive')}
					</Button>
				</CardFooter>
			</Card>
		</Link>
	);
}
