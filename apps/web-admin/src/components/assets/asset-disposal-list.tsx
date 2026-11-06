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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { CircleAlert, Trash2 } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	DISPOSAL_METHODS,
	disposalsQueryOptions,
	executeDisposal,
	approveDisposal,
	cancelDisposal,
	formatMoney,
	requestDisposal,
	assetsQueryOptions,
	type TDisposalMethod,
} from '@/lib/asset-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/assets/disposals` (validated search params). */
const routeApi = getRouteApi('/_authed/assets/disposals/');

const PAGE_SIZE = 20;

/**
 * Disposal workflow page (Phase A-4 / D21): list with approve / execute /
 * cancel actions per row, and a request-disposal dialog that picks an asset.
 */
export function AssetDisposalList() {
	const { t } = useTranslation(['assets', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const [requestOpen, setRequestOpen] = useState(false);
	const canDispose = usePermission('asset.dispose');

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...disposalsQueryOptions({ page, limit: PAGE_SIZE }),
		placeholderData: (previous) => previous,
	});

	const invalidate = async () => {
		await queryClient.invalidateQueries({ queryKey: ['asset-disposals'] });
		await queryClient.invalidateQueries({ queryKey: ['assets'] });
	};

	const approve = useMutation({
		mutationFn: approveDisposal,
		onSuccess: async () => {
			toast.success(t('assets:disposals.approved'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});
	const execute = useMutation({
		mutationFn: executeDisposal,
		onSuccess: async () => {
			toast.success(t('assets:disposals.executed'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});
	const cancel = useMutation({
		mutationFn: cancelDisposal,
		onSuccess: async () => {
			toast.success(t('assets:disposals.cancelled'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	if (isError) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('assets:disposals.emptyTitle')}
				description={error.message}
			/>
		);
	}

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold'>{t('assets:disposals.title')}</h1>
					<p className='text-sm text-muted-foreground'>
						{t('assets:disposals.description')}
					</p>
				</div>
				{canDispose ? (
					<Button onClick={() => setRequestOpen(true)}>
						{t('assets:detail.dispose')}
					</Button>
				) : null}
			</div>

			{isPending ? null : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={Trash2}
					title={t('assets:disposals.emptyTitle')}
					description={t('assets:disposals.empty')}
				/>
			) : (
				<div className='overflow-hidden rounded-lg border'>
					<table className='w-full text-sm'>
						<thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
							<tr>
								<th className='px-3 py-2'>{t('assets:disposals.code')}</th>
								<th className='px-3 py-2'>{t('assets:disposals.status')}</th>
								<th className='px-3 py-2'>{t('assets:disposals.method')}</th>
								<th className='px-3 py-2'>{t('assets:disposals.proceeds')}</th>
								<th className='px-3 py-2' />
							</tr>
						</thead>
						<tbody>
							{data.rows.map((disposal) => (
								<tr key={disposal.id} className='border-t'>
									<td className='px-3 py-2 font-mono text-xs'>
										{disposal.code}
									</td>
									<td className='px-3 py-2'>
										<Badge variant='secondary'>
											{t(`assets:disposalStatus.${disposal.status}`)}
										</Badge>
									</td>
									<td className='px-3 py-2'>
										{t(`assets:disposalMethod.${disposal.disposalMethod}`)}
									</td>
									<td className='px-3 py-2'>
										{formatMoney(disposal.proceedsAmount, disposal.currencyCode)}
									</td>
									<td className='px-3 py-2'>
										{canDispose ? (
											<div className='flex justify-end gap-2'>
												{disposal.status === 'draft' ||
												disposal.status === 'submitted' ? (
													<Button
														size='sm'
														variant='outline'
														disabled={approve.isPending}
														onClick={() =>
															void approve.mutateAsync(disposal.id)
														}
													>
														{t('assets:disposals.approve')}
													</Button>
												) : null}
												{disposal.status === 'approved' ? (
													<Button
														size='sm'
														disabled={execute.isPending}
														onClick={() =>
															void execute.mutateAsync(disposal.id)
														}
													>
														{t('assets:disposals.execute')}
													</Button>
												) : null}
												{disposal.status !== 'executed' &&
												disposal.status !== 'cancelled' ? (
													<Button
														size='sm'
														variant='ghost'
														disabled={cancel.isPending}
														onClick={() =>
															void cancel.mutateAsync(disposal.id)
														}
													>
														{t('assets:disposals.cancel')}
													</Button>
												) : null}
											</div>
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

			{requestOpen ? (
				<RequestDisposalDialog onClose={() => setRequestOpen(false)} />
			) : null}
		</div>
	);
}

/** Requests a disposal for a selected asset (creates a draft, D21). */
function RequestDisposalDialog({ onClose }: { onClose: () => void }) {
	const { t } = useTranslation('assets');
	const queryClient = useQueryClient();
	const [assetId, setAssetId] = useState('');
	const [method, setMethod] = useState<TDisposalMethod>('scrap');
	const [proceeds, setProceeds] = useState('0');

	const assets = useQuery({
		...assetsQueryOptions({ page: 1, limit: 50 }),
		placeholderData: (previous) => previous,
	});

	const request = useMutation({
		mutationFn: () =>
			requestDisposal(assetId, {
				disposalMethod: method,
				proceedsAmount: Number(proceeds) || 0,
			}),
		onSuccess: async () => {
			toast.success(t('disposalRequested'));
			onClose();
			await queryClient.invalidateQueries({ queryKey: ['asset-disposals'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('form.disposeTitle')}</DialogTitle>
					<DialogDescription>{t('form.disposeDescription')}</DialogDescription>
				</DialogHeader>
				<div className='space-y-3'>
					<Select value={assetId} onValueChange={(value) => setAssetId(value ?? '')}>
						<SelectTrigger>
							<SelectValue placeholder={t('toolSets.assetId')} />
						</SelectTrigger>
						<SelectContent>
							{(assets.data?.rows ?? []).map((asset) => (
								<SelectItem key={asset.id} value={asset.id}>
									{asset.code} — {asset.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={method}
						onValueChange={(value: string | null) => setMethod(value as TDisposalMethod)}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{DISPOSAL_METHODS.map((value) => (
								<SelectItem key={value} value={value}>
									{t(`disposalMethod.${value}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						type='number'
						placeholder={t('form.proceedsAmount')}
						value={proceeds}
						onChange={(event) => setProceeds(event.target.value)}
					/>
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={onClose}>
						{t('form.cancel')}
					</Button>
					<Button
						disabled={!assetId || request.isPending}
						onClick={() => void request.mutateAsync()}
					>
						{t('form.dispose')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
