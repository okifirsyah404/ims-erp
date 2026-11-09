import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
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
import { formatBusinessDate } from '@/lib/format';
import { goodsReceiptsQueryOptions } from '@/lib/goods-receipt-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/procurement/receipts` — goods receipts (ADR-0011 step 4b). */
export const Route = createFileRoute('/_authed/procurement/receipts/')({
	component: GoodsReceiptListPage,
});

function GoodsReceiptListPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const canReceive = usePermission('stock.receive');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		goodsReceiptsQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined }),
	);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('procurement:receipts.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('procurement:receipts.description')}</p>
				</div>
				{canReceive && (
					<Button render={<Link to='/procurement/receipts/new' />} nativeButton={false}>
						{t('procurement:receipts.new')}
					</Button>
				)}
			</div>
			<Input
				type='search'
				className='max-w-sm'
				aria-label={t('procurement:receipts.search')}
				placeholder={t('procurement:receipts.search')}
				value={search}
				onChange={(e) => {
					setSearch(e.target.value);
					setPage(1);
				}}
			/>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('procurement:receipts.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('procurement:receipt.code')}</TableHead>
										<TableHead>{t('procurement:po.code')}</TableHead>
										<TableHead>{t('procurement:po.supplier')}</TableHead>
										<TableHead>{t('procurement:receipt.date')}</TableHead>
										<TableHead>{t('procurement:receipt.supplierDeliveryRef')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((receipt) => (
										<TableRow key={receipt.id}>
											<TableCell>
												<Link
													to='/procurement/receipts/$receiptId'
													params={{ receiptId: receipt.id }}
													className='font-medium hover:underline'
												>
													{receipt.code}
												</Link>
											</TableCell>
											<TableCell>{receipt.purchaseOrderCode ?? '—'}</TableCell>
											<TableCell>{receipt.supplierName}</TableCell>
											<TableCell className='text-muted-foreground'>{formatBusinessDate(receipt.receiptDate, i18n.language)}</TableCell>
											<TableCell>{receipt.supplierDeliveryRef ?? '—'}</TableCell>
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
