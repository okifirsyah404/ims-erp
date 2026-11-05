import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { Textarea } from '@ims-erp/ui/components/textarea';
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
	const [dialog, setDialog] = useState<'reject' | 'cancel' | null>(null);
	const [reason, setReason] = useState('');
	const [busy, setBusy] = useState(false);
	const { data, isPending, isError, error } = useQuery(purchaseOrderQueryOptions(purchaseOrderId));

	async function run(action: () => Promise<unknown>, message: string) {
		setBusy(true);
		try {
			await action();
			await queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-orders'] });
			toast.success(message);
			setDialog(null);
			setReason('');
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	}

	if (isPending) return null;
	if (isError) return <p className='p-6 text-sm text-destructive'>{error.message}</p>;

	const own = data.createdBy === session?.user.id;
	const supplier = data.supplierSnapshot;
	const cancellable = ['draft', 'submitted', 'approved', 'sent'].includes(data.status);

	return (
		<div className='flex flex-col gap-6 p-6'>
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
						<Detail label={t('procurement:supplier.addressLine')} value={supplier.address} />
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

			<Card>
				<CardContent className='p-0'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('procurement:po.item')}</TableHead>
								<TableHead className='text-right'>{t('procurement:po.quantity')}</TableHead>
								<TableHead className='text-right'>{t('procurement:po.received')}</TableHead>
								<TableHead className='text-right'>{t('procurement:po.unitPrice')}</TableHead>
								<TableHead className='text-right'>{t('procurement:po.lineTotal')}</TableHead>
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
										{Number(item.quantity).toLocaleString(i18n.language === 'en' ? 'en-GB' : 'id-ID')} {item.unit}
									</TableCell>
									<TableCell className='text-right'>{Number(item.quantityReceived).toLocaleString(i18n.language === 'en' ? 'en-GB' : 'id-ID')}</TableCell>
									<TableCell className='text-right'>{formatIdr(item.unitPrice)}</TableCell>
									<TableCell className='text-right'>{formatIdr(item.lineTotal)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
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
