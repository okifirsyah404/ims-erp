import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import { goodsReceiptQueryOptions, type TGoodsReceiptItem } from '@/lib/goods-receipt-api';
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

/** The receipt's lines; its own component so the column hooks run before the page's early returns. */
function ReceiptItemsTable({
	items,
	canSeeCost,
	language,
}: {
	items: TGoodsReceiptItem[];
	canSeeCost: boolean;
	language: string;
}) {
	const { t } = useTranslation(['procurement', 'common']);
	const columns = useMemo<ColumnDef<DataTableFeatures, TGoodsReceiptItem, CellData>[]>(() => {
		const costColumn: ColumnDef<DataTableFeatures, TGoodsReceiptItem, CellData>[] = canSeeCost
			? [
					{
						id: 'unitCost',
						header: t('procurement:receipt.unitCost'),
						meta: { align: 'right' },
						cell: ({ row }) => formatIdr(row.original.unitCost),
					},
				]
			: [];
		return [
			{
				id: 'item',
				header: t('procurement:po.item'),
				cell: ({ row }) => (
					<>
						<div className='font-medium'>{row.original.name}</div>
						<div className='text-xs text-muted-foreground'>{row.original.sku}</div>
					</>
				),
			},
			{
				id: 'quantity',
				header: t('procurement:receipt.quantity'),
				meta: { align: 'right' },
				cell: ({ row }) => `${Number(row.original.quantity).toLocaleString(language)} ${row.original.unit}`,
			},
			...costColumn,
			{
				id: 'serialNumbers',
				header: t('procurement:receipt.serialNumbers'),
				meta: { cellClassName: 'text-sm' },
				cell: ({ row }) => row.original.serialNumbers?.join(', ') ?? '—',
			},
		];
	}, [t, canSeeCost, language]);

	return <DataTable columns={columns} data={items} getRowId={(row) => row.id} />;
}

function GoodsReceiptDetailPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const { receiptId } = Route.useParams();
	const canSeeCost = usePermission('product.read_cost');
	const canReturn = usePermission('purchase_return.create');
	const { data, isPending, isError, error } = useQuery(goodsReceiptQueryOptions(receiptId));
	const language = i18n.language === 'en' ? 'en-GB' : 'id-ID';

	if (isPending) return <PageSkeleton />;
	if (isError) return <ErrorState error={error} bordered />;

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/procurement/receipts' className='text-sm text-muted-foreground hover:underline'>
				{t('procurement:receipts.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.code}</h1>
					<p className='text-sm text-muted-foreground'>{t('procurement:receipts.posted')}</p>
				</div>
				{canReturn && (
					<Button
						variant='outline'
						render={<Link to='/procurement/purchase-returns/new' search={{ goodsReceiptId: receiptId }} />}
						nativeButton={false}
					>
						{t('procurement:returns.returnGoods')}
					</Button>
				)}
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
			<Card className='gap-0 py-0'>
				<CardContent className='p-0'>
					<ReceiptItemsTable items={data.items} canSeeCost={canSeeCost} language={language} />
				</CardContent>
			</Card>
			{data.notes && <p className='text-sm text-muted-foreground'>{data.notes}</p>}
		</div>
	);
}
