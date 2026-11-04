import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { CircleAlert, Wrench } from 'lucide-react';
import { getRouteApi } from '@tanstack/react-router';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import {
	assetsQueryOptions,
	assetDetailQueryOptions,
	formatMoney,
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
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('assets:service.emptyTitle')}
				description={error.message}
			/>
		);
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('assets:service.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('assets:service.description')}
				</p>
			</div>

			{isPending ? null : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={Wrench}
					title={t('assets:service.emptyTitle')}
					description={t('assets:service.empty')}
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

	return (
		<div className='overflow-hidden rounded-lg border'>
			<div className='flex items-center justify-between bg-muted/50 px-3 py-2'>
				<span className='font-medium'>{assetName}</span>
				<span className='font-mono text-xs text-muted-foreground'>
					{assetCode}
				</span>
			</div>
			{rows.length === 0 ? (
				<p className='px-3 py-2 text-sm text-muted-foreground'>
					{t('detail.noHistory')}
				</p>
			) : (
				<table className='w-full text-sm'>
					<tbody>
						{rows.map((maintenance) => (
							<tr key={maintenance.id} className='border-t'>
								<td className='px-3 py-2 font-mono text-xs'>
									{maintenance.code}
								</td>
								<td className='px-3 py-2'>
									{t(`maintenanceType.${maintenance.maintenanceType}`)}
								</td>
								<td className='px-3 py-2'>
									{maintenance.performedDate ?? maintenance.scheduledDate ?? '—'}
								</td>
								<td className='px-3 py-2'>
									{formatMoney(maintenance.cost, maintenance.currencyCode)}
								</td>
								<td className='px-3 py-2'>
									<Badge variant='secondary'>
										{t(
											`assets:maintenanceStatus.${maintenance.status}` as 'assets:maintenanceStatus.scheduled',
										)}
									</Badge>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
