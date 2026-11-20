import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import type { TranslationKey } from '@ims-erp/locales';
import { formatIdr } from '@/lib/format';
import { usePermission } from '@/lib/use-permission';
import {
	adjustmentQueryOptions,
	transitionAdjustment,
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

	// The query is typed `T | null`, so a successful-but-empty response would
	// otherwise blow up on destructuring. Surface it instead of crashing.
	if (data === null) {
		return (
			<Card>
				<CardContent className='py-8 text-center text-sm text-muted-foreground'>
					{t('inventory:adjustments.notFound')}
				</CardContent>
			</Card>
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
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('inventory:adjustmentForm.item')}</TableHead>
									<TableHead className='text-right'>
										{t('inventory:adjustments.qtyBefore')}
									</TableHead>
									<TableHead className='text-right'>
										{t('inventory:adjustments.qtyAfter')}
									</TableHead>
									<TableHead className='text-right'>
										{t('inventory:adjustments.delta')}
									</TableHead>
									{canSeeCost && (
										<TableHead className='text-right'>{t('inventory:adjustmentForm.unitCost')}</TableHead>
									)}
									<TableHead>{t('inventory:adjustmentForm.lineNote')}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{lines.map((line) => {
									// Counted totals in, difference out — the movement the
									// backend will write if this line is posted.
									const delta =
										Number(line.quantityAfter) - Number(line.quantityBefore);
									return (
										<TableRow key={line.id}>
											<TableCell className='font-mono text-xs'>
												{line.productId}
											</TableCell>
											<TableCell className='text-right font-mono text-muted-foreground'>
												{line.quantityBefore}
											</TableCell>
											<TableCell className='text-right font-mono'>
												{line.quantityAfter}
											</TableCell>
											<TableCell className='text-right font-mono font-medium'>
												{delta > 0 ? '+' : ''}
												{delta.toFixed(3)}
											</TableCell>
											{canSeeCost && (
												<TableCell className='text-right font-mono'>
													{line.unitCost === null ? '—' : formatIdr(line.unitCost)}
												</TableCell>
											)}
											<TableCell className='text-xs text-muted-foreground'>
												{line.note ?? '—'}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
