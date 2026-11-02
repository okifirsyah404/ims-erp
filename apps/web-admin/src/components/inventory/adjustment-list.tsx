import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import type { TranslationKey } from '@ims-erp/locales';
import {
	adjustmentsQueryOptions,
	transitionAdjustment,
	type TAdjustmentStatus,
	type TStockAdjustment,
} from '@/lib/adjustment-api';
import { toast } from '@/components/toast';

/** Badge emphasis per status: only `posted` actually moved stock. */
const STATUS_VARIANT: Record<
	TAdjustmentStatus,
	'default' | 'secondary' | 'outline'
> = {
	draft: 'outline',
	submitted: 'secondary',
	approved: 'secondary',
	rejected: 'outline',
	posted: 'default',
	cancelled: 'outline',
};

/**
 * The adjustment document list, with the workflow actions available per status.
 *
 * @remarks
 * The buttons offered here mirror the backend state machine
 * (`draft → submitted → approved|rejected → posted|cancelled`); the machine is
 * still authoritative, so an illegal edge is refused server-side no matter what
 * this table renders. Rendering only legal actions keeps the common path from
 * producing a predictable 422.
 */
export function AdjustmentList() {
	const { t } = useTranslation(['inventory', 'common']);
	const queryClient = useQueryClient();
	const { data, isPending, isError, error } = useQuery(
		adjustmentsQueryOptions({ limit: 100 }),
	);

	const transition = useMutation({
		mutationFn: ({
			id,
			action,
		}: {
			id: string;
			action: 'submit' | 'approve' | 'reject' | 'cancel' | 'post';
		}) => transitionAdjustment(id, action),
		onSuccess: (_data, { action }) => {
			// Confirm which edge of the state machine actually ran: the row's new
			// badge shows the result, but the action that produced it is not
			// obvious when several rows are in flight. Each key is spelled out
			// here (not looked up) so the compiler and the dead-key scan see it.
			switch (action) {
				case 'submit':
					toast.success(t('inventory:adjustmentActions.submitted'));
					break;
				case 'approve':
					toast.success(t('inventory:adjustmentActions.approved'));
					break;
				case 'reject':
					toast.success(t('inventory:adjustmentActions.rejected'));
					break;
				case 'cancel':
					toast.success(t('inventory:adjustmentActions.cancelled'));
					break;
				case 'post':
					toast.success(t('inventory:adjustmentActions.posted'));
					break;
			}
			// Posting writes ledger rows and moves balances, so every stock query
			// is stale — not just this list.
			void queryClient.invalidateQueries({ queryKey: ['stock'] });
		},
		onError: (mutationError) => {
			toast.error(mutationError.message);
		},
	});

	if (isPending) {
		return (
			<Card>
				<CardContent className='py-8 text-center text-sm text-muted-foreground'>
					{t('common:state.loading')}
				</CardContent>
			</Card>
		);
	}

	if (isError) {
		return (
			<Card>
				<CardContent className='py-8 text-center text-sm text-destructive'>
					{error.message}
				</CardContent>
			</Card>
		);
	}

	const rows = data?.rows ?? [];

	return (
		<div className='space-y-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-semibold'>
						{t('inventory:adjustments.title')}
					</h1>
					<p className='text-sm text-muted-foreground'>
						{t('inventory:adjustments.description')}
					</p>
				</div>
				<Button
					render={<Link to='/inventory/stock/adjust' />}
					className='shrink-0'
				>
					{t('inventory:adjustments.new')}
				</Button>
			</div>

			{transition.isError ? (
				<p className='text-sm text-destructive'>{transition.error.message}</p>
			) : null}

			{rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						{t('inventory:adjustments.empty')}
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className='p-0'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('inventory:adjustments.code')}</TableHead>
									<TableHead>{t('inventory:adjustments.type')}</TableHead>
									<TableHead>{t('inventory:adjustments.statusLabel')}</TableHead>
									<TableHead>
										{t('inventory:adjustments.requestedBy')}
									</TableHead>
									<TableHead>
										{t('inventory:adjustments.requestedAt')}
									</TableHead>
									<TableHead className='text-right'>
										{t('common:action.edit')}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row) => (
									<AdjustmentRow
										key={row.id}
										row={row}
										pending={transition.isPending}
										onAction={(action) =>
											transition.mutate({ id: row.id, action })
										}
									/>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

/** One document row plus the actions its status allows. */
function AdjustmentRow({
	row,
	pending,
	onAction,
}: {
	row: TStockAdjustment;
	pending: boolean;
	onAction: (
		action: 'submit' | 'approve' | 'reject' | 'cancel' | 'post',
	) => void;
}) {
	const { t } = useTranslation(['inventory', 'common']);

	return (
		<TableRow>
			<TableCell className='font-mono text-xs'>
				<Link
					to='/inventory/stock/adjustments/$adjustmentId'
					params={{ adjustmentId: row.id }}
					className='hover:underline'
				>
					{row.code}
				</Link>
			</TableCell>
			<TableCell>
				{t(`inventory:adjustments.type.${row.adjustmentType}` as TranslationKey, {
					defaultValue: row.adjustmentType,
				})}
			</TableCell>
			<TableCell>
				<Badge variant={STATUS_VARIANT[row.status]}>
					{t(`inventory:adjustments.status.${row.status}` as TranslationKey, {
						defaultValue: row.status,
					})}
				</Badge>
			</TableCell>
			<TableCell className='font-mono text-xs text-muted-foreground'>
				{row.requestedBy ?? '—'}
			</TableCell>
			<TableCell className='text-xs text-muted-foreground'>
				{new Date(row.requestedAt).toLocaleString()}
			</TableCell>
			<TableCell className='space-x-1 text-right'>
				{row.status === 'draft' ? (
					<>
						<Button
							size='sm'
							variant='ghost'
							disabled={pending}
							onClick={() => onAction('submit')}
						>
							{t('inventory:adjustmentActions.submit')}
						</Button>
						<Button
							size='sm'
							variant='ghost'
							disabled={pending}
							onClick={() => onAction('cancel')}
						>
							{t('inventory:adjustmentActions.cancel')}
						</Button>
					</>
				) : null}
				{row.status === 'submitted' ? (
					<>
						<Button
							size='sm'
							disabled={pending}
							onClick={() => onAction('approve')}
						>
							{t('inventory:adjustmentActions.approve')}
						</Button>
						<Button
							size='sm'
							variant='ghost'
							disabled={pending}
							onClick={() => onAction('reject')}
						>
							{t('inventory:adjustmentActions.reject')}
						</Button>
					</>
				) : null}
				{row.status === 'approved' ? (
					<Button
						size='sm'
						disabled={pending}
						onClick={() => onAction('post')}
					>
						{t('inventory:adjustmentActions.post')}
					</Button>
				) : null}
			</TableCell>
		</TableRow>
	);
}
