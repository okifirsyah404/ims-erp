import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { formatBusinessDate, formatIdr, todayBusinessDate } from '@/lib/format';
import {
	cancelPurchaseReturn,
	decidePurchaseReturn,
	purchaseReturnQueryOptions,
	RETURN_STATUS_VARIANT,
	shipPurchaseReturn,
	submitPurchaseReturn,
} from '@/lib/purchase-return-api';
import { usePermission } from '@/lib/use-permission';

/** `/procurement/purchase-returns/$purchaseReturnId` — one return: approval and shipping. */
export const Route = createFileRoute('/_authed/procurement/purchase-returns/$purchaseReturnId/')({
	component: PurchaseReturnDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

function PurchaseReturnDetailPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const { purchaseReturnId } = Route.useParams();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const canUpdate = usePermission('purchase_return.update');
	const canSubmit = usePermission('purchase_return.submit');
	const canApprove = usePermission('purchase_return.approve');
	const canShip = usePermission('purchase_return.ship');
	const canCancel = usePermission('purchase_return.cancel');
	const canSeeCost = usePermission('product.read_cost');
	const [dialog, setDialog] = useState<'reject' | 'cancel' | 'ship' | null>(null);
	const [reason, setReason] = useState('');
	const [shipDate, setShipDate] = useState(todayBusinessDate());
	const [busy, setBusy] = useState(false);
	const { data, isPending, isError, error } = useQuery(purchaseReturnQueryOptions(purchaseReturnId));
	const language = i18n.language === 'en' ? 'en-GB' : 'id-ID';

	async function run(action: () => Promise<unknown>, message: string) {
		setBusy(true);
		try {
			await action();
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

	if (isPending) return null;
	if (isError) return <p className='text-sm text-destructive'>{error.message}</p>;

	const own = data.createdBy === session?.user.id;
	const cancellable = ['draft', 'submitted', 'approved'].includes(data.status);

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/procurement/purchase-returns' className='text-sm text-muted-foreground hover:underline'>
				{t('procurement:returns.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.code ?? t('procurement:po.noNumber')}</h1>
					<p className='text-sm text-muted-foreground'>{data.reason}</p>
					<Badge className='mt-2' variant={RETURN_STATUS_VARIANT[data.status]}>
						{t(`procurement:returnStatus.${data.status}`)}
					</Badge>
				</div>
				<div className='flex flex-wrap gap-2'>
					{data.status === 'draft' && canUpdate && (
						<Button
							variant='outline'
							render={<Link to='/procurement/purchase-returns/$purchaseReturnId/edit' params={{ purchaseReturnId }} />}
							nativeButton={false}
						>
							{t('common:action.edit')}
						</Button>
					)}
					{data.status === 'draft' && canSubmit && (
						<Button disabled={busy} onClick={() => void run(() => submitPurchaseReturn(purchaseReturnId), t('procurement:pos.submitted'))}>
							{t('procurement:pos.submit')}
						</Button>
					)}
					{data.status === 'submitted' && canApprove && !own && (
						<>
							<Button
								disabled={busy}
								onClick={() => void run(() => decidePurchaseReturn(purchaseReturnId, 'approve'), t('procurement:pos.approved'))}
							>
								{t('procurement:pos.approve')}
							</Button>
							<Button variant='outline' disabled={busy} onClick={() => setDialog('reject')}>
								{t('procurement:pos.reject')}
							</Button>
						</>
					)}
					{data.status === 'approved' && canShip && (
						<Button disabled={busy} onClick={() => setDialog('ship')}>
							{t('procurement:returns.ship')}
						</Button>
					)}
					{cancellable && canCancel && (
						<Button variant='outline' disabled={busy} onClick={() => setDialog('cancel')}>
							{t('procurement:returns.cancel')}
						</Button>
					)}
				</div>
			</div>
			{data.status === 'submitted' && canApprove && own && (
				<p className='text-sm text-muted-foreground'>{t('procurement:returns.ownNoApprove')}</p>
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
			{data.status === 'shipped' && <p className='text-sm text-muted-foreground'>{t('procurement:returns.shippedHint')}</p>}

			<Card>
				<CardHeader>
					<CardTitle>{t('procurement:returns.source')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-3 text-sm sm:grid-cols-3'>
					<div>
						<div className='text-muted-foreground'>{t('procurement:receipt.code')}</div>
						<Link to='/procurement/receipts/$receiptId' params={{ receiptId: data.goodsReceiptId }} className='hover:underline'>
							{data.goodsReceiptCode}
						</Link>
					</div>
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
					<Detail label={t('procurement:return.date')} value={formatBusinessDate(data.returnDate, i18n.language)} />
					<Detail label={t('procurement:receipt.warehouse')} value={data.warehouse ? `${data.warehouse.code} — ${data.warehouse.name}` : null} />
					<Detail label={t('procurement:receipt.bin')} value={data.bin ? data.bin.code : null} />
				</CardContent>
			</Card>

			<Card>
				<CardContent className='p-0'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('procurement:po.item')}</TableHead>
								<TableHead className='text-right'>{t('procurement:return.quantity')}</TableHead>
								{canSeeCost && <TableHead className='text-right'>{t('procurement:receipt.unitCost')}</TableHead>}
								{canSeeCost && <TableHead className='text-right'>{t('procurement:po.lineTotal')}</TableHead>}
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
									{canSeeCost && <TableCell className='text-right'>{formatIdr(item.lineTotal)}</TableCell>}
									<TableCell className='text-sm'>{item.serialNumbers?.join(', ') ?? '—'}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					{canSeeCost && (
						<dl className='ml-auto flex max-w-sm flex-col gap-1 p-4 text-sm'>
							<div className='flex justify-between border-t pt-1 text-base font-bold'>
								<dt>{t('procurement:return.total')}</dt>
								<dd>{formatIdr(data.totalAmount)}</dd>
							</div>
						</dl>
					)}
				</CardContent>
			</Card>
			{data.notes && <p className='text-sm text-muted-foreground'>{data.notes}</p>}

			<Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (dialog === 'ship') {
								void run(() => shipPurchaseReturn(purchaseReturnId, shipDate), t('procurement:returns.shipped'));
								return;
							}
							void run(
								() =>
									dialog === 'reject'
										? decidePurchaseReturn(purchaseReturnId, 'reject', reason.trim())
										: cancelPurchaseReturn(purchaseReturnId, reason.trim()),
								dialog === 'reject' ? t('procurement:pos.rejected') : t('procurement:returns.cancelled'),
							);
						}}
					>
						<DialogHeader>
							<DialogTitle>
								{dialog === 'ship'
									? t('procurement:returns.ship')
									: dialog === 'reject'
										? t('procurement:pos.reject')
										: t('procurement:returns.cancel')}
							</DialogTitle>
							{dialog === 'ship' && <DialogDescription>{t('procurement:returns.shipHint')}</DialogDescription>}
						</DialogHeader>
						<FieldGroup className='py-4'>
							{dialog === 'ship' ? (
								<Field>
									<FieldLabel htmlFor='rt-ship-date'>{t('procurement:returns.shipDate')}</FieldLabel>
									<DatePicker id='rt-ship-date' required value={shipDate} onChange={setShipDate} />
								</Field>
							) : (
								<Field>
									<FieldLabel htmlFor='rt-dialog-reason'>{t('procurement:po.reason')}</FieldLabel>
									<Textarea
										id='rt-dialog-reason'
										required
										maxLength={1000}
										value={reason}
										onChange={(event) => setReason(event.target.value)}
									/>
								</Field>
							)}
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setDialog(null)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || (dialog !== 'ship' && reason.trim() === '')}>
								{dialog === 'ship' ? t('procurement:returns.ship') : t('common:action.save')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
