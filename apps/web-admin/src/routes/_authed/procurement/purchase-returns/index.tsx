import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import {
	PURCHASE_RETURN_STATUSES,
	purchaseReturnsQueryOptions,
	RETURN_STATUS_VARIANT,
	type TPurchaseReturnStatus,
} from '@/lib/purchase-return-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/procurement/purchase-returns` — goods sent back to suppliers (ERP-0068). */
export const Route = createFileRoute('/_authed/procurement/purchase-returns/')({
	component: PurchaseReturnListPage,
});

function PurchaseReturnListPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const canCreate = usePermission('purchase_return.create');
	const canSeeCost = usePermission('product.read_cost');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TPurchaseReturnStatus | ''>('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		purchaseReturnsQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined }),
	);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('procurement:returns.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('procurement:returns.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/procurement/purchase-returns/new' />} nativeButton={false}>
						{t('procurement:returns.new')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap items-center gap-3'>
				<InputGroup className='max-w-sm'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('procurement:returns.search')}
						placeholder={t('procurement:returns.search')}
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
					/>
				</InputGroup>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === 'all' || value == null ? '' : (value as TPurchaseReturnStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('procurement:po.status')} className='w-48'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('procurement:pos.allStatuses')}</SelectItem>
						{PURCHASE_RETURN_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`procurement:returnStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('procurement:returns.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('procurement:return.code')}</TableHead>
										<TableHead>{t('procurement:receipt.code')}</TableHead>
										<TableHead>{t('procurement:po.supplier')}</TableHead>
										<TableHead>{t('procurement:return.date')}</TableHead>
										<TableHead>{t('procurement:po.status')}</TableHead>
										{canSeeCost && <TableHead className='text-right'>{t('procurement:return.total')}</TableHead>}
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((row) => (
										<TableRow key={row.id}>
											<TableCell>
												<Link
													to='/procurement/purchase-returns/$purchaseReturnId'
													params={{ purchaseReturnId: row.id }}
													className='font-medium hover:underline'
												>
													{row.code ?? t('procurement:po.noNumber')}
												</Link>
												<div className='text-xs text-muted-foreground'>{row.reason}</div>
											</TableCell>
											<TableCell>{row.goodsReceiptCode}</TableCell>
											<TableCell>{row.supplierName}</TableCell>
											<TableCell className='text-muted-foreground'>{formatBusinessDate(row.returnDate, i18n.language)}</TableCell>
											<TableCell>
												<Badge variant={RETURN_STATUS_VARIANT[row.status]}>{t(`procurement:returnStatus.${row.status}`)}</Badge>
											</TableCell>
											{canSeeCost && <TableCell className='text-right'>{formatIdr(row.totalAmount)}</TableCell>}
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
					{data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
		</div>
	);
}
