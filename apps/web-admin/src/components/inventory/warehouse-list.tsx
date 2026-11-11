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
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from '@ims-erp/ui/components/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { CircleAlert, Funnel, PackageOpen, Plus, Search, Warehouse } from 'lucide-react';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
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

/** Lifecycle filter values. `all` hides archived rows. */
type TStatusFilter = 'all' | 'active' | 'inactive' | 'archived';
/** Sortable columns. */
type TSortField = 'name' | 'code' | 'status';
type TSortDir = 'asc' | 'desc';

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
			status: search.status,
			sortBy: search.sortBy,
			sortDir: search.sortDir,
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
		<div className='flex flex-col gap-6'>
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
					<Plus className='mr-2 size-4' aria-hidden='true' />
					{t('inventory:warehouses.new')}
				</Button>
			</div>

			{/* Filters ------------------------------------------------------ */}
			<div className='flex flex-wrap items-center gap-3'>
				<InputGroup className='w-64'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('inventory:warehouses.searchPlaceholder')}
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
				</InputGroup>
				<WarehouseFiltersPopover
					status={search.status}
					sortBy={search.sortBy}
					sortDir={search.sortDir}
					onApply={(filters) =>
						void navigate({
							search: (prev) => ({ ...prev, page: 1, ...filters }),
						})
					}
					onReset={() =>
						void navigate({
							search: (prev) => ({
								...prev,
								page: 1,
								status: undefined,
								sortBy: undefined,
								sortDir: undefined,
							}),
						})
					}
				/>
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
				<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
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
 * Filter and sort popover for the warehouse list.
 *
 * @remarks
 * Drafts accumulate while the popover is open and reach the URL only on
 * Apply; closing without applying discards them. Drafts re-seed from the URL
 * on open, so the URL stays the source of truth.
 */
function WarehouseFiltersPopover({
	status,
	sortBy,
	sortDir,
	onApply,
	onReset,
}: {
	status?: TStatusFilter;
	sortBy?: TSortField;
	sortDir?: TSortDir;
	onApply: (filters: {
		status?: TStatusFilter;
		sortBy?: TSortField;
		sortDir?: TSortDir;
	}) => void;
	onReset: () => void;
}) {
	const { t } = useTranslation(['inventory', 'common']);
	const [open, setOpen] = useState(false);
	const [draftStatus, setDraftStatus] = useState<TStatusFilter | undefined>(status);
	const [draftSortBy, setDraftSortBy] = useState<TSortField>(sortBy ?? 'name');
	const [draftSortDir, setDraftSortDir] = useState<TSortDir>(sortDir ?? 'asc');

	/** Re-seeds drafts from the URL whenever the popover opens. */
	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			setDraftStatus(status);
			setDraftSortBy(sortBy ?? 'name');
			setDraftSortDir(sortDir ?? 'asc');
		}
		setOpen(nextOpen);
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				render={
					<Button variant={status ? 'default' : 'outline'}>
						<Funnel className='mr-2 size-4' aria-hidden='true' />
						{t('inventory:warehouses.filters')}
					</Button>
				}
			/>
			<PopoverContent align='start' className='w-72'>
				<PopoverHeader>
					<PopoverTitle>{t('inventory:warehouses.filtersTitle')}</PopoverTitle>
				</PopoverHeader>
				<div className='flex flex-col gap-3'>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>
							{t('inventory:warehouses.filterStatus')}
						</span>
						<Select
							value={draftStatus ?? 'all'}
							onValueChange={(value) =>
								setDraftStatus(
									value === 'all' || value == null ? undefined : (value as TStatusFilter),
								)
							}
						>
							<SelectTrigger className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>
									{t('inventory:warehouses.statusAll')}
								</SelectItem>
								<SelectItem value='active'>{t('common:status.active')}</SelectItem>
								<SelectItem value='inactive'>
									{t('common:status.inactive')}
								</SelectItem>
								<SelectItem value='archived'>
									{t('inventory:warehouses.statusArchived')}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>
							{t('inventory:warehouses.sortBy')}
						</span>
						<Select
							value={draftSortBy}
							onValueChange={(value) =>
								setDraftSortBy((value ?? 'name') as TSortField)
							}
						>
							<SelectTrigger className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='name'>
									{t('inventory:warehouses.sortName')}
								</SelectItem>
								<SelectItem value='code'>
									{t('inventory:warehouses.sortCode')}
								</SelectItem>
								<SelectItem value='status'>
									{t('inventory:warehouses.sortStatus')}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>
							{t('inventory:warehouses.sortOrder')}
						</span>
						<Select
							value={draftSortDir}
							onValueChange={(value) => setDraftSortDir((value ?? 'asc') as TSortDir)}
						>
							<SelectTrigger className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='asc'>{t('inventory:warehouses.sortAsc')}</SelectItem>
								<SelectItem value='desc'>{t('inventory:warehouses.sortDesc')}</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className='mt-1 flex items-center justify-between gap-2'>
					<Button
						variant='ghost'
						size='sm'
						onClick={() => {
							setDraftStatus(undefined);
							setDraftSortBy('name');
							setDraftSortDir('asc');
							onReset();
							setOpen(false);
						}}
					>
						{t('inventory:warehouses.reset')}
					</Button>
					<Button
						size='sm'
						onClick={() => {
							onApply({
								status: draftStatus,
								sortBy: draftSortBy,
								sortDir: draftSortDir,
							});
							setOpen(false);
						}}
					>
						{t('inventory:warehouses.apply')}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
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
				<Skeleton className='h-40 w-full rounded-b-none' />
				<CardHeader className='space-y-2'>
					<Skeleton className='h-5 w-2/3' />
					<Skeleton className='h-4 w-1/3' />
				</CardHeader>
				<CardContent>
					<div className='grid grid-cols-5 gap-2'>
						{Array.from({ length: 5 }, (_, index) => (
							<div key={index} className='flex flex-col gap-1'>
								<Skeleton className='mx-auto h-4 w-6' />
								<Skeleton className='mx-auto h-3 w-12' />
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
		[t('inventory:warehouses.components'), warehouse.componentsCount],
		[t('inventory:warehouses.materials'), warehouse.materialsCount],
		[t('inventory:warehouses.equipments'), warehouse.equipmentsCount],
		[t('inventory:warehouses.storages'), warehouse.storagesCount],
	];

	return (
		<Link
			to='/inventory/warehouses/$warehouseId'
			params={{ warehouseId: warehouse.id }}
			className='group'
		>
			<Card className='h-full transition-shadow group-hover:shadow-md'>
				{warehouse.imageUrl ? (
					<img
						src={warehouse.imageUrl}
						alt={warehouse.name}
						className='h-40 w-full object-cover'
						loading='lazy'
					/>
				) : (
					<div
						aria-hidden='true'
						className='flex h-40 w-full items-center justify-center bg-muted text-muted-foreground'
					>
						<PackageOpen className='size-10' />
					</div>
				)}
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
					<div className='grid grid-cols-5 gap-2 text-center text-sm'>
						{stats.map(([label, value]) => (
							<div key={label} className='flex flex-col'>
								<span className='font-semibold text-foreground tabular-nums'>
									{value}
								</span>
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
