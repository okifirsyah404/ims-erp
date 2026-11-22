import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
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
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Archive, ArchiveRestore, Boxes, PackageSearch, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { AssetForm } from '@/components/assets/asset-form';
import { CardActionsMenu, type TCardAction } from '@/components/card-actions-menu';
import { ItemThumb } from '@/components/item-thumb';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { toast } from '@/components/toast';
import { useClampPage } from '@/lib/use-clamp-page';
import {
	archiveAsset,
deactivateAsset,
reactivateAsset,
type TAsset,
	assetsQueryOptions,
	ASSET_STATUSES,
	formatMoney,
	ITEM_KINDS,
	type TAssetStatus,
} from '@/lib/asset-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/assets/register` (validated search params). */
const routeApi = getRouteApi('/_authed/assets/register/');

/** Rows per page. */
const PAGE_SIZE = 12;

/**
 * The asset register list.
 *
 * @remarks
 * Card grid with URL-backed search, status filter, include-archived toggle
 * and server-side pagination (`placeholderData: previous` house pattern).
 * Archive is gated by `asset:update` (soft delete only).
 */
export function AssetRegisterList() {
	const { t } = useTranslation(['assets', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const [searchDraft, setSearchDraft] = useState(search.search ?? '');
	const [creating, setCreating] = useState(false);
	const canUpdate = usePermission('asset.update');
	const canCreate = usePermission('asset.create');

	const page = search.page ?? 1;

	const { data, isPending, isError, error } = useQuery({
		...assetsQueryOptions({
			page,
			limit: PAGE_SIZE,
			search: search.search,
			status: search.status as TAssetStatus | undefined,
			itemKind: search.itemKind,
			includeArchived: search.includeArchived,
		}),
		placeholderData: (previous) => previous,
	});

	const archive = useMutationSafe(archiveAsset, queryClient);
	const [editing, setEditing] = useState<TAsset | null>(null);

	/** "Archive" parks the asset as inactive (reason required, D18); "Activate" reverses it. */
	const park = useMutation({
		mutationFn: (input: { id: string; reason: string }) => deactivateAsset(input.id, input.reason),
		onSuccess: async () => {
			toast.success(t('assets:deactivated'));
			await queryClient.invalidateQueries({ queryKey: ['assets'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});
	const unpark = useMutation({
		mutationFn: (id: string) => reactivateAsset(id),
		onSuccess: async () => {
			toast.success(t('assets:reactivated'));
			await queryClient.invalidateQueries({ queryKey: ['assets'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	/** The card menu: edit, archive (inactive) / activate, delete (soft delete). */
	function rowActions(asset: TAsset): TCardAction[] {
		if (!canUpdate || asset.deletedAt !== null) return [];
		return [
			{
				key: 'edit',
				label: t('common:action.edit'),
				icon: Pencil,
				onSelect: () => setEditing(asset),
			},
			asset.status === 'inactive'
				? {
						key: 'activate',
						label: t('common:cardMenu.activate'),
						icon: ArchiveRestore,
						onSelect: () => unpark.mutateAsync(asset.id),
					}
				: {
						key: 'archive',
						label: t('common:cardMenu.archive'),
						icon: Archive,
						onSelect: (reason) => park.mutateAsync({ id: asset.id, reason: reason ?? '' }),
						confirm: {
							title: t('common:cardMenu.archiveTitle', { name: asset.name }),
							description: t('common:cardMenu.archiveBody'),
							confirmLabel: t('common:cardMenu.archive'),
							reasonPlaceholder: t('common:cardMenu.reasonPlaceholder'),
						},
					},
			{
				key: 'delete',
				label: t('common:cardMenu.delete'),
				icon: Trash2,
				destructive: true,
				onSelect: () => archive.mutateAsync(asset.id),
				confirm: {
					title: t('common:cardMenu.deleteTitle', { name: asset.name }),
					description: t('common:cardMenu.deleteBody'),
					confirmLabel: t('common:cardMenu.delete'),
				},
			},
		];
	}

	const meta = data?.pagination;
	// A filter or a shrinking result set must not leave the list on a page that
	// no longer exists.
	const goToPage = (next: number) =>
		void navigate({ search: (prev) => ({ ...prev, page: next }) });
	useClampPage(page, meta?.totalPages, goToPage);

	if (isError) {
		return <ErrorState error={error} bordered />;
	}

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold'>
						{t('assets:register.title')}
					</h1>
					<p className='text-sm text-muted-foreground'>
						{t('assets:register.description')}
					</p>
				</div>
				{canCreate ? (
					<Button className='shrink-0' onClick={() => setCreating(true)}>
						<Plus className='size-4' data-icon='inline-start' />
						{t('assets:register.new')}
					</Button>
				) : null}
			</div>

			{/* Filters ------------------------------------------------------ */}
			<div className='flex flex-wrap items-center gap-3'>
				<Input
					className='w-64'
					placeholder={t('assets:register.searchPlaceholder')}
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
				<Select
					value={search.status ?? 'all'}
					onValueChange={(value: string | null) =>
						void navigate({
							search: (prev) => ({
								...prev,
								page: 1,
								status:
									value === 'all' ? undefined : (value as TAssetStatus),
							}),
						})
					}
				>
					<SelectTrigger className='w-44'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>
							{t('assets:register.filterAllStatuses')}
						</SelectItem>
						{ASSET_STATUSES.map((status) => (
							<SelectItem key={status} value={status}>
								{t(`assets:status.${status}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={search.itemKind ?? 'all'}
					onValueChange={(value: string | null) =>
						void navigate({
							search: (prev) => ({
								...prev,
								page: 1,
								itemKind: value === 'all' ? undefined : (value ?? undefined),
							}),
						})
					}
				>
					<SelectTrigger className='w-44'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>
							{t('assets:register.filterAllTypes')}
						</SelectItem>
						{ITEM_KINDS.map((kind) => (
							<SelectItem key={kind} value={kind}>
								{t(`assets:itemKind.${kind}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Field orientation='horizontal' className='w-auto'>
					<Checkbox
						id='asset-include-archived'
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
					<FieldLabel htmlFor='asset-include-archived'>
						{t('assets:register.includeArchived')}
					</FieldLabel>
				</Field>
			</div>

			{/* Grid --------------------------------------------------------- */}
			{isPending ? (
				<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
					{Array.from({ length: 6 }, (_, index) => (
						<Card key={index}>
							<CardHeader>
								<Skeleton className='h-5 w-1/2' />
							</CardHeader>
							<CardContent className='space-y-2'>
								<Skeleton className='h-4 w-3/4' />
								<Skeleton className='h-4 w-1/2' />
							</CardContent>
						</Card>
					))}
				</div>
			) : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={PackageSearch}
					title={t('assets:register.emptyTitle')}
					description={t('assets:register.empty')}
					bordered
				/>
			) : (
				<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
					{data.rows.map((asset) => (
						// The whole card opens the detail. The actions menu is a sibling
						// of the link (not inside it) so its clicks never navigate.
						<div key={asset.id} className='relative h-full'>
						<Link
							to='/assets/register/$assetId'
							params={{ assetId: asset.id }}
							className='group block h-full'
						>
						<Card className='flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-md'>
							<ItemThumb variant='cover' src={asset.imageUrl} name={asset.name} icon={Wrench} />
							<CardHeader>
								<div className='flex items-start justify-between gap-2'>
									<CardTitle>{asset.name}</CardTitle>
									<Badge variant='secondary'>
										{t(`assets:status.${asset.status}`)}
									</Badge>
								</div>
								<p className='font-mono text-xs text-muted-foreground'>
									{asset.code}
								</p>
							</CardHeader>
							<CardContent className='flex-1 space-y-1 text-sm'>
								{/* Same "label under value" stats row as the warehouse cards. */}
								<div className='mb-2 grid grid-cols-3 gap-2 text-center'>
									<div className='flex min-w-0 flex-col'>
										<span className='truncate font-semibold text-foreground'>
											{t(`assets:itemKind.${asset.itemKind}`)}
										</span>
										<span className='text-xs text-muted-foreground'>
											{t('assets:register.type')}
										</span>
									</div>
									<div className='flex min-w-0 flex-col'>
										<span className='truncate font-semibold text-foreground'>
											{t(`assets:condition.${asset.condition}`)}
										</span>
										<span className='text-xs text-muted-foreground'>
											{t('assets:register.condition')}
										</span>
									</div>
									<div className='flex min-w-0 flex-col'>
										<span className='truncate font-semibold text-foreground tabular-nums'>
											{formatMoney(asset.bookValue, asset.currencyCode)}
										</span>
										<span className='text-xs text-muted-foreground'>
											{t('assets:register.bookValue')}
										</span>
									</div>
								</div>
								{asset.status === 'borrowed' ? (
									<>
										{asset.borrowedSince ? (
											<p>
												<span className='text-muted-foreground'>
													{t('assets:register.borrowedSince')}:{' '}
												</span>
												{new Date(asset.borrowedSince).toLocaleDateString()}
											</p>
										) : null}
										{/* TODO: resolve the custodian's name once the HR module exists. */}
										{asset.custodianEmployeeId ? (
											<p className='truncate'>
												<span className='text-muted-foreground'>
													{t('assets:register.custodian')}:{' '}
												</span>
												<code className='text-xs'>{asset.custodianEmployeeId}</code>
											</p>
										) : null}
									</>
								) : asset.warehouseName ? (
									<p>
										<span className='text-muted-foreground'>
											{t('assets:register.storedIn')}:{' '}
										</span>
										{asset.warehouseName}
									</p>
								) : asset.locationDescription ? (
									<p>
										<span className='text-muted-foreground'>
											{t('assets:register.location')}:{' '}
										</span>
										{asset.locationDescription}
									</p>
								) : null}
								{asset.serialNumber ? (
									<p className='truncate text-xs text-muted-foreground'>
										{t('assets:register.serialNumber')}: {asset.serialNumber}
									</p>
								) : null}
							</CardContent>
						</Card>
						</Link>
						<CardActionsMenu actions={rowActions(asset)} />
						</div>
					))}
				</div>
			)}

			<PaginationControls
				page={page}
				totalPages={meta?.totalPages ?? 1}
				onPageChange={(next) =>
					void navigate({ search: (prev) => ({ ...prev, page: next }) })
				}
			/>
			{data ? null : <Boxes className='hidden' />}

			{creating ? (
				<Dialog open onOpenChange={(open) => !open && setCreating(false)}>
					<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-xl'>
						<DialogHeader>
							<DialogTitle>{t('assets:form.newAsset')}</DialogTitle>
						</DialogHeader>
						<AssetForm
							compact
							onCancel={() => setCreating(false)}
							onSuccess={() => setCreating(false)}
						/>
					</DialogContent>
				</Dialog>
			) : null}

			{editing ? (
				<Dialog open onOpenChange={(open) => !open && setEditing(null)}>
					<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-xl'>
						<DialogHeader>
							<DialogTitle>{t('assets:form.editAsset')}</DialogTitle>
						</DialogHeader>
						<AssetForm
							compact
							asset={editing}
							onCancel={() => setEditing(null)}
							onSuccess={() => setEditing(null)}
						/>
					</DialogContent>
				</Dialog>
			) : null}
		</div>
	);
}

/** Small helper so the mutation wiring stays out of the render body. */
function useMutationSafe(
	mutationFn: (id: string) => Promise<unknown>,
	queryClient: ReturnType<typeof useQueryClient>,
) {
	const { t } = useTranslation('assets');
	return useMutation({
		mutationFn,
		onSuccess: async () => {
			toast.success(t('archived'));
			await queryClient.invalidateQueries({ queryKey: ['assets'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});
}
