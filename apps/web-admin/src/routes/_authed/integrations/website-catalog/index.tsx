import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { EyeOff, Globe, Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	listingsQueryOptions,
	OUT_OF_STOCK_MODES,
	PRICE_MODES,
	publishListing,
	removeListing,
	saveListing,
	slugify,
	type TListing,
	type TListingInput,
	type TOutOfStockMode,
	type TPriceMode,
} from '@/lib/catalog-api';
import { formatIdr } from '@/lib/format';
import { productsQueryOptions } from '@/lib/inventory-api';
import { usePermission } from '@/lib/use-permission';

/** `/integrations/website-catalog` — what the public website shows (M04 stage 1). */
export const Route = createFileRoute('/_authed/integrations/website-catalog/')({
	component: WebsiteCatalogPage,
});

function WebsiteCatalogPage() {
	const { t } = useTranslation(['integrations', 'common']);
	const queryClient = useQueryClient();
	// Saving a listing creates it on first save, so "new" needs the update grant
	// (`PUT /inventory/product-listings/:id` is gated by `catalog:update`).
	const canCreate = usePermission('catalog.update');
	const canUpdate = usePermission('catalog.update');
	const canPublish = usePermission('catalog.publish');
	const canRemove = usePermission('catalog.archive');
	const { data, isPending, isError, error } = useQuery(listingsQueryOptions());
	const [editing, setEditing] = useState<{ listing: TListing | null } | null>(null);
	const [busy, setBusy] = useState(false);

	const run = useCallback(
		async (work: () => Promise<unknown>, done: string) => {
			setBusy(true);
			try {
				await work();
				await queryClient.invalidateQueries({ queryKey: ['catalog'] });
				toast.success(done);
				return true;
			} catch (cause) {
				toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
				return false;
			} finally {
				setBusy(false);
			}
		},
		[queryClient, t],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TListing, CellData>[]>(
		() => [
			{
				id: 'item',
				header: t('integrations:catalog.item'),
				cell: ({ row }) => (
					<>
						<div className='font-medium'>{row.original.name}</div>
						<div className='text-xs text-muted-foreground'>{row.original.sku}</div>
					</>
				),
			},
			{
				accessorKey: 'slug',
				header: t('integrations:catalog.slug'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				id: 'price',
				header: t('integrations:catalog.price'),
				meta: { align: 'right', cellClassName: 'whitespace-nowrap' },
				cell: ({ row }) =>
					row.original.priceMode === 'rfq'
						? t('integrations:catalog.quotation')
						: formatIdr(row.original.sellingPrice),
			},
			{
				id: 'outOfStock',
				header: t('integrations:catalog.outOfStock'),
				cell: ({ row }) => t(`integrations:catalog.outOfStock.${row.original.outOfStockMode}`),
			},
			{
				id: 'status',
				header: t('integrations:catalog.status'),
				cell: ({ row }) => (
					<Badge variant={row.original.isPublished ? 'default' : 'outline'}>
						{row.original.isPublished
							? t('integrations:catalog.published')
							: t('integrations:catalog.hidden')}
					</Badge>
				),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.actions')}</span>,
				meta: { align: 'right', cellClassName: 'whitespace-nowrap' },
				cell: ({ row }) => {
					const listing = row.original;
					return (
						<RowActions
							label={t('common:action.actions')}
							disabled={busy}
							actions={[
								{
									key: 'publish',
									label: listing.isPublished
										? t('integrations:catalog.hide')
										: t('integrations:catalog.publish'),
									icon: listing.isPublished ? EyeOff : Globe,
									hidden: !canPublish,
									onSelect: () =>
										void run(
											() => publishListing(listing.id, !listing.isPublished),
											listing.isPublished
												? t('integrations:catalog.hiddenDone')
												: t('integrations:catalog.publishedDone'),
										),
								},
								{
									key: 'edit',
									label: t('integrations:catalog.edit'),
									icon: Pencil,
									hidden: !canUpdate,
									onSelect: () => setEditing({ listing }),
								},
								{
									key: 'remove',
									label: t('integrations:catalog.remove'),
									icon: Trash2,
									destructive: true,
									hidden: !canRemove,
									onSelect: () =>
										void run(() => removeListing(listing.id), t('integrations:catalog.removed')),
								},
							]}
						/>
					);
				},
			},
		],
		[t, busy, canPublish, canUpdate, canRemove, run],
	);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('integrations:catalog.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('integrations:catalog.description')}</p>
				</div>
				{canCreate && <Button onClick={() => setEditing({ listing: null })}>{t('integrations:catalog.new')}</Button>}
			</div>
			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && data.length === 0 ? (
					<EmptyState title={t('integrations:catalog.empty')} />
				) : (
					<DataTable columns={columns} data={data ?? []} getRowId={(row) => row.id} loading={isPending} sortable />
				)}
			</DataTableCard>
			{editing && (
				<ListingDialog
					listing={editing.listing}
					busy={busy}
					onClose={() => setEditing(null)}
					onSave={async (productId, input) => {
						const done = await run(() => saveListing(productId, input), t('integrations:catalog.saved'));
						if (done) setEditing(null);
					}}
				/>
			)}
		</div>
	);
}

function ListingDialog({
	listing,
	busy,
	onClose,
	onSave,
}: {
	listing: TListing | null;
	busy: boolean;
	onClose: () => void;
	onSave: (productId: string, input: TListingInput) => Promise<void>;
}) {
	const { t } = useTranslation(['integrations', 'common']);
	const [search, setSearch] = useState('');
	const deferred = useDeferredValue(search.trim());
	const items = useQuery({ ...productsQueryOptions({ search: deferred || undefined, limit: 20 }), enabled: !listing });
	const [itemId, setItemId] = useState(listing?.id ?? '');
	const [slug, setSlug] = useState(listing?.slug ?? '');
	const [specs, setSpecs] = useState(listing?.listingSpecs ?? '');
	const [priceMode, setPriceMode] = useState<TPriceMode>(listing?.priceMode ?? 'list');
	const [priceCaption, setPriceCaption] = useState(listing?.priceCaption ?? '');
	const [outOfStockMode, setOutOfStockMode] = useState<TOutOfStockMode>(listing?.outOfStockMode ?? 'request');
	const [leadTimeLabel, setLeadTimeLabel] = useState(listing?.leadTimeLabel ?? '');
	const [applications, setApplications] = useState((listing?.applications ?? []).join(', '));
	const [popularity, setPopularity] = useState(String(listing?.popularity ?? 0));

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className='sm:max-w-xl'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void onSave(itemId, {
							slug,
							specs: specs.trim() || null,
							priceMode,
							priceCaption: priceCaption.trim() || null,
							outOfStockMode,
							leadTimeLabel: leadTimeLabel.trim() || null,
							applications: applications
								.split(',')
								.map((tag) => tag.trim())
								.filter(Boolean),
							popularity: Number(popularity) || 0,
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>{listing ? t('integrations:catalog.edit') : t('integrations:catalog.new')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='listing-item'>{t('integrations:catalog.item')}</FieldLabel>
							{listing ? (
								<p className='text-sm'>
									{listing.sku} — {listing.name}
								</p>
							) : (
								<>
									<InputGroup>
										<InputGroupAddon align='inline-start'>
											<Search aria-hidden='true' />
										</InputGroupAddon>
										<InputGroupInput
											type='search'
											aria-label={t('integrations:catalog.pickItem')}
											placeholder={t('integrations:catalog.pickItem')}
											value={search}
											onChange={(event) => setSearch(event.target.value)}
										/>
									</InputGroup>
									<Select
										required
										value={itemId || 'none'}
										onValueChange={(value: string | null) => {
											const next = value === 'none' || value == null ? '' : value;
											setItemId(next);
											const item = items.data?.rows.find((row) => row.id === next);
											if (item && !slug) setSlug(slugify(item.name));
										}}
									>
										<SelectTrigger id='listing-item' className='w-full'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='none'>—</SelectItem>
											{(items.data?.rows ?? [])
												.filter((item) => item.isActive)
												.map((item) => (
													<SelectItem key={item.id} value={item.id}>
														{item.sku} — {item.name}
													</SelectItem>
												))}
										</SelectContent>
									</Select>
								</>
							)}
						</Field>
						<Field>
							<FieldLabel htmlFor='listing-slug'>{t('integrations:catalog.slug')}</FieldLabel>
							<Input
								id='listing-slug'
								required
								maxLength={120}
								pattern='[a-z0-9]+(-[a-z0-9]+)*'
								value={slug}
								onChange={(event) => setSlug(event.target.value.toLowerCase())}
							/>
							<FieldDescription>{t('integrations:catalog.slugHint')}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='listing-specs'>{t('integrations:catalog.specs')}</FieldLabel>
							<Input id='listing-specs' maxLength={400} value={specs} onChange={(event) => setSpecs(event.target.value)} />
							<FieldDescription>{t('integrations:catalog.specsHint')}</FieldDescription>
						</Field>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='listing-price-mode'>{t('integrations:catalog.priceMode')}</FieldLabel>
								<Select value={priceMode} onValueChange={(value: string | null) => setPriceMode(value as TPriceMode)}>
									<SelectTrigger id='listing-price-mode' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PRICE_MODES.map((mode) => (
											<SelectItem key={mode} value={mode}>
												{t(`integrations:catalog.priceMode.${mode}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor='listing-caption'>{t('integrations:catalog.priceCaption')}</FieldLabel>
								<Input id='listing-caption' maxLength={120} value={priceCaption} onChange={(event) => setPriceCaption(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='listing-out'>{t('integrations:catalog.outOfStock')}</FieldLabel>
								<Select value={outOfStockMode} onValueChange={(value: string | null) => setOutOfStockMode(value as TOutOfStockMode)}>
									<SelectTrigger id='listing-out' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{OUT_OF_STOCK_MODES.map((mode) => (
											<SelectItem key={mode} value={mode}>
												{t(`integrations:catalog.outOfStock.${mode}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor='listing-lead'>{t('integrations:catalog.leadTime')}</FieldLabel>
								<Input id='listing-lead' maxLength={60} value={leadTimeLabel} onChange={(event) => setLeadTimeLabel(event.target.value)} />
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor='listing-apps'>{t('integrations:catalog.applications')}</FieldLabel>
							<Input id='listing-apps' value={applications} onChange={(event) => setApplications(event.target.value)} />
							<FieldDescription>{t('integrations:catalog.applicationsHint')}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='listing-popularity'>{t('integrations:catalog.popularity')}</FieldLabel>
							<Input
								id='listing-popularity'
								type='number'
								min='0'
								step='1'
								inputMode='numeric'
								value={popularity}
								onChange={(event) => setPopularity(event.target.value)}
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={busy || !itemId || !slug}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
