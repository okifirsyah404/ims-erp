import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { PackageOpen } from 'lucide-react';
import { itemsQueryOptions, type TItemKind } from '@/lib/inventory-api';

/** Rows per page in the detail tabs. */
const PAGE_SIZE = 10;

/**
 * Trims a decimal-string quantity (`numeric(18,3)` wire format) to at most
 * three fraction digits, dropping trailing zeros: `'2.000'` → `'2'`,
 * `'1.500'` → `'1.5'`.
 */
function formatQuantity(value: string): string {
	const number = Number(value);
	return Number.isFinite(number)
		? String(Math.round(number * 1000) / 1000)
		: value;
}

/**
 * Read-only item table for one kind, scoped to a warehouse.
 *
 * @remarks
 * Server-side pagination and search: page and search are component state
 * that flows into the query key, so each change is a fresh request, and
 * `placeholderData` keeps the previous page visible while the next loads.
 * `warehouseId` narrows to items with stock in the warehouse (backend EXISTS
 * filter over live units) and decorates each row with the item's
 * `quantity_on_hand` summed over `stock_balances` bins — the Quantity column
 * therefore covers serialized and quantity-tracked items alike.
 */
export function WarehouseItemTable({
	warehouseId,
	itemKind,
}: {
	warehouseId: string;
	itemKind: Extract<TItemKind, 'product' | 'component' | 'material' | 'tool'>;
}) {
	const { t } = useTranslation(['inventory', 'common']);
	const [page, setPage] = useState(1);
	const [searchTerm, setSearchTerm] = useState('');
	const [submittedSearch, setSubmittedSearch] = useState('');

	const { data, isPending, isError, error } = useQuery({
		...itemsQueryOptions({
			itemKind,
			warehouseId,
			search: submittedSearch || undefined,
			page,
			limit: PAGE_SIZE,
		}),
		placeholderData: (previous) => previous,
	});

	// Keep page in range when a filter shrinks the result set.
	const pagination = data?.pagination;
	const effectivePage = Math.min(page, pagination?.totalPages ?? page);

	if (isError) {
		return (
			<Card>
				<CardContent className='py-8 text-center text-sm text-muted-foreground'>
					{error instanceof Error ? error.message : t('common:error.failed')}
				</CardContent>
			</Card>
		);
	}

	const rows = data?.rows ?? [];

	return (
		<Card>
			<CardContent className='flex flex-col gap-3'>
				<Input
					className='w-64'
					placeholder={t('inventory:warehouses.searchPlaceholder')}
					value={searchTerm}
					onChange={(event) => setSearchTerm(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							setPage(1);
							setSubmittedSearch(searchTerm);
						}
					}}
				/>
				{rows.length === 0 && !isPending ? (
					<EmptyState
						icon={PackageOpen}
						title={t('inventory:items.emptyTitle')}
						description={t('inventory:items.empty')}
						className='py-4'
					/>
				) : (
					<Table aria-busy={isPending || undefined}>
						<TableHeader>
							<TableRow>
								<TableHead>{t('inventory:items.sku')}</TableHead>
								<TableHead>{t('inventory:items.name')}</TableHead>
								<TableHead>{t('inventory:items.unitLabel')}</TableHead>
								<TableHead className='text-right'>
									{t('inventory:warehouses.quantity')}
								</TableHead>
								<TableHead>{t('inventory:items.minStockQty')}</TableHead>
								<TableHead className='text-right'>
									<span className='sr-only'>{t('common:action.edit')}</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((item) => (
								<TableRow key={item.id}>
									<TableCell className='font-mono text-xs'>
										{item.sku}
									</TableCell>
									<TableCell>{item.name}</TableCell>
									<TableCell className='text-muted-foreground'>
										{item.unitLabel ?? '—'}
									</TableCell>
									<TableCell className='text-right tabular-nums'>
										{item.quantityOnHand == null
											? '—'
											: formatQuantity(item.quantityOnHand)}
									</TableCell>
									<TableCell className='tabular-nums'>
										{item.minStockQty}
									</TableCell>
									<TableCell className='text-right'>
										<Button
											variant='ghost'
											size='sm'
											render={
												<Link
													to='/inventory/items/$itemId'
													params={{ itemId: item.id }}
												/>
											}
										>
											{t('common:action.edit')}
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
				{pagination && (
					<PaginationControls
						page={effectivePage}
						totalPages={pagination.totalPages}
						onPageChange={setPage}
					/>
				)}
			</CardContent>
		</Card>
	);
}
