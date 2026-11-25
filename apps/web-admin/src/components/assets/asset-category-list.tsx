import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { Layers, Pencil, Plus } from 'lucide-react';
import {
	Pagination,
	PaginationContent,
	PaginationItem,
} from '@ims-erp/ui/components/pagination';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	AssetCategoryFormDialog,
	type TAssetCategoryFormValues,
} from '@/components/assets/asset-category-form-dialog';
import {
	assetCategoriesQueryOptions,
	createAssetCategory,
	type TAssetCategory,
	updateAssetCategory,
} from '@/lib/asset-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/assets/categories` (validated search params). */
const routeApi = getRouteApi('/_authed/assets/categories/');

const PAGE_SIZE = 20;

/**
 * Asset categories management (Phase A-4): list, create, edit.
 * Default depreciation rules drive new asset defaults in the register form.
 */
export function AssetCategoryList() {
	const { t } = useTranslation(['assets', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const canCreate = usePermission('asset.create');
	const canUpdate = usePermission('asset.update');

	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<TAssetCategory | null>(null);

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...assetCategoriesQueryOptions({
			page,
			limit: PAGE_SIZE,
			search: search.search,
		}),
		placeholderData: (previous) => previous,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['asset-categories'] });

	const create = useMutation({
		mutationFn: (values: TAssetCategoryFormValues) =>
			createAssetCategory(values),
		onSuccess: async () => {
			toast.success(t('assets:categories.created'));
			setCreating(false);
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const edit = useMutation({
		mutationFn: (values: TAssetCategoryFormValues) =>
			updateAssetCategory(editing?.id ?? '', {
				name: values.name,
				itemKind: values.itemKind,
				defaultUsefulLifeMonths: values.defaultUsefulLifeMonths,
				defaultDepreciationMethod: values.defaultDepreciationMethod,
			}),
		onSuccess: async () => {
			toast.success(t('assets:categories.updated'));
			setEditing(null);
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TAssetCategory, CellData>[]
	>(() => {
		const base: ColumnDef<DataTableFeatures, TAssetCategory, CellData>[] = [
			{
				accessorKey: 'code',
				header: t('assets:categories.code'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				id: 'name',
				header: t('assets:categories.name'),
				cell: ({ row }) => (
					<>
						{row.original.name}{' '}
						{row.original.isActive ? null : (
							<Badge variant='outline'>archived</Badge>
						)}
					</>
				),
			},
			{
				id: 'itemKind',
				header: t('assets:categories.itemKind'),
				cell: ({ row }) => t(`assets:itemKind.${row.original.itemKind}`),
			},
			{
				id: 'defaultDepreciationMethod',
				header: t('assets:categories.depMethod'),
				cell: ({ row }) =>
					t(
						`assets:depreciationMethod.${row.original.defaultDepreciationMethod as 'straight_line' | 'declining_balance' | 'none'}`,
					),
			},
			{
				id: 'lifeMonths',
				header: t('assets:categories.lifeMonths'),
				cell: ({ row }) => row.original.defaultUsefulLifeMonths ?? '—',
			},
		];
		if (!canUpdate) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.edit')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('assets:categories.edit')}
						actions={[
							{
								key: 'edit',
								label: t('assets:categories.edit'),
								icon: Pencil,
								onSelect: () => setEditing(row.original),
							},
						]}
					/>
				),
			},
		];
	}, [canUpdate, t]);

	if (isError) {
		return <ErrorState error={error} bordered />;
	}

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-xl font-semibold'>{t('assets:categories.title')}</h1>
					<p className='text-sm text-muted-foreground'>
						{t('assets:categories.description')}
					</p>
				</div>
				{canCreate ? (
					<Button onClick={() => setCreating(true)}>
						<Plus className='mr-2 size-4' />
						{t('assets:categories.new')}
					</Button>
				) : null}
			</div>

			<DataTableCard>
				{!isPending && (!data || data.rows.length === 0) ? (
					<EmptyState
						icon={Layers}
						title={t('assets:categories.emptyTitle')}
						description={t('assets:categories.empty')}
					/>
				) : (
					<DataTable
						columns={columns}
						data={data?.rows ?? []}
						loading={isPending}
						getRowId={(row) => row.id}
					/>
				)}

				<PaginationControls
					page={page}
					totalPages={data?.pagination.totalPages ?? 1}
					onPageChange={(next) =>
						void navigate({ search: (prev) => ({ ...prev, page: next }) })
					}
				/>
			</DataTableCard>
			<Pagination className='hidden'>
				<PaginationContent>
					<PaginationItem />
				</PaginationContent>
			</Pagination>

			{creating ? (
				<AssetCategoryFormDialog
					category={null}
					submitting={create.isPending}
					onClose={() => setCreating(false)}
					onSave={(values) => void create.mutateAsync(values)}
				/>
			) : null}

			{editing ? (
				<AssetCategoryFormDialog
					category={editing}
					submitting={edit.isPending}
					onClose={() => setEditing(null)}
					onSave={(values) => void edit.mutateAsync(values)}
				/>
			) : null}
		</div>
	);
}
