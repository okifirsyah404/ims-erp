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
import { Textarea } from '@ims-erp/ui/components/textarea';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
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
	type TPurchaseReturnItem,
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

/** The return's lines; its own component so the column hooks run before the page's early returns. */
function PurchaseReturnItemsTable({
	items,
	canSeeCost,
	language,
}: {
	items: TPurchaseReturnItem[];
	canSeeCost: boolean;
	language: string;
}) {
	const { t } = useTranslation(['procurement', 'common']);
	const columns = useMemo<ColumnDef<DataTableFeatures, TPurchaseReturnItem, CellData>[]>(() => {
		const costColumns: ColumnDef<DataTableFeatures, TPurchaseReturnItem, CellData>[] = canSeeCost
			? [
					{
						id: 'unitCost',
						header: t('procurement:receipt.unitCost'),
						meta: { align: 'right' },
						cell: ({ row }) => formatIdr(row.original.unitCost),
					},
					{
						id: 'lineTotal',
						header: t('procurement:po.lineTotal'),
						meta: { align: 'right' },
						cell: ({ row }) => formatIdr(row.original.lineTotal),
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
				header: t('procurement:return.quantity'),
				meta: { align: 'right' },
				cell: ({ row }) => `${Number(row.original.quantity).toLocaleString(language)} ${row.original.unit}`,
			},
			...costColumns,
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

	if (isPending) return <PageSkeleton />;
	if (isError) return <ErrorState error={error} bordered />;

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

			<Card className='gap-0 py-0'>
				<CardContent className='p-0'>
					<PurchaseReturnItemsTable items={data.items} canSeeCost={canSeeCost} language={language} />
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
