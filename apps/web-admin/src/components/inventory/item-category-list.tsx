import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@ims-erp/ui/components/alert-dialog';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { toast } from '@/components/toast';
import {
	archiveItemCategory,
	createItemCategory,
	itemCategoriesQueryOptions,
	type TItemCategory,
	type TItemCategoryInput,
	updateItemCategory,
} from '@/lib/item-category-api';
import { usePermission } from '@/lib/use-permission';
import { EmptyState, ErrorState } from '@/components/empty-state';

/**
 * Item categories (ADR-0011): one level, company-wide. Lists every live
 * category, including inactive ones; actions follow the caller's
 * `product:create|update|archive` grants (the server enforces them).
 */
export function ItemCategoryList() {
	const { t } = useTranslation(['inventory', 'common', 'product']);
	const queryClient = useQueryClient();
	const canCreate = usePermission('product.create');
	const canUpdate = usePermission('product.update');
	const canArchive = usePermission('product.archive');
	const { data: categories, isPending, isError, error } = useQuery(itemCategoriesQueryOptions(true));
	const [editing, setEditing] = useState<TItemCategory | 'new' | null>(null);
	const [archiving, setArchiving] = useState<TItemCategory | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const refresh = () => queryClient.invalidateQueries({ queryKey: ['inventory', 'item-categories'] });

	async function handleSave(input: TItemCategoryInput) {
		setSubmitting(true);
		try {
			if (editing === 'new') {
				await createItemCategory(input);
			} else if (editing) {
				const { slug: _fixed, ...changes } = input;
				await updateItemCategory(editing.id, changes);
			}
			await refresh();
			toast.success(t('product:categories.saved'));
			setEditing(null);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}

	async function handleArchive(category: TItemCategory) {
		try {
			await archiveItemCategory(category.id);
			await refresh();
			toast.success(t('product:categories.archived'));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setArchiving(null);
		}
	}

	const columns = useMemo<ColumnDef<DataTableFeatures, TItemCategory, CellData>[]>(
		() => [
			{
				accessorKey: 'sortOrder',
				header: t('product:categories.sortOrder'),
				meta: { headClassName: 'w-16' },
			},
			{
				id: 'name',
				header: t('product:categories.name'),
				cell: ({ row }) => (
					<>
						{row.original.name}
						{!row.original.isActive && (
							<Badge variant='outline' className='ml-2'>
								{t('product:categories.inactive')}
							</Badge>
						)}
					</>
				),
			},
			{
				accessorKey: 'slug',
				header: t('product:categories.slug'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				id: 'shortName',
				header: t('product:categories.shortName'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => row.original.shortName ?? '—',
			},
			{
				id: 'actions',
				header: '',
				meta: { align: 'right' },
				cell: ({ row }) => (
					<div className='flex justify-end gap-2'>
						{canUpdate && (
							<Button variant='outline' size='sm' onClick={() => setEditing(row.original)}>
								{t('common:action.edit')}
							</Button>
						)}
						{canArchive && (
							<Button variant='outline' size='sm' onClick={() => setArchiving(row.original)}>
								{t('product:categories.archive')}
							</Button>
						)}
					</div>
				),
			},
		],
		[canArchive, canUpdate, t],
	);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('product:categories.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('product:categories.description')}</p>
				</div>
				{canCreate && <Button onClick={() => setEditing('new')}>{t('product:categories.new')}</Button>}
			</div>

			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && categories.length === 0 ? (
				<EmptyState title={t('product:categories.empty')} bordered />
			) : (
				<DataTable
					columns={columns}
					data={categories ?? []}
					getRowId={(category) => category.id}
					loading={isPending}
					bordered
				/>
			)}

			{editing && (
				<CategoryDialog
					category={editing === 'new' ? null : editing}
					submitting={submitting}
					onClose={() => setEditing(null)}
					onSave={(input) => void handleSave(input)}
				/>
			)}

			<AlertDialog open={archiving !== null} onOpenChange={(open) => !open && setArchiving(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('product:categories.archive')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('product:categories.archiveConfirm', { name: archiving?.name ?? '' })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
						<AlertDialogAction onClick={() => archiving && void handleArchive(archiving)}>
							{t('product:categories.archive')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

/** Create/edit dialog; the slug is only editable when creating. */
function CategoryDialog({
	category,
	submitting,
	onClose,
	onSave,
}: {
	category: TItemCategory | null;
	submitting: boolean;
	onClose: () => void;
	onSave: (input: TItemCategoryInput) => void;
}) {
	const { t } = useTranslation(['inventory', 'common', 'product']);
	const [slug, setSlug] = useState(category?.slug ?? '');
	const [name, setName] = useState(category?.name ?? '');
	const [shortName, setShortName] = useState(category?.shortName ?? '');
	const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
	const [description, setDescription] = useState(category?.description ?? '');
	const [isActive, setIsActive] = useState(category?.isActive ?? true);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='sm:max-w-lg'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSave({
							slug: slug.trim().toLowerCase(),
							name: name.trim(),
							shortName: shortName.trim() || null,
							sortOrder: Number(sortOrder) || 0,
							description: description.trim() || null,
							isActive,
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>
							{category ? t('product:categories.edit') : t('product:categories.new')}
						</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='category-slug'>{t('product:categories.slug')}</FieldLabel>
							<Input
								id='category-slug'
								className='font-mono'
								required
								maxLength={64}
								pattern='[a-z0-9]+(-[a-z0-9]+)*'
								value={slug}
								disabled={category !== null}
								onChange={(event) => setSlug(event.target.value.toLowerCase())}
							/>
							<FieldDescription>{t('product:categories.slugHint')}</FieldDescription>
						</Field>
						<div className='grid gap-4 sm:grid-cols-[1fr_10rem]'>
							<Field>
								<FieldLabel htmlFor='category-name'>{t('product:categories.name')}</FieldLabel>
								<Input
									id='category-name'
									required
									maxLength={120}
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='category-order'>{t('product:categories.sortOrder')}</FieldLabel>
								<Input
									id='category-order'
									type='number'
									min={0}
									max={9999}
									step={1}
									value={sortOrder}
									onChange={(event) => setSortOrder(event.target.value)}
								/>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor='category-short'>{t('product:categories.shortName')}</FieldLabel>
							<Input
								id='category-short'
								maxLength={60}
								value={shortName}
								onChange={(event) => setShortName(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='category-description'>
								{t('product:categories.descriptionLabel')}
							</FieldLabel>
							<Textarea
								id='category-description'
								rows={3}
								maxLength={2000}
								value={description}
								onChange={(event) => setDescription(event.target.value)}
							/>
						</Field>
						<Field orientation='horizontal'>
							<Checkbox
								id='category-is-active'
								checked={isActive}
								onCheckedChange={(checked) => setIsActive(checked === true)}
							/>
							<FieldLabel htmlFor='category-is-active'>{t('product:categories.isActive')}</FieldLabel>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting}>
							{submitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
