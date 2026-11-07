import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { toast } from '@/components/toast';
import {
	createListing,
	listingsQueryOptions,
	OUT_OF_STOCK_MODES,
	PRICE_MODES,
	publishListing,
	removeListing,
	slugify,
	type TListing,
	type TListingInput,
	type TOutOfStockMode,
	type TPriceMode,
	updateListing,
} from '@/lib/catalog-api';
import { formatIdr } from '@/lib/format';
import { itemsQueryOptions } from '@/lib/inventory-api';
import { usePermission } from '@/lib/use-permission';

/** `/integrations/website-catalog` — what the public website shows (M04 stage 1). */
export const Route = createFileRoute('/_authed/integrations/website-catalog/')({
	component: WebsiteCatalogPage,
});

const select = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm';

function WebsiteCatalogPage() {
	const { t } = useTranslation(['integrations', 'common']);
	const queryClient = useQueryClient();
	const canCreate = usePermission('catalog.create');
	const canUpdate = usePermission('catalog.update');
	const canPublish = usePermission('catalog.publish');
	const canRemove = usePermission('catalog.archive');
	const { data, isPending, isError, error } = useQuery(listingsQueryOptions());
	const [editing, setEditing] = useState<{ listing: TListing | null } | null>(null);
	const [busy, setBusy] = useState(false);

	const run = async (work: () => Promise<unknown>, done: string) => {
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
	};

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('integrations:catalog.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('integrations:catalog.description')}</p>
				</div>
				{canCreate && <Button onClick={() => setEditing({ listing: null })}>{t('integrations:catalog.new')}</Button>}
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('integrations:catalog.empty')}</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className='p-0'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('integrations:catalog.item')}</TableHead>
									<TableHead>{t('integrations:catalog.slug')}</TableHead>
									<TableHead className='text-right'>{t('integrations:catalog.price')}</TableHead>
									<TableHead>{t('integrations:catalog.outOfStock')}</TableHead>
									<TableHead>{t('integrations:catalog.status')}</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.map((listing) => (
									<TableRow key={listing.id}>
										<TableCell>
											<div className='font-medium'>{listing.item?.name ?? '—'}</div>
											<div className='text-xs text-muted-foreground'>{listing.item?.sku}</div>
										</TableCell>
										<TableCell className='font-mono text-xs'>{listing.slug}</TableCell>
										<TableCell className='text-right whitespace-nowrap'>
											{listing.priceMode === 'rfq' || !listing.item ? t('integrations:catalog.quotation') : formatIdr(listing.item.sellingPrice)}
										</TableCell>
										<TableCell>{t(`integrations:catalog.outOfStock.${listing.outOfStockMode}`)}</TableCell>
										<TableCell>
											<Badge variant={listing.isPublished ? 'default' : 'outline'}>
												{listing.isPublished ? t('integrations:catalog.published') : t('integrations:catalog.hidden')}
											</Badge>
										</TableCell>
										<TableCell className='text-right whitespace-nowrap'>
											{canPublish && (
												<Button
													size='sm'
													variant={listing.isPublished ? 'outline' : 'default'}
													disabled={busy}
													onClick={() =>
														void run(
															() => publishListing(listing.id, !listing.isPublished),
															listing.isPublished ? t('integrations:catalog.hiddenDone') : t('integrations:catalog.publishedDone'),
														)
													}
												>
													{listing.isPublished ? t('integrations:catalog.hide') : t('integrations:catalog.publish')}
												</Button>
											)}
											{canUpdate && (
												<Button size='sm' variant='ghost' onClick={() => setEditing({ listing })}>
													{t('integrations:catalog.edit')}
												</Button>
											)}
											{canRemove && (
												<Button size='sm' variant='ghost' disabled={busy} onClick={() => void run(() => removeListing(listing.id), t('integrations:catalog.removed'))}>
													{t('integrations:catalog.remove')}
												</Button>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
			{editing && (
				<ListingDialog
					listing={editing.listing}
					busy={busy}
					onClose={() => setEditing(null)}
					onSave={async (input) => {
						const done = await run(
							() => (editing.listing ? updateListing(editing.listing.id, input) : createListing(input)),
							t('integrations:catalog.saved'),
						);
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
	onSave: (input: TListingInput) => Promise<void>;
}) {
	const { t } = useTranslation(['integrations', 'common']);
	const [search, setSearch] = useState('');
	const deferred = useDeferredValue(search.trim());
	const items = useQuery({ ...itemsQueryOptions({ search: deferred || undefined, limit: 20 }), enabled: !listing });
	const [itemId, setItemId] = useState(listing?.itemId ?? '');
	const [slug, setSlug] = useState(listing?.slug ?? '');
	const [specs, setSpecs] = useState(listing?.specs ?? '');
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
						void onSave({
							itemId,
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
									{listing.item?.sku} — {listing.item?.name}
								</p>
							) : (
								<>
									<Input
										type='search'
										aria-label={t('integrations:catalog.pickItem')}
										placeholder={t('integrations:catalog.pickItem')}
										value={search}
										onChange={(event) => setSearch(event.target.value)}
									/>
									<select
										id='listing-item'
										required
										className={select}
										value={itemId}
										onChange={(event) => {
											setItemId(event.target.value);
											const item = items.data?.rows.find((row) => row.id === event.target.value);
											if (item && !slug) setSlug(slugify(item.name));
										}}
									>
										<option value=''>—</option>
										{(items.data?.rows ?? [])
											.filter((item) => item.isActive)
											.map((item) => (
												<option key={item.id} value={item.id}>
													{item.sku} — {item.name}
												</option>
											))}
									</select>
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
								<select id='listing-price-mode' className={select} value={priceMode} onChange={(event) => setPriceMode(event.target.value as TPriceMode)}>
									{PRICE_MODES.map((mode) => (
										<option key={mode} value={mode}>
											{t(`integrations:catalog.priceMode.${mode}`)}
										</option>
									))}
								</select>
							</Field>
							<Field>
								<FieldLabel htmlFor='listing-caption'>{t('integrations:catalog.priceCaption')}</FieldLabel>
								<Input id='listing-caption' maxLength={120} value={priceCaption} onChange={(event) => setPriceCaption(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='listing-out'>{t('integrations:catalog.outOfStock')}</FieldLabel>
								<select
									id='listing-out'
									className={select}
									value={outOfStockMode}
									onChange={(event) => setOutOfStockMode(event.target.value as TOutOfStockMode)}
								>
									{OUT_OF_STOCK_MODES.map((mode) => (
										<option key={mode} value={mode}>
											{t(`integrations:catalog.outOfStock.${mode}`)}
										</option>
									))}
								</select>
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
