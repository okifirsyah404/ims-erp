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
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { CircleAlert, ArrowLeftRight } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	assignAsset,
	assetsQueryOptions,
	ASSET_CONDITIONS,
	formatMoney,
	returnAsset,
	type TAsset,
	type TAssetStatus,
} from '@/lib/asset-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/assets/loans` (validated search params). */
const routeApi = getRouteApi('/_authed/assets/loans/');

const PAGE_SIZE = 12;

/**
 * Loans (custody) page (Phase A-4 / D12): one card per asset with an open
 * or past assignment, assign + return modals. The "open" badge is the
 * custody filter; overdue detection rides the open state (the asset is
 * still `in_use`).
 */
export function AssetLoanList() {
	const { t } = useTranslation(['assets', 'common']);
	const navigate = routeApi.useNavigate();
	const search = routeApi.useSearch();
	const [assignTarget, setAssignTarget] = useState<TAsset | null>(null);
	const [returnTarget, setReturnTarget] = useState<TAsset | null>(null);
	const canAssign = usePermission('asset.assign');
	const canReturn = usePermission('asset.return');

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...assetsQueryOptions({
			page,
			limit: PAGE_SIZE,
			status:
				search.status === 'open'
					? 'in_use'
					: (search.status as TAssetStatus | undefined),
		}),
		placeholderData: (previous) => previous,
	});

	if (isError) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('assets:loans.emptyTitle')}
				description={error.message}
			/>
		);
	}

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold'>{t('assets:loans.title')}</h1>
					<p className='text-sm text-muted-foreground'>
						{t('assets:loans.description')}
					</p>
				</div>
				<Select
					value={search.status ?? 'all'}
					onValueChange={(value: string | null) =>
						void navigate({
							search: (prev: { page?: number; status?: string }) => ({
								...prev,
								page: 1,
								status: value === 'all' || value === null ? undefined : value,
							}),
						})
					}
				>
					<SelectTrigger className='w-44'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('assets:loans.filterAll')}</SelectItem>
						<SelectItem value='open'>{t('assets:loans.open')}</SelectItem>
						<SelectItem value='in_stock'>{t('assets:status.in_stock')}</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{isPending ? null : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={ArrowLeftRight}
					title={t('assets:loans.emptyTitle')}
					description={t('assets:loans.empty')}
				/>
			) : (
				<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
					{data.rows.map((asset) => (
						<Card key={asset.id}>
							<CardHeader className='pb-2'>
								<div className='flex items-start justify-between gap-2'>
									<CardTitle className='text-base'>{asset.name}</CardTitle>
									{asset.status === 'in_use' ? (
										<Badge>{t('assets:loans.open')}</Badge>
									) : (
										<Badge variant='secondary'>
											{t(`assets:status.${asset.status}`)}
										</Badge>
									)}
								</div>
								<p className='font-mono text-xs text-muted-foreground'>
									{asset.code}
								</p>
							</CardHeader>
							<CardContent className='space-y-1 text-sm'>
								<p>
									{t('assets:register.bookValue')}:{' '}
									{formatMoney(asset.bookValue, asset.currencyCode)}
								</p>
							</CardContent>
							<CardFooter className='justify-end gap-2'>
								{canAssign && asset.status === 'in_stock' ? (
									<Button size='sm' onClick={() => setAssignTarget(asset)}>
										{t('assets:loans.assign')}
									</Button>
								) : null}
								{canReturn && asset.status === 'in_use' ? (
									<Button
										size='sm'
										variant='outline'
										onClick={() => setReturnTarget(asset)}
									>
										{t('assets:loans.return')}
									</Button>
								) : null}
							</CardFooter>
						</Card>
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

			{assignTarget ? (
				<AssignDialog asset={assignTarget} onClose={() => setAssignTarget(null)} />
			) : null}
			{returnTarget ? (
				<ReturnDialog asset={returnTarget} onClose={() => setReturnTarget(null)} />
			) : null}
		</div>
	);
}

/** Assign modal (D12): holder + condition at handover. */
function AssignDialog({
	asset,
	onClose,
}: {
	asset: TAsset;
	onClose: () => void;
}) {
	const { t } = useTranslation('assets');
	const queryClient = useQueryClient();
	const [holderUserId, setHolderUserId] = useState('');
	const [condition, setCondition] = useState<string>('good');
	const [notes, setNotes] = useState('');

	const assign = useMutation({
		mutationFn: () =>
			assignAsset(asset.id, {
				assignedToUserId: holderUserId || null,
				conditionOnAssign: condition,
				notes: notes || null,
			}),
		onSuccess: async () => {
			toast.success(t('assigned'));
			onClose();
			await queryClient.invalidateQueries({ queryKey: ['assets'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('form.assignTitle')}</DialogTitle>
					<DialogDescription>{t('form.assignDescription')}</DialogDescription>
				</DialogHeader>
				<div className='space-y-3'>
					<Input
						placeholder={t('form.holderUserId')}
						value={holderUserId}
						onChange={(event) => setHolderUserId(event.target.value)}
					/>
					<Select value={condition} onValueChange={(value) => setCondition(value ?? '')}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ASSET_CONDITIONS.map((value) => (
								<SelectItem key={value} value={value}>
									{t(`condition.${value}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						placeholder={t('form.notes')}
						value={notes}
						onChange={(event) => setNotes(event.target.value)}
					/>
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={onClose}>
						{t('form.cancel')}
					</Button>
					<Button
						disabled={!holderUserId || assign.isPending}
						onClick={() => void assign.mutateAsync()}
					>
						{assign.isPending ? t('form.assigning') : t('form.assign')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Return modal (D12): condition-in mandatory. */
function ReturnDialog({
	asset,
	onClose,
}: {
	asset: TAsset;
	onClose: () => void;
}) {
	const { t } = useTranslation('assets');
	const queryClient = useQueryClient();
	const [condition, setCondition] = useState<string>('good');
	const [notes, setNotes] = useState('');

	const returnMutation = useMutation({
		mutationFn: () =>
			returnAsset(asset.id, { conditionOnReturn: condition, notes: notes || null }),
		onSuccess: async () => {
			toast.success(t('returned'));
			onClose();
			await queryClient.invalidateQueries({ queryKey: ['assets'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('form.returnTitle')}</DialogTitle>
					<DialogDescription>{t('form.returnDescription')}</DialogDescription>
				</DialogHeader>
				<div className='space-y-3'>
					<Select value={condition} onValueChange={(value) => setCondition(value ?? '')}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ASSET_CONDITIONS.map((value) => (
								<SelectItem key={value} value={value}>
									{t(`condition.${value}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						placeholder={t('form.notes')}
						value={notes}
						onChange={(event) => setNotes(event.target.value)}
					/>
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={onClose}>
						{t('form.cancel')}
					</Button>
					<Button
						disabled={returnMutation.isPending}
						onClick={() => void returnMutation.mutateAsync()}
					>
						{returnMutation.isPending ? t('form.returning') : t('form.return')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
