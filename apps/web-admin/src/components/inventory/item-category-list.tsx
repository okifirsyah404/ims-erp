import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { Card, CardContent } from '@ims-erp/ui/components/card';
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
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

/**
 * Item categories (ADR-0011): one level, company-wide. Lists every live
 * category, including inactive ones; actions follow the caller's
 * `product:create|update|archive` grants (the server enforces them).
 */
export function ItemCategoryList() {
	const { t } = useTranslation(['inventory', 'common']);
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
			toast.success(t('inventory:categories.saved'));
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
			toast.success(t('inventory:categories.archived'));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setArchiving(null);
		}
	}

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('inventory:categories.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('inventory:categories.description')}</p>
				</div>
				{canCreate && <Button onClick={() => setEditing('new')}>{t('inventory:categories.new')}</Button>}
			</div>

			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : categories.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						{t('inventory:categories.empty')}
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className='p-0'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className='w-16'>{t('inventory:categories.sortOrder')}</TableHead>
									<TableHead>{t('inventory:categories.name')}</TableHead>
									<TableHead>{t('inventory:categories.slug')}</TableHead>
									<TableHead>{t('inventory:categories.shortName')}</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{categories.map((category) => (
									<TableRow key={category.id}>
										<TableCell>{category.sortOrder}</TableCell>
										<TableCell>
											{category.name}
											{!category.isActive && (
												<Badge variant='outline' className='ml-2'>
													{t('inventory:categories.inactive')}
												</Badge>
											)}
										</TableCell>
										<TableCell className='font-mono text-xs'>{category.slug}</TableCell>
										<TableCell className='text-muted-foreground'>{category.shortName ?? '—'}</TableCell>
										<TableCell className='text-right'>
											<div className='flex justify-end gap-2'>
												{canUpdate && (
													<Button variant='outline' size='sm' onClick={() => setEditing(category)}>
														{t('common:action.edit')}
													</Button>
												)}
												{canArchive && (
													<Button variant='outline' size='sm' onClick={() => setArchiving(category)}>
														{t('inventory:categories.archive')}
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
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
						<AlertDialogTitle>{t('inventory:categories.archive')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('inventory:categories.archiveConfirm', { name: archiving?.name ?? '' })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
						<AlertDialogAction onClick={() => archiving && void handleArchive(archiving)}>
							{t('inventory:categories.archive')}
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
	const { t } = useTranslation(['inventory', 'common']);
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
							{category ? t('inventory:categories.edit') : t('inventory:categories.new')}
						</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='category-slug'>{t('inventory:categories.slug')}</FieldLabel>
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
							<FieldDescription>{t('inventory:categories.slugHint')}</FieldDescription>
						</Field>
						<div className='grid gap-4 sm:grid-cols-[1fr_10rem]'>
							<Field>
								<FieldLabel htmlFor='category-name'>{t('inventory:categories.name')}</FieldLabel>
								<Input
									id='category-name'
									required
									maxLength={120}
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='category-order'>{t('inventory:categories.sortOrder')}</FieldLabel>
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
							<FieldLabel htmlFor='category-short'>{t('inventory:categories.shortName')}</FieldLabel>
							<Input
								id='category-short'
								maxLength={60}
								value={shortName}
								onChange={(event) => setShortName(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='category-description'>
								{t('inventory:categories.descriptionLabel')}
							</FieldLabel>
							<Textarea
								id='category-description'
								rows={3}
								maxLength={2000}
								value={description}
								onChange={(event) => setDescription(event.target.value)}
							/>
						</Field>
						<label className='flex items-center gap-2 text-sm'>
							<Checkbox checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
							{t('inventory:categories.isActive')}
						</label>
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
