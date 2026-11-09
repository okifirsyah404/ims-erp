import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import { goodsReceiptQueryOptions } from '@/lib/goods-receipt-api';
import { usePermission } from '@/lib/use-permission';

/** `/procurement/receipts/$receiptId` — one posted goods receipt. */
export const Route = createFileRoute('/_authed/procurement/receipts/$receiptId')({
	component: GoodsReceiptDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

function GoodsReceiptDetailPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const { receiptId } = Route.useParams();
	const canSeeCost = usePermission('product.read_cost');
	const { data, isPending, isError, error } = useQuery(goodsReceiptQueryOptions(receiptId));
	const language = i18n.language === 'en' ? 'en-GB' : 'id-ID';

	if (isPending) return null;
	if (isError) return <p className='p-6 text-sm text-destructive'>{error.message}</p>;

	return (
		<div className='flex flex-col gap-6 p-6'>
			<Link to='/procurement/receipts' className='text-sm text-muted-foreground hover:underline'>
				{t('procurement:receipts.back')}
			</Link>
			<div>
				<h1 className='text-2xl font-bold'>{data.code}</h1>
				<p className='text-sm text-muted-foreground'>{t('procurement:receipts.posted')}</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>{t('procurement:receipts.source')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-3 text-sm sm:grid-cols-3'>
					<div>
						<div className='text-muted-foreground'>{t('procurement:po.code')}</div>
						<Link
							to='/procurement/purchase-orders/$purchaseOrderId'
							params={{ purchaseOrderId: data.purchaseOrderId }}
							className='hover:underline'
						>
							{data.purchaseOrderCode ?? '—'}
						</Link>
					</div>
					<Detail label={t('procurement:po.supplier')} value={data.supplierName} />
					<Detail label={t('procurement:receipt.date')} value={formatBusinessDate(data.receiptDate, i18n.language)} />
					<Detail label={t('procurement:receipt.warehouse')} value={data.warehouse ? `${data.warehouse.code} — ${data.warehouse.name}` : null} />
					<Detail label={t('procurement:receipt.bin')} value={data.bin ? data.bin.code : null} />
					<Detail label={t('procurement:receipt.supplierDeliveryRef')} value={data.supplierDeliveryRef} />
				</CardContent>
			</Card>
			<Card>
				<CardContent className='p-0'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('procurement:po.item')}</TableHead>
								<TableHead className='text-right'>{t('procurement:receipt.quantity')}</TableHead>
								{canSeeCost && <TableHead className='text-right'>{t('procurement:receipt.unitCost')}</TableHead>}
								<TableHead>{t('procurement:receipt.serialNumbers')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.items.map((item) => (
								<TableRow key={item.id}>
									<TableCell>
										<div className='font-medium'>{item.name}</div>
										<div className='text-xs text-muted-foreground'>{item.sku}</div>
									</TableCell>
									<TableCell className='text-right'>
										{Number(item.quantity).toLocaleString(language)} {item.unit}
									</TableCell>
									{canSeeCost && <TableCell className='text-right'>{formatIdr(item.unitCost)}</TableCell>}
									<TableCell className='text-sm'>{item.serialNumbers?.join(', ') ?? '—'}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
			{data.notes && <p className='text-sm text-muted-foreground'>{data.notes}</p>}
		</div>
	);
}
