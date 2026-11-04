import {
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
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
				assetType: 'equipment',
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
				<div className='overflow-hidden rounded-lg border'>
					<table className='w-full text-sm'>
						<thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
							<tr>
								<th className='px-3 py-2'>{t('assets:categories.code')}</th>
								<th className='px-3 py-2'>{t('assets:categories.name')}</th>
								<th className='px-3 py-2'>{t('assets:categories.assetType')}</th>
								<th className='px-3 py-2'>{t('assets:categories.depMethod')}</th>
								<th className='px-3 py-2'>{t('assets:categories.lifeMonths')}</th>
							</tr>
						</thead>
						<tbody>
							{data.rows.map((category) => (
								<tr key={category.id} className='border-t'>
									<td className='px-3 py-2 font-mono text-xs'>
										{category.code}
									</td>
									<td className='px-3 py-2'>
										{category.name}{' '}
										{category.isActive ? null : (
											<Badge variant='outline'>archived</Badge>
										)}
									</td>
									<td className='px-3 py-2'>
										{t(`assets:type.${category.assetType}`)}
									</td>
									<td className='px-3 py-2'>
										{category.defaultDepreciationMethod}
									</td>
									<td className='px-3 py-2'>
										{category.defaultUsefulLifeMonths ?? '—'}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
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
