import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { toast } from '@/components/toast';
import { authClient } from '@/lib/auth-client';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import {
	cancelPurchaseOrder,
	decidePurchaseOrder,
	PO_STATUS_VARIANT,
	purchaseOrderQueryOptions,
	sendPurchaseOrder,
	submitPurchaseOrder,
	type TPurchaseOrderItem,
} from '@/lib/procurement-api';
import { usePermission } from '@/lib/use-permission';

/** `/procurement/purchase-orders/$purchaseOrderId` — one PO: approval, sending, print. */
export const Route = createFileRoute('/_authed/procurement/purchase-orders/$purchaseOrderId/')({
	component: PurchaseOrderDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

/** The PO's lines; its own component so the column hooks run before the page's early returns. */
function OrderItemsTable({ items, language }: { items: TPurchaseOrderItem[]; language: string }) {
	const { t } = useTranslation(['procurement', 'common']);
	const columns = useMemo<ColumnDef<DataTableFeatures, TPurchaseOrderItem, CellData>[]>(
		() => [
			{
				id: 'item',
				header: t('procurement:po.item'),
				cell: ({ row }) => (
					<>
						<div className='font-medium'>{row.original.name}</div>
						<div className='text-xs text-muted-foreground'>{row.original.sku}</div>
						{row.original.purchaseRequestId && (
							<Link
								to='/procurement/purchase-requests/$purchaseRequestId'
								params={{ purchaseRequestId: row.original.purchaseRequestId }}
								className='text-xs hover:underline'
							>
								{t('procurement:po.fromRequest', { request: row.original.purchaseRequestCode ?? '—' })}
							</Link>
						)}
					</>
				),
			},
			{
				id: 'quantity',
				header: t('procurement:po.quantity'),
				meta: { align: 'right' },
				cell: ({ row }) => `${Number(row.original.quantity).toLocaleString(language)} ${row.original.unit}`,
			},
			{
				id: 'quantityReceived',
				header: t('procurement:po.received'),
				meta: { align: 'right' },
				cell: ({ row }) => Number(row.original.quantityReceived).toLocaleString(language),
			},
			{
				id: 'unitPrice',
				header: t('procurement:po.unitPrice'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.unitPrice),
			},
			{
				id: 'lineTotal',
				header: t('procurement:po.lineTotal'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.lineTotal),
			},
		],
		[t, language],
	);

	return <DataTable columns={columns} data={items} getRowId={(row) => row.id} />;
}

function PurchaseOrderDetailPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const { purchaseOrderId } = Route.useParams();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const canUpdate = usePermission('purchase_order.update');
	const canSubmit = usePermission('purchase_order.submit');
	const canApprove = usePermission('purchase_order.approve');
	const canSend = usePermission('purchase_order.send');
	const canCancel = usePermission('purchase_order.cancel');
	const canReceive = usePermission('stock.receive');
	const [dialog, setDialog] = useState<'reject' | 'cancel' | null>(null);
	const [reason, setReason] = useState('');
	const [busy, setBusy] = useState(false);
	const { data, isPending, isError, error } = useQuery(purchaseOrderQueryOptions(purchaseOrderId));

	async function run(action: () => Promise<unknown>, message: string) {
		setBusy(true);
		try {
			await action();
			// A cancelled PO frees its purchase request lines too.
			await queryClient.invalidateQueries({ queryKey: ['procurement'] });
			toast.success(message);
			setDialog(null);
			setReason('');
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	}

	if (isPending) return <PageSkeleton />;
	if (isError) return <ErrorState error={error} bordered />;

	const own = data.createdBy === session?.user.id;
	const supplier = data.supplierSnapshot;
	const cancellable = ['draft', 'submitted', 'approved', 'sent'].includes(data.status);

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/procurement/purchase-orders' className='text-sm text-muted-foreground hover:underline'>
				{t('procurement:pos.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.code ?? t('procurement:po.noNumber')}</h1>
					<p className='text-sm text-muted-foreground'>{data.subject}</p>
					<Badge className='mt-2' variant={PO_STATUS_VARIANT[data.status]}>
						{t(`procurement:status.${data.status}`)}
					</Badge>
				</div>
				<div className='flex flex-wrap gap-2'>
					{data.code && (
						<Button
							variant='outline'
							render={<Link to='/procurement/purchase-orders/$purchaseOrderId/print' params={{ purchaseOrderId }} />}
							nativeButton={false}
						>
							{t('procurement:po.print')}
						</Button>
					)}
					{data.status === 'draft' && canUpdate && (
						<Button
							variant='outline'
							render={<Link to='/procurement/purchase-orders/$purchaseOrderId/edit' params={{ purchaseOrderId }} />}
							nativeButton={false}
						>
							{t('common:action.edit')}
						</Button>
					)}
					{data.status === 'draft' && canSubmit && (
						<Button disabled={busy} onClick={() => void run(() => submitPurchaseOrder(purchaseOrderId), t('procurement:pos.submitted'))}>
							{t('procurement:pos.submit')}
						</Button>
					)}
					{data.status === 'submitted' && canApprove && !own && (
						<>
							<Button
								disabled={busy}
								onClick={() => void run(() => decidePurchaseOrder(purchaseOrderId, 'approve'), t('procurement:pos.approved'))}
							>
								{t('procurement:pos.approve')}
							</Button>
							<Button variant='outline' disabled={busy} onClick={() => setDialog('reject')}>
								{t('procurement:pos.reject')}
							</Button>
						</>
					)}
					{data.status === 'approved' && canSend && (
						<Button disabled={busy} onClick={() => void run(() => sendPurchaseOrder(purchaseOrderId), t('procurement:pos.sent'))}>
							{t('procurement:pos.markSent')}
						</Button>
					)}
					{(data.status === 'sent' || data.status === 'partially_received') && canReceive && (
						<Button
							render={<Link to='/procurement/receipts/new' search={{ purchaseOrderId }} />}
							nativeButton={false}
						>
							{t('procurement:receipts.receiveGoods')}
						</Button>
					)}
					{cancellable && canCancel && (
						<Button variant='outline' disabled={busy} onClick={() => setDialog('cancel')}>
							{t('procurement:pos.cancel')}
						</Button>
					)}
				</div>
			</div>
			{data.status === 'submitted' && canApprove && own && (
				<p className='text-sm text-muted-foreground'>{t('procurement:pos.ownNoApprove')}</p>
			)}
			{data.status === 'approved' && (
				<p className='text-sm text-muted-foreground'>{t('procurement:pos.approvedNotSent')}</p>
			)}
			{data.status === 'draft' && data.rejectionReason && (
				<p className='text-sm text-destructive'>
					{t('procurement:po.rejectionReason')}: {data.rejectionReason}
				</p>
			)}
			{data.status === 'cancelled' && data.cancelledReason && (
				<p className='text-sm text-muted-foreground'>
					{t('procurement:po.cancelledReason')}: {data.cancelledReason}
				</p>
			)}

			<div className='grid gap-6 lg:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle>{t('procurement:po.supplier')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('procurement:po.supplier')} value={`${supplier.code} — ${supplier.name}`} />
						<Detail label={t('procurement:supplier.picName')} value={[supplier.picName, supplier.picTitle && `(${supplier.picTitle})`].filter(Boolean).join(' ')} />
						<Detail label={t('procurement:supplier.phone')} value={supplier.phone} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t('procurement:po.header')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('procurement:po.category')} value={t(`procurement:category.${data.category}`)} />
						<Detail label={t('procurement:po.orderDate')} value={formatBusinessDate(data.orderDate, i18n.language)} />
						<Detail label={t('procurement:po.supplierQuoteRef')} value={data.supplierQuoteRef} />
						<Detail label={t('procurement:po.supplierQuoteDate')} value={formatBusinessDate(data.supplierQuoteDate, i18n.language)} />
						<Detail label={t('procurement:po.projectName')} value={data.projectName} />
						<Detail label={t('procurement:po.buyerPicName')} value={data.buyerPicName} />
						<Detail label={t('procurement:po.paymentTerms')} value={data.paymentTerms} />
						<Detail label={t('procurement:po.expectedDeliveryDate')} value={formatBusinessDate(data.expectedDeliveryDate, i18n.language)} />
					</CardContent>
				</Card>
			</div>

			<Card className='gap-0 py-0'>
				<CardContent className='p-0'>
					<OrderItemsTable items={data.items} language={i18n.language === 'en' ? 'en-GB' : 'id-ID'} />
					<dl className='ml-auto flex max-w-sm flex-col gap-1 p-4 text-sm'>
						<div className='flex justify-between'>
							<dt>{t('procurement:po.subtotal')}</dt>
							<dd>{formatIdr(data.subtotal)}</dd>
						</div>
						<div className='flex justify-between'>
							<dt>{t(`procurement:vatMode.${data.vatMode}`)}</dt>
							<dd>{formatIdr(data.taxTotal)}</dd>
						</div>
						<div className='flex justify-between border-t pt-1 text-base font-bold'>
							<dt>{t('procurement:po.grandTotal')}</dt>
							<dd>{formatIdr(data.grandTotal)}</dd>
						</div>
					</dl>
				</CardContent>
			</Card>

			<Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void run(
								() =>
									dialog === 'reject'
										? decidePurchaseOrder(purchaseOrderId, 'reject', reason.trim())
										: cancelPurchaseOrder(purchaseOrderId, reason.trim()),
								dialog === 'reject' ? t('procurement:pos.rejected') : t('procurement:pos.cancelled'),
							);
						}}
					>
						<DialogHeader>
							<DialogTitle>{dialog === 'reject' ? t('procurement:pos.reject') : t('procurement:pos.cancel')}</DialogTitle>
						</DialogHeader>
						<FieldGroup className='py-4'>
							<Field>
								<FieldLabel htmlFor='po-reason'>{t('procurement:po.reason')}</FieldLabel>
								<Textarea id='po-reason' required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setDialog(null)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || reason.trim() === ''}>
								{t('common:action.save')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
