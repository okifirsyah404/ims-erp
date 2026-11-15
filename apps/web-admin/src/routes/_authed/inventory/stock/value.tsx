import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatIdr } from '@/lib/format';
import { stockValuationQueryOptions } from '@/lib/stock-valuation-api';

const PAGE_SIZE = 50;

/** `/inventory/stock/value` — stock at moving-average cost (ADR-0011 step 5b). */
export const Route = createFileRoute('/_authed/inventory/stock/value')({
	component: InventoryValuePage,
});

function InventoryValuePage() {
	const { t, i18n } = useTranslation(['inventory', 'common']);
	const [page, setPage] = useState(1);
	const [warehouseId, setWarehouseId] = useState('');
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		stockValuationQueryOptions({ page, limit: PAGE_SIZE, warehouseId: warehouseId || undefined, search: deferredSearch || undefined }),
	);
	// The warehouse filter offers the warehouses that hold stock (all of them
	// when unfiltered); keep the last full list while a filter is applied.
	const [warehouseOptions, setWarehouseOptions] = useState<{ id: string; label: string }[]>([]);
	if (data && !warehouseId && data.warehouses.length !== warehouseOptions.length) {
		setWarehouseOptions(data.warehouses.map((row) => ({ id: row.warehouseId, label: `${row.code} — ${row.name}` })));
	}
	const language = i18n.language === 'en' ? 'en-GB' : 'id-ID';

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('inventory:value.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('inventory:value.description')}</p>
			</div>
			{isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : isPending ? null : (
				<>
					<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
						<Card>
							<CardHeader>
								<CardTitle className='text-sm font-medium text-muted-foreground'>{t('inventory:value.total')}</CardTitle>
							</CardHeader>
							<CardContent className='text-2xl font-bold'>{formatIdr(data.grandTotal)}</CardContent>
						</Card>
						{data.warehouses.map((row) => (
							<Card key={row.warehouseId}>
								<CardHeader>
									<CardTitle className='text-sm font-medium text-muted-foreground'>
										{row.code} — {row.name}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className='text-xl font-semibold'>{formatIdr(row.totalValue)}</div>
									<div className='text-xs text-muted-foreground'>{t('inventory:value.balances', { count: row.balances })}</div>
								</CardContent>
							</Card>
						))}
					</div>
					<div className='flex flex-wrap gap-2'>
						<Select
							value={warehouseId || 'all'}
							onValueChange={(value: string | null) => {
								setWarehouseId(value === 'all' || value == null ? '' : value);
								setPage(1);
							}}
						>
							<SelectTrigger aria-label={t('inventory:value.warehouse')} className='w-60'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>{t('inventory:value.allWarehouses')}</SelectItem>
								{warehouseOptions.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<InputGroup className='max-w-sm'>
							<InputGroupAddon align='inline-start'>
								<Search aria-hidden='true' />
							</InputGroupAddon>
							<InputGroupInput
								type='search'
								aria-label={t('inventory:value.search')}
								placeholder={t('inventory:value.search')}
								value={search}
								onChange={(event) => {
									setSearch(event.target.value);
									setPage(1);
								}}
							/>
						</InputGroup>
					</div>
					{data.data.length === 0 ? (
						<Card>
							<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('inventory:value.empty')}</CardContent>
						</Card>
					) : (
						<Card>
							<CardContent className='p-0'>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{t('inventory:value.item')}</TableHead>
											<TableHead>{t('inventory:value.warehouse')}</TableHead>
											<TableHead className='text-right'>{t('inventory:value.quantity')}</TableHead>
											<TableHead className='text-right'>{t('inventory:value.averageCost')}</TableHead>
											<TableHead className='text-right'>{t('inventory:value.totalValue')}</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{data.data.map((row) => (
											<TableRow key={`${row.itemId}-${row.warehouseId}-${row.binCode ?? ''}`}>
												<TableCell>
													<div className='font-medium'>{row.name}</div>
													<div className='text-xs text-muted-foreground'>{row.sku}</div>
												</TableCell>
												<TableCell>
													{row.warehouseCode}
													{row.binCode ? ` · ${row.binCode}` : ''}
												</TableCell>
												<TableCell className='text-right'>
													{Number(row.quantityOnHand).toLocaleString(language)} {row.unit}
												</TableCell>
												<TableCell className='text-right'>{formatIdr(row.averageCost)}</TableCell>
												<TableCell className='text-right font-medium'>{formatIdr(row.totalValue)}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					)}
					{data.meta.totalPages > 1 && (
						<PaginationControls page={data.meta.page} totalPages={data.meta.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
		</div>
	);
}
