import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
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
import {
	Archive,
	ArchiveRestore,
	Funnel,
	Pencil,
	Plus,
	Search,
	SlidersHorizontal,
	Trash2,
	Warehouse,
} from 'lucide-react';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { CardActionsMenu, type TCardAction } from '@/components/card-actions-menu';
import { ItemThumb } from '@/components/item-thumb';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import {
	archiveWarehouse,
	myWarehousesQueryOptions,
	updateWarehouse,
	warehousesQueryOptions,
	type TWarehouseManaged,
	type TWarehouseWithCounts,
} from '@/lib/warehouse-api';
import { usePermission } from '@/lib/use-permission';
import { useWarehouseAccess } from '@/lib/use-warehouse-access';
import { CreateWarehouseDialog } from './create-warehouse-dialog';

/** The route API for `/warehouses` (validated search params). */
const routeApi = getRouteApi('/_authed/warehouses/');

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
 * Card grid modeled on the organizations page. Two sources, one grid:
 * an application admin sees every warehouse through the paginated admin
 * listing; a person in charge sees only the warehouses granted to them
 * (ADR-0017, `GET /warehouses/mine`) and gets no create action, because
 * `create` is not part of a PIC grant.
 */
export function WarehouseList() {
	const { isAppAdmin, isPending } = useWarehouseAccess();
	if (isPending) return <PageSkeleton />;
	return isAppAdmin ? <AdminWarehouseList /> : <PicWarehouseList />;
}

/**
 * Archive and active-toggle mutations shared by both lists.
 *
 * @remarks
 * A PIC holds `update` and `archive` (ADR-0017 §2), so the same two actions
 * belong on both screens.
 */
function useWarehouseLifecycle() {
	const { t } = useTranslation(['inventory', 'warehouse', 'product']);
	const queryClient = useQueryClient();

	const archive = useMutation({
		mutationFn: (warehouseId: string) => archiveWarehouse(warehouseId),
		onSuccess: async () => {
			toast.success(t('warehouse:warehouses.archived'));
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
					? t('warehouse:warehouses.activated')
					: t('warehouse:warehouses.deactivated'),
			);
			await queryClient.invalidateQueries({ queryKey: ['warehouses'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	return { archive, toggleActive };
}

/** The application-admin list: every warehouse, filters, and pagination. */
function AdminWarehouseList() {
	const { t } = useTranslation(['inventory', 'common', 'warehouse', 'product']);
	const navigate = routeApi.useNavigate();
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

	const { archive, toggleActive } = useWarehouseLifecycle();

	const [createOpen, setCreateOpen] = useState(false);
	const rows = data?.rows ?? [];
	const pagination = data?.pagination;

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>
						{t('warehouse:warehouses.title')}
					</h1>
					<p className='text-sm text-muted-foreground'>
						{t('warehouse:warehouses.description')}
					</p>
				</div>
				<Button className='shrink-0' onClick={() => setCreateOpen(true)}>
					<Plus className='size-4' data-icon='inline-start' />
					{t('warehouse:warehouses.new')}
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
						aria-label={t('warehouse:warehouses.searchPlaceholder')}
						placeholder={t('warehouse:warehouses.searchPlaceholder')}
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
				<ErrorState error={error} bordered />
			) : rows.length === 0 && !isPending ? (
				<EmptyState
					icon={Warehouse}
					bordered
					title={t('warehouse:warehouses.emptyTitle')}
					description={t('warehouse:warehouses.empty')}
					action={
						<Button onClick={() => setCreateOpen(true)}>
							{t('warehouse:warehouses.new')}
						</Button>
					}
				/>
			) : (
				<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
					{isPending
						? Array.from({ length: 6 }, (_, index) => (
								<WarehouseCard key={index} />
							))
						: rows.map((warehouse) => (
								<WarehouseCard
									key={warehouse.id}
									warehouse={warehouse}
									onToggleActive={() =>
										toggleActive.mutateAsync({
											warehouseId: warehouse.id,
											isActive: !warehouse.isActive,
										})
									}
									onDelete={() => archive.mutateAsync(warehouse.id)}
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

			<CreateWarehouseDialog open={createOpen} onOpenChange={setCreateOpen} />
		</div>
	);
}

/**
 * The warehouse list for a person in charge (ADR-0017).
 *
 * @remarks
 * Source is `GET /warehouses/mine` — session-only, no organization context, so
 * it works for a PIC with no membership. No create button (a PIC grant has no
 * `create`) and no pagination (a PIC manages a handful of warehouses); the
 * search box filters in the browser. The card shows the bin count instead of
 * the kind counts, which come from the admin listing.
 */
function PicWarehouseList() {
	const { t } = useTranslation(['inventory', 'common', 'warehouse', 'product']);
	const [term, setTerm] = useState('');
	const { data, isPending, isError, error } = useQuery(myWarehousesQueryOptions());
	const { archive, toggleActive } = useWarehouseLifecycle();

	const needle = term.trim().toLowerCase();
	const rows = (data ?? []).filter(
		(warehouse) =>
			!needle ||
			warehouse.name.toLowerCase().includes(needle) ||
			warehouse.code.toLowerCase().includes(needle),
	);

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('warehouse:warehouses.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('warehouse:warehouses.description')}
				</p>
			</div>

			<InputGroup className='w-64'>
				<InputGroupAddon align='inline-start'>
					<Search aria-hidden='true' />
				</InputGroupAddon>
				<InputGroupInput
					type='search'
					aria-label={t('warehouse:warehouses.searchPlaceholder')}
					placeholder={t('warehouse:warehouses.searchPlaceholder')}
					value={term}
					onChange={(event) => setTerm(event.target.value)}
				/>
			</InputGroup>

			{isError ? (
				<ErrorState error={error} bordered />
			) : rows.length === 0 && !isPending ? (
				<EmptyState
					icon={Warehouse}
					bordered
					title={t('warehouse:warehouses.emptyTitle')}
					description={t('warehouse:warehouses.empty')}
				/>
			) : (
				<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
					{isPending
						? Array.from({ length: 3 }, (_, index) => (
								<WarehouseCard key={index} />
							))
						: rows.map((warehouse) => (
								<WarehouseCard
									key={warehouse.id}
									warehouse={warehouse}
									onToggleActive={() =>
										toggleActive.mutateAsync({
											warehouseId: warehouse.id,
											isActive: !warehouse.isActive,
										})
									}
									onDelete={() => archive.mutateAsync(warehouse.id)}
								/>
							))}
				</div>
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
	const { t } = useTranslation(['inventory', 'common', 'warehouse', 'product']);
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
						{t('warehouse:warehouses.filters')}
					</Button>
				}
			/>
			<PopoverContent align='start' className='w-72'>
				<PopoverHeader>
					<PopoverTitle>{t('warehouse:warehouses.filtersTitle')}</PopoverTitle>
				</PopoverHeader>
				<div className='flex flex-col gap-3'>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>
							{t('warehouse:warehouses.filterStatus')}
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
									{t('warehouse:warehouses.statusAll')}
								</SelectItem>
								<SelectItem value='active'>{t('common:status.active')}</SelectItem>
								<SelectItem value='inactive'>
									{t('common:status.inactive')}
								</SelectItem>
								<SelectItem value='archived'>
									{t('warehouse:warehouses.statusArchived')}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>
							{t('warehouse:warehouses.sortBy')}
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
									{t('warehouse:warehouses.sortName')}
								</SelectItem>
								<SelectItem value='code'>
									{t('warehouse:warehouses.sortCode')}
								</SelectItem>
								<SelectItem value='status'>
									{t('warehouse:warehouses.sortStatus')}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>
							{t('warehouse:warehouses.sortOrder')}
						</span>
						<Select
							value={draftSortDir}
							onValueChange={(value) => setDraftSortDir((value ?? 'asc') as TSortDir)}
						>
							<SelectTrigger className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='asc'>{t('warehouse:warehouses.sortAsc')}</SelectItem>
								<SelectItem value='desc'>{t('warehouse:warehouses.sortDesc')}</SelectItem>
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
						{t('warehouse:warehouses.reset')}
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
						{t('warehouse:warehouses.apply')}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

/**
 * One warehouse card.
 *
 * @param warehouse - The row, or omitted for a pending placeholder card. A
 *   person-in-charge row carries bins but no kind counts, so the stats row
 *   falls back to the bin count.
 */
function WarehouseCard({
	warehouse,
	onToggleActive,
	onDelete,
}: {
	warehouse?: TWarehouseWithCounts | TWarehouseManaged;
	/** Archive (deactivate) or activate, depending on the current state. */
	onToggleActive?: () => unknown;
	/** The existing soft delete; the backend refuses while live units remain. */
	onDelete?: () => unknown;
}) {
	const { t } = useTranslation(['inventory', 'common', 'warehouse', 'product']);
	const navigate = useNavigate();
	const canAdjust = usePermission('stock_adjustment.create');

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

	// Kind counts come from the admin listing only; a PIC row has bins instead.
	const stats: Array<[string, number]> =
		'productsCount' in warehouse
			? [
					[t('warehouse:warehouses.products'), warehouse.productsCount],
					[t('warehouse:warehouses.components'), warehouse.componentsCount],
					[t('warehouse:warehouses.materials'), warehouse.materialsCount],
					[t('warehouse:warehouses.equipments'), warehouse.equipmentsCount],
					[t('warehouse:warehouses.storages'), warehouse.storagesCount],
				]
			: [[t('warehouse:warehouses.storages'), warehouse.storages.length]];

	// Stock only exists once something is stored, which the admin listing counts.
	const hasStock =
		'productsCount' in warehouse &&
		warehouse.productsCount + warehouse.componentsCount + warehouse.materialsCount > 0;

	/** Card menu: stock adjustment (when stocked), edit, archive (inactive) / activate, delete. */
	const actions: TCardAction[] = [];
	if (canAdjust && hasStock) {
		actions.push({
			key: 'adjust',
			label: t('common:cardMenu.stockAdjustment'),
			icon: SlidersHorizontal,
			onSelect: () => navigate({ to: '/inventory/stock/adjust', search: { warehouseId: warehouse.id } }),
		});
	}
	actions.push({
		key: 'edit',
		label: t('common:action.edit'),
		icon: Pencil,
		onSelect: () => navigate({ to: '/warehouses/$warehouseId/edit', params: { warehouseId: warehouse.id } }),
	});
	actions.push(
		warehouse.isActive
			? {
					key: 'archive',
					label: t('common:cardMenu.archive'),
					icon: Archive,
					onSelect: () => onToggleActive?.(),
					confirm: {
						title: t('common:cardMenu.archiveTitle', { name: warehouse.name }),
						description: t('common:cardMenu.archiveBody'),
						confirmLabel: t('common:cardMenu.archive'),
					},
				}
			: {
					key: 'activate',
					label: t('common:cardMenu.activate'),
					icon: ArchiveRestore,
					onSelect: () => onToggleActive?.(),
				},
		{
			key: 'delete',
			label: t('common:cardMenu.delete'),
			icon: Trash2,
			destructive: true,
			onSelect: () => onDelete?.(),
			confirm: {
				title: t('common:cardMenu.deleteTitle', { name: warehouse.name }),
				description: t('common:cardMenu.deleteBody'),
				confirmLabel: t('common:cardMenu.delete'),
			},
		},
	);

	return (
		// The whole card opens the detail. The actions menu is a sibling of the
		// link (not inside it) so its clicks never navigate.
		<div className='relative h-full'>
		<Link
			to='/warehouses/$warehouseId'
			params={{ warehouseId: warehouse.id }}
			className='group block h-full'
		>
			<Card className='h-full transition-shadow group-hover:shadow-md'>
				<ItemThumb
					variant='cover'
					src={warehouse.imageUrl}
					name={warehouse.name}
					icon={Warehouse}
				/>
				<CardHeader>
					<CardTitle className='truncate'>{warehouse.name}</CardTitle>
					<CardDescription className='truncate font-mono text-xs'>
						{warehouse.code}
					</CardDescription>
					<CardAction className='flex flex-col items-end gap-1'>
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
					</CardAction>
				</CardHeader>
				<CardContent>
					<div
						className='grid gap-2 text-center text-sm'
						style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
					>
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
			</Card>
		</Link>
		<CardActionsMenu actions={actions} />
		</div>
	);
}
