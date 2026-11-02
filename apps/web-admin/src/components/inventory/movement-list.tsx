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
	movementsQueryOptions,
	OUTBOUND_MOVEMENT_TYPES,
	reverseMovement,
	type TStockMovement,
} from '@/lib/stock-api';

/**
 * The movement ledger.
 *
 * @remarks
 * Read-only apart from reversal, because the ledger is **append-only**: a wrong
 * movement is corrected by appending an opposing one, never by editing. Two
 * consequences shape this screen:
 *
 * - Only a `posted` row offers Reverse. A `reversed` row already has its
 *   opposing pair, and the backend refuses a second reversal outright.
 * - Only an **inbound** type can be reversed safely in the common case —
 *   reversing an outbound movement adds stock back, while reversing an inbound
 *   one removes stock and may go negative. The backend refuses that, so the
 *   error is surfaced rather than pre-empted here with a stale balance.
 */
export function MovementList() {
	const { t } = useTranslation(['inventory', 'common']);
	const queryClient = useQueryClient();
	const { data, isPending, isError, error } = useQuery(
		movementsQueryOptions({ limit: 100 }),
	);

	const reversal = useMutation({
		mutationFn: (movementId: string) => reverseMovement(movementId),
		onSuccess: () => {
			// The balance moved as a side effect of the reversal, so both lists
			// are stale — not just the ledger.
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

	const rows = data?.rows ?? [];

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-2xl font-semibold'>{t('inventory:movements.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('inventory:movements.description')}
				</p>
			</div>

			{reversal.isError ? (
				<p className='text-sm text-destructive'>{reversal.error.message}</p>
			) : null}
			{reversal.isSuccess ? (
				<p className='text-sm text-muted-foreground'>
					{t('inventory:movements.reversed')}
				</p>
			) : null}

			{rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						{t('inventory:movements.empty')}
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className='p-0'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('inventory:movements.code')}</TableHead>
									<TableHead>{t('inventory:movements.type')}</TableHead>
									<TableHead>{t('inventory:movements.item')}</TableHead>
									<TableHead className='text-right'>
										{t('inventory:movements.quantity')}
									</TableHead>
									<TableHead>{t('inventory:movements.statusLabel')}</TableHead>
									<TableHead>{t('inventory:movements.reference')}</TableHead>
									<TableHead>{t('inventory:movements.notes')}</TableHead>
									<TableHead>{t('inventory:movements.occurredAt')}</TableHead>
									<TableHead className='text-right'>
										{t('common:action.edit')}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row) => (
									<MovementRow
										key={row.id}
										row={row}
										pending={reversal.isPending}
										onReverse={() => reversal.mutate(row.id)}
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

/** One ledger row, with the direction glyph the signed display needs. */
function MovementRow({
	row,
	pending,
	onReverse,
}: {
	row: TStockMovement;
	pending: boolean;
	onReverse: () => void;
}) {
	const { t } = useTranslation(['inventory', 'common']);
	// Direction is a property of the type, not the (unsigned) quantity — the
	// same rule the backend's `isOutbound` applies.
	const outbound = OUTBOUND_MOVEMENT_TYPES.has(row.movementType);

	return (
		<TableRow>
			<TableCell className='font-mono text-xs'>{row.code}</TableCell>
			<TableCell>
				{t(`inventory:movements.type.${row.movementType}` as TranslationKey, {
					defaultValue: row.movementType,
				})}
			</TableCell>
			<TableCell className='font-mono text-xs'>{row.itemId}</TableCell>
			<TableCell className='text-right font-mono'>
				{outbound ? '−' : '+'}
				{row.quantity}
			</TableCell>
			<TableCell>
				<Badge variant={row.status === 'reversed' ? 'outline' : 'secondary'}>
					{t(`inventory:movements.status.${row.status}` as TranslationKey, {
						defaultValue: row.status,
					})}
				</Badge>
			</TableCell>
			<TableCell className='text-xs'>
				{row.referenceType === null ? (
					<span className='text-muted-foreground'>—</span>
				) : (
					<span className='font-mono'>
						{row.referenceType}
						{row.referenceId === null ? '' : `:${row.referenceId}`}
					</span>
				)}
			</TableCell>
			<TableCell className='text-xs text-muted-foreground'>
				{row.notes ?? '—'}
			</TableCell>
			<TableCell className='text-xs text-muted-foreground'>
				{new Date(row.occurredAt).toLocaleString()}
			</TableCell>
			<TableCell className='text-right'>
				{/* Only a posted row can be reversed: the backend refuses a second
				    reversal, so offering the button would be a guaranteed error. */}
				{row.status === 'posted' ? (
					<Button
						variant='ghost'
						size='sm'
						disabled={pending}
						onClick={() => {
							// Irreversible and refused if it would go negative, so the
							// consequence is stated before the request, not after.
							const heading = t('inventory:movements.reverseConfirm');
							const body = t('inventory:movements.reverseConfirmBody');
							if (window.confirm(`${heading}\n\n${body}`)) onReverse();
						}}
					>
						{t('inventory:movements.reverse')}
					</Button>
				) : null}
			</TableCell>
		</TableRow>
	);
}
