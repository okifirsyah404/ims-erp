import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
	Archive,
	ArchiveRestore,
	Cpu,
	Layers,
	Package,
	PackageSearch,
	Pencil,
	Plus,
	Search,
	SlidersHorizontal,
	Trash2,
	type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Dialog,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import { ItemThumb } from '@/components/item-thumb';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import { CardActionsMenu, type TCardAction } from '@/components/card-actions-menu';
import {
	archiveProduct,
	createProduct,
	productsQueryOptions,
	updateProduct,
	type TProduct,
	type TProductCreateInput,
	type TProductKind,
} from '@/lib/inventory-api';
import { toCompositionLines, type TCompositionDraft } from '@/components/inventory/product-composition';
import { saveProductComponents } from '@/lib/inventory-api';
import { uploadGalleryImages } from '@/lib/image-gallery-api';
import { formatIdr, rupiahToMinor } from '@/lib/format';
import { itemDetailLink, itemEditLink } from '@/lib/item-routes';
import { useItemCategoryNames } from '@/lib/item-category-api';
import { ItemFiltersPopover } from './item-filters-popover';
import { hasItemFilters, type TItemListFilters } from '@/lib/item-list-search';
import { useClampPage } from '@/lib/use-clamp-page';
import { usePermission } from '@/lib/use-permission';
import { ItemForm } from './item-form';
import { EmptyState, ErrorState } from '@/components/empty-state';
/** Cards per page: 4 columns x 6 rows. */
const PAGE_SIZE = 24;

/** Icon shown on a card without a photo. */
const KIND_ICONS: Record<TProductKind, LucideIcon> = {
	product: Package,
	component: Cpu,
	material: Layers,
};

/**
 * The item list for one kind, as a card grid.
 *
 * @remarks
 * One component for all three kind routes rather than three near-identical
 * pages: the kind is the only difference, and it is a filter, not a layout.
 * The sidebar exposes three separate entries (`/products`,
 * `/components`, …) so the URL stays meaningful and bookmarkable.
 *
 * `page` is a URL search param (owned by the route) so a page survives a
 * refresh; the page size is fixed here, so `limit` never enters the address
 * bar. Creation happens in a dialog because the kind is already known from the
 * page — a full route would ask the user to re-state it.
 */
export function ItemKindList({
	kind,
	title,
	page,
	filters,
	onPageChange,
	onFiltersChange,
}: {
	kind: TProductKind;
	title: string;
	/** Current page, owned by the route's `page` search param. */
	page: number;
	/** Search, category and active-only filters, owned by the route's search params. */
	filters: TItemListFilters;
	onPageChange: (page: number) => void;
	/** Replaces the filters; the route resets `page` to 1. */
	onFiltersChange: (filters: TItemListFilters) => void;
}) {
	const { t } = useTranslation(['inventory', 'common', 'product']);
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const categoryNames = useItemCategoryNames();
	const canCreate = usePermission('product.create');
	const canUpdate = usePermission('product.update');
	const canArchive = usePermission('product.archive');
	const canAdjust = usePermission('stock_adjustment.create');
	const [creating, setCreating] = useState(false);
	// The text box applies on Enter or blur, like the warehouse list, so every
	// keystroke does not hit the API and rewrite the address.
	const [searchDraft, setSearchDraft] = useState(filters.q ?? '');
	const filtered = hasItemFilters(filters);

	const { data, isPending, isError, error } = useQuery({
		...productsQueryOptions({
			productKind: kind,
			page,
			limit: PAGE_SIZE,
			search: filters.q,
			productCategoryId: filters.categoryId,
			status: filters.status,
			minPrice: filters.minPrice === undefined ? undefined : rupiahToMinor(String(filters.minPrice)),
			maxPrice: filters.maxPrice === undefined ? undefined : rupiahToMinor(String(filters.maxPrice)),
			minStock: filters.minStock,
			maxStock: filters.maxStock,
			sortBy: filters.sortBy,
			sortDir: filters.sortDir,
		}),
		// Keeps the current page visible while the next one loads.
		placeholderData: (previous) => previous,
	});

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;
	// A filter or a shrinking result set must not leave the list on a page that
	// no longer exists.
	const effectivePage = Math.min(page, pagination?.totalPages ?? page);
	useClampPage(page, pagination?.totalPages, onPageChange);

	/** Mutation shared by "Archive" (inactive) and "Activate". */
	const setActive = useMutation({
		mutationFn: (input: { id: string; isActive: boolean }) =>
			updateProduct(input.id, { isActive: input.isActive }),
		onSuccess: async () => {
			toast.success(t('product:form.updated'));
			await queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	/** "Delete" is the existing soft delete; the backend refuses while units exist. */
	const remove = useMutation({
		mutationFn: (id: string) => archiveProduct(id),
		onSuccess: async () => {
			toast.success(t('product:form.archived'));
			await queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	/** The card menu: stock adjustment (stocked items), edit, archive/activate, delete. */
	function rowActions(row: TProduct): TCardAction[] {
		const actions: TCardAction[] = [];
		if (canAdjust && row.isStockTracked) {
			actions.push({
				key: 'adjust',
				label: t('common:cardMenu.stockAdjustment'),
				icon: SlidersHorizontal,
				onSelect: () => navigate({ to: '/inventory/stock/adjust', search: { productId: row.id } }),
			});
		}
		if (canUpdate) {
			actions.push({
				key: 'edit',
				label: t('common:action.edit'),
				icon: Pencil,
				onSelect: () => navigate(itemEditLink(row.productKind, row.id)),
			});
			actions.push(
				row.isActive
					? {
							key: 'archive',
							label: t('common:cardMenu.archive'),
							icon: Archive,
							onSelect: () => setActive.mutateAsync({ id: row.id, isActive: false }),
							confirm: {
								title: t('common:cardMenu.archiveTitle', { name: row.name }),
								description: t('common:cardMenu.archiveBody'),
								confirmLabel: t('common:cardMenu.archive'),
							},
						}
					: {
							key: 'activate',
							label: t('common:cardMenu.activate'),
							icon: ArchiveRestore,
							onSelect: () => setActive.mutateAsync({ id: row.id, isActive: true }),
						},
			);
		}
		if (canArchive) {
			actions.push({
				key: 'delete',
				label: t('common:cardMenu.delete'),
				icon: Trash2,
				destructive: true,
				onSelect: () => remove.mutateAsync(row.id),
				confirm: {
					title: t('common:cardMenu.deleteTitle', { name: row.name }),
					description: t('common:cardMenu.deleteBody'),
					confirmLabel: t('common:cardMenu.delete'),
				},
			});
		}
		return actions;
	}

	function applySearch() {
		const next = searchDraft.trim() || undefined;
		if (next !== filters.q) onFiltersChange({ ...filters, q: next });
	}

	if (isError) {
		return <ErrorState error={error} bordered />;
	}

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div>
					<h1 className='text-2xl font-bold'>{title}</h1>
					<p className='text-sm text-muted-foreground'>
						{t('product:items.description')}
					</p>
				</div>
				{canCreate ? (
					<Button className='shrink-0' onClick={() => setCreating(true)}>
						<Plus className='size-4' data-icon='inline-start' />
						{t('product:form.newItem')}
					</Button>
				) : null}
			</div>

			{/* Filters ------------------------------------------------------ */}
			<div className='flex flex-wrap items-center gap-3'>
				<InputGroup className='w-64'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('product:items.search')}
						placeholder={t('product:items.search')}
						value={searchDraft}
						onChange={(event) => setSearchDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') applySearch();
						}}
						onBlur={applySearch}
					/>
				</InputGroup>
				<ItemFiltersPopover
					kind={kind}
					filters={filters}
					onApply={(next) => onFiltersChange({ ...next, q: filters.q })}
					onReset={() => onFiltersChange({ q: filters.q })}
				/>
				{filtered ? (
					<Button
						variant='ghost'
						size='sm'
						onClick={() => {
							setSearchDraft('');
							onFiltersChange({});
						}}
					>
						{t('product:items.clearFilters')}
					</Button>
				) : null}
			</div>

			{isPending ? (
				<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
					{Array.from({ length: 6 }, (_, index) => (
						<Card key={index} className='animate-pulse'>
							<div className='h-40 w-full bg-muted' />
							<CardHeader>
								<CardTitle className='h-5 w-1/2 rounded bg-muted' />
							</CardHeader>
							<CardContent className='space-y-2'>
								<div className='h-4 w-3/4 rounded bg-muted' />
								<div className='h-4 w-1/2 rounded bg-muted' />
							</CardContent>
						</Card>
					))}
				</div>
			) : rows.length === 0 ? (
				<EmptyState
					icon={PackageSearch}
					title={filtered ? t('product:items.noResultsTitle') : t('product:items.emptyTitle')}
					description={filtered ? t('product:items.noResults') : t('product:items.empty')}
					bordered
				/>
			) : (
				<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
					{rows.map((row) => (
						// The whole card opens the detail. The actions menu is a sibling
						// of the link (not inside it) so its clicks never navigate.
						<div key={row.id} className='relative h-full'>
						<Link
							{...itemDetailLink(row.productKind, row.id)}
							className='group block h-full'
						>
						<Card className='flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-md'>
							<ItemThumb
								variant='cover'
								src={row.imageUrl}
								name={row.name}
								icon={KIND_ICONS[row.productKind]}
							/>
							<CardHeader>
								<CardTitle>{row.name}</CardTitle>
								<CardDescription className='font-mono text-xs'>
									{row.code} · {row.sku}
								</CardDescription>
								{row.isActive ? null : (
									<CardAction>
										<Badge variant='outline'>
											{t('product:items.inactive')}
										</Badge>
									</CardAction>
								)}
							</CardHeader>
							<CardContent className='flex-1 space-y-3 text-sm'>
								{/* Same "label under value" stats row as the warehouse cards. */}
								<div className='grid grid-cols-3 gap-2 text-center'>
									<div className='flex min-w-0 flex-col'>
										<span className='truncate font-semibold text-foreground tabular-nums'>
											{formatIdr(row.sellingPrice)}
										</span>
										<span className='text-xs text-muted-foreground'>
											{t('product:items.sellingPrice')}
										</span>
									</div>
									<div className='flex min-w-0 flex-col'>
										<span className='truncate font-semibold text-foreground'>{row.unitLabel}</span>
										<span className='text-xs text-muted-foreground'>
											{t('product:items.unitLabel')}
										</span>
									</div>
									<div className='flex min-w-0 flex-col'>
										<span className='truncate font-semibold text-foreground'>
											{row.isSerialized
												? t('product:items.serialized')
												: t('product:items.quantityTracked')}
										</span>
										<span className='text-xs text-muted-foreground'>
											{t('product:items.tracking')}
										</span>
									</div>
								</div>
								<p className='truncate text-xs text-muted-foreground'>
									{[
										row.productCategoryId ? categoryNames.get(row.productCategoryId) : null,
										row.brand,
									]
										.filter(Boolean)
										.join(' · ') || t('product:items.noCategory')}
								</p>
							</CardContent>
						</Card>
						</Link>
						<CardActionsMenu actions={rowActions(row)} />
						</div>
					))}
				</div>
			)}

			<PaginationControls
				page={effectivePage}
				totalPages={pagination?.totalPages ?? 1}
				onPageChange={onPageChange}
			/>

			{creating ? (
				<CreateItemDialog
					kind={kind}
					onClose={() => setCreating(false)}
					onCreated={() => {
						setCreating(false);
						void queryClient.invalidateQueries({
							queryKey: ['inventory', 'products'],
						});
					}}
				/>
			) : null}
		</div>
	);
}

/**
 * Creates an item of the page's kind.
 *
 * @remarks
 * The kind is preselected but still shown, because the form is shared with the
 * edit screen and the backend treats it as immutable afterwards.
 */
function CreateItemDialog({
	kind,
	onClose,
	onCreated,
}: {
	kind: TProductKind;
	onClose: () => void;
	onCreated: () => void;
}) {
	const { t } = useTranslation(['inventory', 'common', 'product']);
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(
		input: TProductCreateInput | Record<string, unknown>,
		imageFiles: File[] = [],
		composition: TCompositionDraft[] | null = null,
	) {
		setSubmitting(true);
		try {
			const created = await createProduct(input as TProductCreateInput);
			if (!created) throw new Error(t('common:error.failed'));
			// A failed photo upload must not lose the item that was just created:
			// report it and carry on (the detail page can retry).
			if (imageFiles.length) {
				const errors = await uploadGalleryImages(`/products/${created.id}`, imageFiles);
				if (errors.length) toast.error(errors.join(' '));
			}
			if (composition?.length) {
				try {
					await saveProductComponents(created.id, toCompositionLines(composition) ?? []);
				} catch (error) {
					toast.error(
						t('product:composition.saveFailed', {
							message: error instanceof Error ? error.message : t('common:error.failed'),
						}),
					);
				}
			}
			toast.success(t('product:form.created'));
			onCreated();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-2xl'>
				<DialogHeader>
					<DialogTitle>{t('product:form.newItem')}</DialogTitle>
				</DialogHeader>
				<ItemForm
					compact
					defaultItemKind={kind}
					submitting={submitting}
					onSubmit={(input, imageFiles, composition) => void handleSubmit(input, imageFiles, composition)}
					onCancel={onClose}
				/>
			</ScrollDialogContent>
		</Dialog>
	);
}
