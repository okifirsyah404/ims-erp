import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
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
import { formatBusinessDate, formatIdr } from '@/lib/format';
import {
	PO_STATUS_VARIANT,
	PURCHASE_ORDER_STATUSES,
	purchaseOrdersQueryOptions,
	type TPurchaseOrderStatus,
} from '@/lib/procurement-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/procurement/purchase-orders` — purchase orders (ADR-0011 step 4a). */
export const Route = createFileRoute('/_authed/procurement/purchase-orders/')({
	component: PurchaseOrderListPage,
});

function PurchaseOrderListPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const canCreate = usePermission('purchase_order.create');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TPurchaseOrderStatus | ''>('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		purchaseOrdersQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined }),
	);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('procurement:pos.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('procurement:pos.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/procurement/purchase-orders/new' />} nativeButton={false}>
						{t('procurement:pos.new')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap items-center gap-2'>
				<Input
					type='search'
					className='max-w-sm'
					aria-label={t('procurement:pos.search')}
					placeholder={t('procurement:pos.search')}
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
				/>
				<select
					aria-label={t('procurement:po.status')}
					className='h-9 rounded-md border bg-transparent px-3 text-sm'
					value={status}
					onChange={(e) => {
						setStatus(e.target.value as TPurchaseOrderStatus | '');
						setPage(1);
					}}
				>
					<option value=''>{t('procurement:pos.allStatuses')}</option>
					{PURCHASE_ORDER_STATUSES.map((value) => (
						<option key={value} value={value}>
							{t(`procurement:status.${value}`)}
						</option>
					))}
				</select>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('procurement:pos.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('procurement:po.code')}</TableHead>
										<TableHead>{t('procurement:po.supplier')}</TableHead>
										<TableHead>{t('procurement:po.orderDate')}</TableHead>
										<TableHead>{t('procurement:po.status')}</TableHead>
										<TableHead className='text-right'>{t('procurement:po.grandTotal')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((order) => (
										<TableRow key={order.id}>
											<TableCell>
												<Link
													to='/procurement/purchase-orders/$purchaseOrderId'
													params={{ purchaseOrderId: order.id }}
													className='font-medium hover:underline'
												>
													{order.code ?? t('procurement:po.noNumber')}
												</Link>
												<div className='text-xs text-muted-foreground'>{order.subject}</div>
											</TableCell>
											<TableCell>{order.supplierSnapshot.name}</TableCell>
											<TableCell className='text-muted-foreground'>{formatBusinessDate(order.orderDate, i18n.language)}</TableCell>
											<TableCell>
												<Badge variant={PO_STATUS_VARIANT[order.status]}>{t(`procurement:status.${order.status}`)}</Badge>
											</TableCell>
											<TableCell className='text-right'>{formatIdr(order.grandTotal)}</TableCell>
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
