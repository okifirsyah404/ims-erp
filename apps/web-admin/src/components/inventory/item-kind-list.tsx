import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PackageSearch, Plus } from 'lucide-react';
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
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { ItemThumb } from '@/components/item-thumb';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import {
	createProduct,
	productsQueryOptions,
	type TProductCreateInput,
	type TProductKind,
} from '@/lib/inventory-api';
import { useItemCategoryNames } from '@/lib/item-category-api';
import { useClampPage } from '@/lib/use-clamp-page';
import { usePermission } from '@/lib/use-permission';
import { ItemForm } from './item-form';
import { EmptyState, ErrorState } from '@/components/empty-state';
/** Cards per page: 3 columns × 8 rows. */
const PAGE_SIZE = 24;

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
	onPageChange,
}: {
	kind: TProductKind;
	title: string;
	/** Current page, owned by the route's `page` search param. */
	page: number;
	onPageChange: (page: number) => void;
}) {
	const { t } = useTranslation(['inventory', 'common', 'product']);
	const queryClient = useQueryClient();
	const categoryNames = useItemCategoryNames();
	const canCreate = usePermission('product.create');
	const [creating, setCreating] = useState(false);

	const { data, isPending, isError, error } = useQuery({
		...productsQueryOptions({ productKind: kind, page, limit: PAGE_SIZE }),
		// Keeps the current page visible while the next one loads.
		placeholderData: (previous) => previous,
	});

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;
	// A filter or a shrinking result set must not leave the list on a page that
	// no longer exists.
	const effectivePage = Math.min(page, pagination?.totalPages ?? page);
	useClampPage(page, pagination?.totalPages, onPageChange);

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

			{isPending ? (
				<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
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
					title={t('product:items.emptyTitle')}
					description={t('product:items.empty')}
				/>
			) : (
				<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
					{rows.map((row) => (
						<Card key={row.id} className='flex flex-col overflow-hidden'>
							<ItemThumb
								variant='cover'
								src={row.imageUrl}
								name={row.name}
							/>
							<CardHeader>
								<CardTitle>
									<Link
										to='/inventory/items/$itemId'
										params={{ itemId: row.id }}
										className='hover:underline'
									>
										{row.name}
									</Link>
								</CardTitle>
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
							<CardContent className='flex-1 space-y-2 text-sm'>
								<p>
									<span className='text-muted-foreground'>
										{t('product:items.category')}:{' '}
									</span>
									{(row.productCategoryId && categoryNames.get(row.productCategoryId)) ?? '—'}
								</p>
								<div>
									{row.isSerialized ? (
										<Badge variant='secondary'>
											{t('product:items.serialized')}
										</Badge>
									) : (
										<Badge variant='outline'>
											{t('product:items.quantityTracked')}
										</Badge>
									)}
								</div>
							</CardContent>
							<CardFooter className='justify-end'>
								<Button
									variant='ghost'
									size='sm'
									render={
										<Link
											to='/inventory/items/$itemId/edit'
											params={{ itemId: row.id }}
										/>
									}
								>
									{t('common:action.edit')}
								</Button>
							</CardFooter>
						</Card>
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

	async function handleSubmit(input: TProductCreateInput | Record<string, unknown>) {
		setSubmitting(true);
		try {
			const created = await createProduct(input as TProductCreateInput);
			if (!created) throw new Error(t('common:error.failed'));
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
			<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
				<DialogHeader>
					<DialogTitle>{t('product:form.newItem')}</DialogTitle>
				</DialogHeader>
				<ItemForm
					compact
					defaultItemKind={kind}
					submitting={submitting}
					onSubmit={(input) => void handleSubmit(input)}
					onCancel={onClose}
				/>
			</DialogContent>
		</Dialog>
	);
}
