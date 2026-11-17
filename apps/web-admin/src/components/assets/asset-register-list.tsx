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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Boxes, CircleAlert, PackageSearch, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { AssetForm } from '@/components/assets/asset-form';
import { ItemThumb } from '@/components/item-thumb';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import { useClampPage } from '@/lib/use-clamp-page';
import {
	archiveAsset,
	assetsQueryOptions,
	assetTypesQueryOptions,
	ASSET_STATUSES,
	formatMoney,
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
			assetType: search.assetType,
			includeArchived: search.includeArchived,
		}),
		placeholderData: (previous) => previous,
	});
	const types = useQuery(assetTypesQueryOptions());
	const typeName = (code: string) =>
		types.data?.find((row) => row.code === code)?.name ?? code;

	const archive = useMutationSafe(archiveAsset, queryClient);

	const meta = data?.pagination;
	// A filter or a shrinking result set must not leave the list on a page that
	// no longer exists.
	const goToPage = (next: number) =>
		void navigate({ search: (prev) => ({ ...prev, page: next }) });
	useClampPage(page, meta?.totalPages, goToPage);

	if (isError) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('assets:register.emptyTitle')}
				description={error.message}
			/>
		);
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
					value={search.assetType ?? 'all'}
					onValueChange={(value: string | null) =>
						void navigate({
							search: (prev) => ({
								...prev,
								page: 1,
								assetType: value === 'all' ? undefined : (value ?? undefined),
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
						{(types.data ?? []).map((type) => (
							<SelectItem key={type.code} value={type.code}>
								{type.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
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
					{t('assets:register.includeArchived')}
				</label>
			</div>

			{/* Grid --------------------------------------------------------- */}
			{isPending ? (
				<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
					{Array.from({ length: 6 }, (_, index) => (
						<Card key={index} className='animate-pulse'>
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
			) : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={PackageSearch}
					title={t('assets:register.emptyTitle')}
					description={t('assets:register.empty')}
				/>
			) : (
				<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
					{data.rows.map((asset) => (
						<Card key={asset.id} className='flex flex-col overflow-hidden'>
							<ItemThumb variant='cover' src={asset.imageUrl} name={asset.name} />
							<CardHeader className='pb-2'>
								<div className='flex items-start justify-between gap-2'>
									<CardTitle className='text-base'>
										<Link
											to='/assets/register/$assetId'
											params={{ assetId: asset.id }}
											className='hover:underline'
										>
											{asset.name}
										</Link>
									</CardTitle>
									<Badge variant='secondary'>
										{t(`assets:status.${asset.status}`)}
									</Badge>
								</div>
								<p className='font-mono text-xs text-muted-foreground'>
									{asset.code}
								</p>
							</CardHeader>
							<CardContent className='flex-1 space-y-1 text-sm'>
								<p>
									<span className='text-muted-foreground'>
										{t('assets:register.type')}:{' '}
									</span>
									{typeName(asset.assetType)}
								</p>
								<p>
									<span className='text-muted-foreground'>
										{t('assets:register.condition')}:{' '}
									</span>
									{t(`assets:condition.${asset.condition}`)}
								</p>
								<p>
									<span className='text-muted-foreground'>
										{t('assets:register.bookValue')}:{' '}
									</span>
									{formatMoney(asset.bookValue, asset.currencyCode)}
								</p>
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
							<CardFooter className='justify-end gap-2'>
								{canUpdate && asset.deletedAt === null ? (
									<Button
										variant='ghost'
										size='sm'
										onClick={() => void archive.mutateAsync(asset.id)}
									>
										{t('assets:detail.archive')}
									</Button>
								) : null}
							</CardFooter>
						</Card>
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
