import { Link } from '@tanstack/react-router';
import { useState } from 'react';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { balancesQueryOptions, recomputeBalances } from '@/lib/stock-api';

/**
 * The stock balance list: what is on hand, per warehouse.
 *
 * @remarks
 * A balance row's `organizationId` follows the **warehouse**, not the viewer
 * (data-model "scope rule"), so `organizationId === null` means the row belongs
 * to a global warehouse and is **shared** by every organization — not
 * "unowned". The badge says "Shared" for that reason; showing a blank scope
 * would read as missing data.
 *
 * `quantityAvailable` is displayed rather than derived: the column is a real
 * Postgres `CHECK` (`available = on_hand - reserved`), so the UI must not
 * recompute it and risk disagreeing.
 */
export function StockList() {
	const { t } = useTranslation(['inventory', 'common']);
	const queryClient = useQueryClient();
	const [inStockOnly, setInStockOnly] = useState(false);
	const { data, isPending, isError, error } = useQuery(
		balancesQueryOptions({ limit: 100, inStockOnly }),
	);

	const recompute = useMutation({
		mutationFn: () => recomputeBalances(),
		onSuccess: () => {
			// Rebuilding rewrites every balance row, so the list is stale.
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
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-semibold'>{t('inventory:stock.title')}</h1>
					<p className='text-sm text-muted-foreground'>
						{t('inventory:stock.description')}
					</p>
				</div>
				<div className='flex shrink-0 items-center gap-2'>
					<label className='flex items-center gap-2 text-sm'>
						<Checkbox
							checked={inStockOnly}
							onCheckedChange={(checked) => setInStockOnly(checked === true)}
						/>
						{t('inventory:stock.inStockOnly')}
					</label>
					<Button
						variant='outline'
						render={<Link to='/inventory/stock/movements' />}
					>
						{t('inventory:stock.movements')}
					</Button>
					<Button render={<Link to='/inventory/stock/adjust' />}>
						{t('inventory:stock.adjust')}
					</Button>
				</div>
			</div>

			{/* A repair tool, not a routine call: the running balance is already
			    correct, so this is offered but not advertised. */}
			<div className='flex items-center gap-3'>
				<Button
					variant='ghost'
					size='sm'
					disabled={recompute.isPending}
					onClick={() => {
						const body = t('inventory:stock.recomputeConfirmBody');
						const heading = t('inventory:stock.recomputeConfirm');
						if (window.confirm(`${heading}\n\n${body}`)) {
							recompute.mutate(undefined);
						}
					}}
				>
					{t('inventory:stock.recompute')}
				</Button>
				{recompute.isSuccess && recompute.data ? (
					<span className='text-xs text-muted-foreground'>
						{t('inventory:stock.recomputed', {
							written: recompute.data.written,
							removed: recompute.data.removed,
						})}
					</span>
				) : null}
				{recompute.isError ? (
					<span className='text-xs text-destructive'>
						{recompute.error.message}
					</span>
				) : null}
			</div>

			{rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						{t('inventory:stock.empty')}
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className='p-0'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('inventory:stock.item')}</TableHead>
									<TableHead>{t('inventory:stock.warehouse')}</TableHead>
									<TableHead>{t('inventory:stock.bin')}</TableHead>
									<TableHead>{t('inventory:stock.scope')}</TableHead>
									<TableHead className='text-right'>
										{t('inventory:stock.onHand')}
									</TableHead>
									<TableHead className='text-right'>
										{t('inventory:stock.reserved')}
									</TableHead>
									<TableHead className='text-right'>
										{t('inventory:stock.available')}
									</TableHead>
									<TableHead>{t('inventory:stock.lastMovement')}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row) => (
									<TableRow key={row.id}>
										<TableCell>
											<Link
												to='/inventory/items/$itemId'
												params={{ itemId: row.itemId }}
												className='hover:underline'
											>
												{row.itemName ?? (
													<span className='font-mono text-xs text-muted-foreground'>
														{row.itemId}
													</span>
												)}
											</Link>
										</TableCell>
										<TableCell>
											<Link
												to='/inventory/warehouses/$warehouseId'
												params={{ warehouseId: row.warehouseId }}
												className='hover:underline'
											>
												{row.warehouseName ?? (
													<span className='font-mono text-xs text-muted-foreground'>
														{row.warehouseId}
													</span>
												)}
											</Link>
										</TableCell>
										<TableCell>
											{row.binId === null ? (
												<span className='text-muted-foreground'>
													{t('inventory:stock.noBin')}
												</span>
											) : (
												<span className='font-mono text-xs'>{row.binId}</span>
											)}
										</TableCell>
										<TableCell>
											{row.organizationId === null ? (
												<Badge variant='secondary'>
													{t('inventory:stock.shared')}
												</Badge>
											) : (
												<Badge variant='outline'>
													{t('inventory:warehouses.organization')}
												</Badge>
											)}
										</TableCell>
										<TableCell className='text-right font-mono'>
											{row.quantityOnHand}
										</TableCell>
										<TableCell className='text-right font-mono text-muted-foreground'>
											{row.quantityReserved}
										</TableCell>
										<TableCell className='text-right font-mono font-medium'>
											{row.quantityAvailable}
										</TableCell>
										<TableCell className='text-xs text-muted-foreground'>
											{row.lastMovementAt === null
												? '—'
												: new Date(row.lastMovementAt).toLocaleString()}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
