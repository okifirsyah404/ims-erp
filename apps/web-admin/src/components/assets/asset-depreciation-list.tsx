import {
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { CircleAlert, TrendingDown } from 'lucide-react';
import { getRouteApi } from '@tanstack/react-router';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	assetsQueryOptions,
	formatMoney,
	recordDepreciation,
} from '@/lib/asset-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/assets/depreciation` (validated search params). */
const routeApi = getRouteApi('/_authed/assets/depreciation/');

/**
 * Depreciation entries page (Phase A-4 / D14): the manual monthly
 * depreciation log, now owned by finance (`POST /finance/depreciations`).
 * Entries are recorded per asset from the record dialog;
 * the list itself is the register with book values, so operators pick a row
 * and record the period entry against it.
 */
export function AssetDepreciationList() {
	const { t } = useTranslation(['assets', 'common']);
	const navigate = routeApi.useNavigate();
	const search = routeApi.useSearch();
	const [target, setTarget] = useState<string | null>(null);
	const canUpdate = usePermission('asset.update');

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...assetsQueryOptions({ page, limit: 12 }),
		placeholderData: (previous) => previous,
	});

	if (isError) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('assets:depreciation.emptyTitle')}
				description={error.message}
			/>
		);
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>
					{t('assets:depreciation.title')}
				</h1>
				<p className='text-sm text-muted-foreground'>
					{t('assets:depreciation.description')}
				</p>
			</div>

			{isPending ? null : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={TrendingDown}
					title={t('assets:depreciation.emptyTitle')}
					description={t('assets:depreciation.empty')}
				/>
			) : (
				<div className='overflow-hidden rounded-lg border'>
					<table className='w-full text-sm'>
						<thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
							<tr>
								<th className='px-3 py-2'>{t('assets:register.code')}</th>
								<th className='px-3 py-2'>{t('assets:register.name')}</th>
								<th className='px-3 py-2'>{t('assets:register.bookValue')}</th>
								<th className='px-3 py-2' />
							</tr>
						</thead>
						<tbody>
							{data.rows.map((asset) => (
								<tr key={asset.id} className='border-t'>
									<td className='px-3 py-2 font-mono text-xs'>{asset.code}</td>
									<td className='px-3 py-2'>{asset.name}</td>
									<td className='px-3 py-2'>
										{formatMoney(asset.bookValue, asset.currencyCode)}
									</td>
									<td className='px-3 py-2 text-right'>
										{canUpdate && asset.status !== 'disposed' ? (
											<Button
												size='sm'
												variant='outline'
												onClick={() => setTarget(asset.id)}
											>
												{t('assets:depreciation.record')}
											</Button>
										) : null}
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

			{target ? (
				<RecordDepreciationDialog assetId={target} onClose={() => setTarget(null)} />
			) : null}
		</div>
	);
}

/** Default period for a new depreciation entry (current year-month). */
function defaultPeriod(): { year: string; month: string } {
	const now = new Date();
	return { year: String(now.getFullYear()), month: String(now.getMonth() + 1) };
}

/** Manual depreciation entry dialog (D14): idempotent per period. */
function RecordDepreciationDialog({
	assetId,
	onClose,
}: {
	assetId: string;
	onClose: () => void;
}) {
	const { t } = useTranslation('assets');
	const queryClient = useQueryClient();
	const [{ year, month }, setPeriod] = useState(defaultPeriod);
	const [amount, setAmount] = useState('0');

	const record = useMutation({
		mutationFn: (input: {
			periodYear: number;
			periodMonth: number;
			depreciationAmount: number;
		}) => recordDepreciation(assetId, input),
		onSuccess: async () => {
			toast.success(t('depreciated'));
			onClose();
			await queryClient.invalidateQueries({ queryKey: ['assets'] });
			await queryClient.invalidateQueries({ queryKey: ['asset-depreciations'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('depreciation.record')}</DialogTitle>
					<DialogDescription>{t('depreciation.description')}</DialogDescription>
				</DialogHeader>
				<div className='space-y-3'>
					<Input
						type='number'
						placeholder={t('depreciation.periodYear')}
						value={year}
						onChange={(event) =>
							setPeriod((prev) => ({ ...prev, year: event.target.value }))
						}
					/>
					<Input
						type='number'
						min={1}
						max={12}
						placeholder={t('depreciation.periodMonth')}
						value={month}
						onChange={(event) =>
							setPeriod((prev) => ({ ...prev, month: event.target.value }))
						}
					/>
					<Input
						type='number'
						placeholder={t('depreciation.depreciationAmount')}
						value={amount}
						onChange={(event) => setAmount(event.target.value)}
					/>
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={onClose}>
						{t('form.cancel')}
					</Button>
					<Button
						disabled={record.isPending || Number(amount) <= 0}
						onClick={() =>
							void record.mutateAsync({
								periodYear: Number(year),
								periodMonth: Number(month),
								depreciationAmount: Number(amount),
							})
						}
					>
						{t('depreciation.record')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
