import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import type { TranslationKey } from '@ims-erp/locales';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { formatIdr } from '@/lib/format';
import { usePermission } from '@/lib/use-permission';
import {
	adjustmentQueryOptions,
	transitionAdjustment,
	type TStockAdjustmentItem,
} from '@/lib/adjustment-api';

/**
 * One adjustment document with its lines and the actions its status allows.
 *
 * @remarks
 * The line table shows **system / counted / difference** side by side: the
 * document stores counted totals, so the difference the movement will take is
 * derived here for the reader. A zero difference is called out because such a
 * line posts nothing — and that is correct, not a bug.
 */
export function AdjustmentDetail({ adjustmentId }: { adjustmentId: string }) {
	const canSeeCost = usePermission('product.read_cost');
	const { t } = useTranslation(['inventory', 'common']);
	const queryClient = useQueryClient();
	const { data, isPending, isError, error } = useQuery(
		adjustmentQueryOptions(adjustmentId),
	);

	const transition = useMutation({
		mutationFn: (
			action: 'submit' | 'approve' | 'reject' | 'cancel' | 'post',
		) => transitionAdjustment(adjustmentId, action),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['stock'] });
		},
	});

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TStockAdjustmentItem, CellData>[]
	>(() => {
		const base: ColumnDef<DataTableFeatures, TStockAdjustmentItem, CellData>[] = [
			{
				id: 'item',
				header: t('inventory:adjustmentForm.item'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => row.original.productId,
			},
			{
				id: 'qtyBefore',
				header: t('inventory:adjustments.qtyBefore'),
				meta: { align: 'right', cellClassName: 'font-mono text-muted-foreground' },
				cell: ({ row }) => row.original.quantityBefore,
			},
			{
				id: 'qtyAfter',
				header: t('inventory:adjustments.qtyAfter'),
				meta: { align: 'right', cellClassName: 'font-mono' },
				cell: ({ row }) => row.original.quantityAfter,
			},
			{
				id: 'delta',
				header: t('inventory:adjustments.delta'),
				meta: { align: 'right', cellClassName: 'font-mono font-medium' },
				// Counted totals in, difference out — the movement the backend
				// will write if this line is posted.
				cell: ({ row }) => {
					const delta =
						Number(row.original.quantityAfter) -
						Number(row.original.quantityBefore);
					return (
						<>
							{delta > 0 ? '+' : ''}
							{delta.toFixed(3)}
						</>
					);
				},
			},
		];
		if (canSeeCost) {
			base.push({
				id: 'unitCost',
				header: t('inventory:adjustmentForm.unitCost'),
				meta: { align: 'right', cellClassName: 'font-mono' },
				cell: ({ row }) =>
					row.original.unitCost === null ? '—' : formatIdr(row.original.unitCost),
			});
		}
		base.push({
			id: 'note',
			header: t('inventory:adjustmentForm.lineNote'),
			meta: { cellClassName: 'text-xs text-muted-foreground' },
			cell: ({ row }) => row.original.note ?? '—',
		});
		return base;
	}, [canSeeCost, t]);

	if (isPending) return <PageSkeleton />;

	if (isError) return <ErrorState error={error} bordered />;

	// The query is typed `T | null`, so a successful-but-empty response would
	// otherwise blow up on destructuring. Surface it instead of crashing.
	if (data === null) {
		return (
			<EmptyState title={t('inventory:adjustments.notFound')} bordered />
		);
	}

	const { adjustment, lines } = data;

	return (
		<div className='space-y-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='flex items-center gap-3 text-2xl font-semibold'>
						<span className='font-mono text-lg'>{adjustment.code}</span>
						<Badge variant={adjustment.status === 'posted' ? 'default' : 'secondary'}>
							{t(`inventory:adjustments.status.${adjustment.status}` as TranslationKey, {
								defaultValue: adjustment.status,
							})}
						</Badge>
					</h1>
					<dl className='mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-3'>
						<div>
							<dt className='inline'>
								{t('inventory:adjustments.requestedBy')}:{' '}
							</dt>
							<dd className='inline font-mono'>
								{adjustment.requestedBy ?? '—'}
							</dd>
						</div>
						<div>
							<dt className='inline'>
								{t('inventory:adjustments.requestedAt')}:{' '}
							</dt>
							<dd className='inline'>
								{new Date(adjustment.requestedAt).toLocaleString()}
							</dd>
						</div>
						<div>
							<dt className='inline'>{t('inventory:adjustments.type')}: </dt>
							<dd className='inline'>
								{t(
									`inventory:adjustments.type.${adjustment.adjustmentType}` as TranslationKey,
									{ defaultValue: adjustment.adjustmentType },
								)}
							</dd>
						</div>
						<div>
							<dt className='inline'>
								{t('inventory:adjustments.approvedBy')}:{' '}
							</dt>
							<dd className='inline font-mono'>
								{adjustment.approvedBy ?? '—'}
							</dd>
						</div>
						<div>
							<dt className='inline'>{t('inventory:adjustments.postedAt')}: </dt>
							<dd className='inline'>
								{adjustment.postedAt === null
									? '—'
									: new Date(adjustment.postedAt).toLocaleString()}
							</dd>
						</div>
					</dl>
					{adjustment.reasonCode ? (
						<p className='mt-2 text-sm text-muted-foreground'>
							<span className='font-medium'>
								{t('inventory:adjustmentForm.reasonCode')}:
							</span>{' '}
							{adjustment.reasonCode}
						</p>
					) : null}
					{adjustment.notes ? (
						<p className='mt-2 text-sm text-muted-foreground'>
							<span className='font-medium'>
								{t('inventory:adjustments.notes')}:
							</span>{' '}
							{adjustment.notes}
						</p>
					) : null}
				</div>

				{/*
				 * Approve is disabled for the requester rather than hidden: the
				 * backend refuses self-approval outright, and a missing button
				 * would read as "the workflow is broken" instead of "get a second
				 * pair of eyes". The hint below explains the rule.
				 */}
				<div className='flex shrink-0 flex-col items-end gap-2'>
					<div className='flex gap-2'>
					{adjustment.status === 'draft' ? (
						<>
							<Button
								disabled={transition.isPending}
								onClick={() => transition.mutate('submit')}
							>
								{t('inventory:adjustmentActions.submit')}
							</Button>
							<Button
								variant='ghost'
								disabled={transition.isPending}
								onClick={() => transition.mutate('cancel')}
							>
								{t('inventory:adjustmentActions.cancel')}
							</Button>
						</>
					) : null}
					{adjustment.status === 'submitted' ? (
						<>
							<Button
								disabled={transition.isPending}
								onClick={() => transition.mutate('approve')}
							>
								{t('inventory:adjustmentActions.approve')}
							</Button>
							<Button
								variant='ghost'
								disabled={transition.isPending}
								onClick={() => transition.mutate('reject')}
							>
								{t('inventory:adjustmentActions.reject')}
							</Button>
						</>
					) : null}
					{adjustment.status === 'submitted' ? (
						<p className='max-w-xs text-right text-xs text-muted-foreground'>
							{t('inventory:adjustmentActions.selfApprovalBlocked')}
						</p>
					) : null}
					{adjustment.status === 'approved' ? (
						<Button
							disabled={transition.isPending}
							onClick={() => transition.mutate('post')}
						>
							{t('inventory:adjustmentActions.post')}
						</Button>
					) : null}
					</div>
				</div>
			</div>

			{transition.isError ? (
				<p className='text-sm text-destructive'>{transition.error.message}</p>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle>{t('inventory:adjustments.lines')}</CardTitle>
				</CardHeader>
				<CardContent className='p-0'>
					{lines.length === 0 ? (
						<CardContent className='py-8 text-center text-sm text-muted-foreground'>
							{t('inventory:adjustments.noLines')}
						</CardContent>
					) : (
						<DataTable
							columns={columns}
							data={lines}
							getRowId={(line) => line.id}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
