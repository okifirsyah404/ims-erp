import {
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { CircleAlert, Layers, Plus } from 'lucide-react';
import {
	Pagination,
	PaginationContent,
	PaginationItem,
} from '@ims-erp/ui/components/pagination';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	assetCategoriesQueryOptions,
	createAssetCategory,
	type TAssetCategory,
} from '@/lib/asset-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/assets/categories` (validated search params). */
const routeApi = getRouteApi('/_authed/assets/categories/');

const PAGE_SIZE = 20;

/**
 * Asset categories management (Phase A-4): list, create, archive.
 * Default depreciation rules drive new asset defaults in the register form.
 */
export function AssetCategoryList() {
	const { t } = useTranslation(['assets', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const [code, setCode] = useState('');
	const [name, setName] = useState('');
	const canCreate = usePermission('asset.create');

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...assetCategoriesQueryOptions({
			page,
			limit: PAGE_SIZE,
			search: search.search,
		}),
		placeholderData: (previous) => previous,
	});

	const create = useMutation({
		mutationFn: () =>
			createAssetCategory({
				code,
				name,
				itemKind: 'equipment',
				defaultDepreciationMethod: 'straight_line',
			}),
		onSuccess: async () => {
			toast.success(t('assets:categories.created'));
			setCode('');
			setName('');
			await queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TAssetCategory, CellData>[]
	>(
		() => [
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
				accessorKey: 'defaultDepreciationMethod',
				header: t('assets:categories.depMethod'),
			},
			{
				id: 'lifeMonths',
				header: t('assets:categories.lifeMonths'),
				cell: ({ row }) => row.original.defaultUsefulLifeMonths ?? '—',
			},
		],
		[t],
	);

	if (isError) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('assets:categories.emptyTitle')}
				description={error.message}
			/>
		);
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('assets:categories.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('assets:categories.description')}
				</p>
			</div>

			{canCreate ? (
				<div className='flex flex-wrap items-center gap-2'>
					<Input
						className='w-40'
						placeholder={t('assets:categories.code')}
						value={code}
						onChange={(event) => setCode(event.target.value)}
					/>
					<Input
						className='w-64'
						placeholder={t('assets:categories.name')}
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
					<Button
						disabled={!code || !name || create.isPending}
						onClick={() => void create.mutateAsync()}
					>
						<Plus className='size-4' data-icon='inline-start' />
						{t('assets:categories.new')}
					</Button>
				</div>
			) : null}

			{isPending ? null : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={Layers}
					title={t('assets:categories.emptyTitle')}
					description={t('assets:categories.empty')}
				/>
			) : (
				<DataTable
					columns={columns}
					data={data.rows}
					getRowId={(row) => row.id}
					bordered
				/>
			)}

			<PaginationControls
				page={page}
				totalPages={data?.pagination.totalPages ?? 1}
				onPageChange={(next) =>
					void navigate({ search: (prev) => ({ ...prev, page: next }) })
				}
			/>
			<Pagination className='hidden'>
				<PaginationContent>
					<PaginationItem />
				</PaginationContent>
			</Pagination>
		</div>
	);
}
