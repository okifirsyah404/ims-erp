import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Wrench } from 'lucide-react';
import { getRouteApi } from '@tanstack/react-router';

import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';
import {
	assetsQueryOptions,
	assetDetailQueryOptions,
	formatMoney,
	type TAssetMaintenance,
} from '@/lib/asset-api';

/** The route API for `/assets/service-records` (validated search params). */
const routeApi = getRouteApi('/_authed/assets/service-records/');

/**
 * Service records page (Phase A-4): maintenance history. The operations API
 * exposes maintenances per asset, so this page walks the register and shows
 * the latest service trail per asset via the detail endpoint.
 */
export function AssetServiceRecordList() {
	const { t } = useTranslation(['assets', 'common']);
	const navigate = routeApi.useNavigate();
	const search = routeApi.useSearch();

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...assetsQueryOptions({ page, limit: 10 }),
		placeholderData: (previous) => previous,
	});

	if (isError) {
		return <ErrorState error={error} bordered />;
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('assets:service.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('assets:service.description')}
				</p>
			</div>

			{isPending ? (
				<SectionSkeleton lines={6} />
			) : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={Wrench}
					title={t('assets:service.emptyTitle')}
					description={t('assets:service.empty')}
					bordered
				/>
			) : (
				<div className='space-y-4'>
					{data.rows.map((asset) => (
						<ServiceTrail
							key={asset.id}
							assetId={asset.id}
							assetCode={asset.code}
							assetName={asset.name}
						/>
					))}
				</div>
			)}

			<PaginationControls
				page={page}
				totalPages={data?.pagination.totalPages ?? 1}
				onPageChange={(next) =>
					void navigate({ search: (prev) => ({ ...prev, page: next }) })
				}
			/>
		</div>
	);
}

/** One asset's maintenance trail (from the detail endpoint). */
function ServiceTrail({
	assetId,
	assetCode,
	assetName,
}: {
	assetId: string;
	assetCode: string;
	assetName: string;
}) {
	const { t } = useTranslation(['assets', 'common']);
	const { data } = useQuery({
		...assetDetailQueryOptions(assetId),
		placeholderData: (previous) => previous,
	});

	const rows = data?.history.maintenances ?? [];

	const columns = useMemo<ColumnDef<DataTableFeatures, TAssetMaintenance, CellData>[]>(
		() => [
			{
				accessorKey: 'code',
				header: t('assets:service.code'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				id: 'maintenanceType',
				accessorFn: (row) => t(`maintenanceType.${row.maintenanceType}`),
				header: t('assets:service.type'),
				cell: ({ row }) => t(`maintenanceType.${row.original.maintenanceType}`),
			},
			{
				id: 'date',
				accessorFn: (row) => row.performedDate ?? row.scheduledDate ?? '',
				header: t('assets:service.date'),
				cell: ({ row }) =>
					row.original.performedDate ?? row.original.scheduledDate ?? '—',
			},
			{
				id: 'cost',
				accessorFn: (row) => row.cost,
				header: t('assets:service.cost'),
				meta: { align: 'right' },
				cell: ({ row }) =>
					formatMoney(row.original.cost, row.original.currencyCode),
			},
			{
				id: 'status',
				accessorFn: (row) => row.status,
				header: t('assets:service.status'),
				cell: ({ row }) => (
					<Badge variant='secondary'>
						{t(
							`assets:maintenanceStatus.${row.original.status}` as 'assets:maintenanceStatus.scheduled',
						)}
					</Badge>
				),
			},
		],
		[t],
	);

	return (
		<DataTableCard title={assetName} description={assetCode}>
			<DataTable
				columns={columns}
				data={rows}
				getRowId={(row) => row.id}
				empty={<span className='text-sm text-muted-foreground'>{t('detail.noHistory')}</span>}
			/>
		</DataTableCard>
	);
}
