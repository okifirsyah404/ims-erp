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
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { toast } from '@/components/toast';
import {
	cancelDeliveryNote,
	DELIVERY_NOTE_STATUS_VARIANT,
	deliverDeliveryNote,
	deliveryNoteQueryOptions,
	shipDeliveryNote,
	type TDeliveryNoteItem,
} from '@/lib/delivery-note-api';
import { formatBusinessDate, formatDateTime, formatIdr } from '@/lib/format';
import { usePermission } from '@/lib/use-permission';

/** `/sales/deliveries/$deliveryNoteId` — one surat jalan and its actions. */
export const Route = createFileRoute('/_authed/sales/deliveries/$deliveryNoteId/')({
	component: DeliveryNoteDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

type TAction = 'ship' | 'deliver' | 'cancel' | null;

/** The delivery note's lines; its own component so the column hooks run before the page's early returns. */
function DeliveryItemsTable({
	items,
	canSeeCost,
	language,
}: {
	items: TDeliveryNoteItem[];
	canSeeCost: boolean;
	language: string;
}) {
	const { t } = useTranslation(['sales', 'common']);
	const columns = useMemo<ColumnDef<DataTableFeatures, TDeliveryNoteItem, CellData>[]>(() => {
		const costColumn: ColumnDef<DataTableFeatures, TDeliveryNoteItem, CellData>[] = canSeeCost
			? [
					{
						id: 'unitCost',
						header: t('sales:delivery.unitCost'),
						meta: { align: 'right' },
						cell: ({ row }) => (row.original.unitCost === null ? '—' : formatIdr(row.original.unitCost)),
					},
				]
			: [];
		return [
			{
				id: 'item',
				header: t('sales:sj.item'),
				cell: ({ row }) => (
					<>
						<div className='font-medium'>{row.original.name}</div>
						{row.original.sku && <div className='text-xs text-muted-foreground'>{row.original.sku}</div>}
					</>
				),
			},
			{
				id: 'quantity',
				header: t('sales:delivery.quantity'),
				meta: { align: 'right' },
				cell: ({ row }) => `${Number(row.original.quantity).toLocaleString(language)} ${row.original.unit}`,
			},
			{
				id: 'unitPrice',
				header: t('sales:delivery.unitPrice'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.unitPrice),
			},
			...costColumn,
			{
				id: 'remarks',
				header: t('sales:delivery.remarks'),
				meta: { cellClassName: 'text-sm' },
				cell: ({ row }) => (
					<>
						{row.original.remarks && <div>{row.original.remarks}</div>}
						{row.original.serialNumbers?.length ? (
							<div className='text-muted-foreground'>
								{t('sales:sj.serials')}: {row.original.serialNumbers.join(', ')}
							</div>
						) : null}
					</>
				),
			},
		];
	}, [t, canSeeCost, language]);

	return <DataTable columns={columns} data={items} getRowId={(row) => row.id} />;
}

function DeliveryNoteDetailPage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const { deliveryNoteId } = Route.useParams();
	const queryClient = useQueryClient();
	const canIssue = usePermission('stock.issue');
	const canSeeCost = usePermission('product.read_cost');
	const canReturn = usePermission('sales_return.create');
	const [action, setAction] = useState<TAction>(null);
	const [input, setInput] = useState('');
	const [busy, setBusy] = useState(false);
	const { data, isPending, isError, error } = useQuery(deliveryNoteQueryOptions(deliveryNoteId));
	const language = i18n.language === 'en' ? 'en-GB' : 'id-ID';

	if (isPending) return <PageSkeleton />;
	if (isError) {
		return (
			<div className='flex flex-col gap-6'>
				<ErrorState error={error} bordered />
				<Link to='/sales/deliveries' className='text-sm hover:underline'>
					{t('sales:deliveries.back')}
				</Link>
			</div>
		);
	}

	const open = (next: TAction) => {
		setInput(next === 'deliver' ? (data.recipientPic ?? '') : '');
		setAction(next);
	};
	const run = async () => {
		setBusy(true);
		try {
			if (action === 'ship') await shipDeliveryNote(deliveryNoteId);
			if (action === 'deliver') await deliverDeliveryNote(deliveryNoteId, input.trim());
			if (action === 'cancel') await cancelDeliveryNote(deliveryNoteId, input.trim());
			await queryClient.invalidateQueries({ queryKey: ['sales'] });
			toast.success(
				t(action === 'ship' ? 'sales:deliveries.shipped' : action === 'deliver' ? 'sales:deliveries.delivered' : 'sales:deliveries.cancelled'),
			);
			setAction(null);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};
	const title =
		action === 'ship' ? t('sales:deliveries.ship') : action === 'deliver' ? t('sales:deliveries.deliver') : t('sales:deliveries.cancel');

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/sales/deliveries' className='text-sm text-muted-foreground hover:underline'>
				{t('sales:deliveries.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.code}</h1>
					<p className='text-sm text-muted-foreground'>{data.projectName ?? data.recipientName}</p>
					<div className='mt-2'>
						<Badge variant={DELIVERY_NOTE_STATUS_VARIANT[data.status]}>{t(`sales:deliveryStatus.${data.status}`)}</Badge>
					</div>
				</div>
				<div className='flex flex-wrap gap-2'>
					{data.status !== 'cancelled' && (
						<Button
							variant='outline'
							render={<Link to='/sales/deliveries/$deliveryNoteId/print' params={{ deliveryNoteId }} />}
							nativeButton={false}
						>
							{t('sales:deliveries.print')}
						</Button>
					)}
					{canIssue && data.status === 'prepared' && (
						<>
							<Button variant='outline' onClick={() => open('cancel')}>
								{t('sales:deliveries.cancel')}
							</Button>
							<Button onClick={() => open('ship')}>{t('sales:deliveries.ship')}</Button>
						</>
					)}
					{canIssue && data.status === 'shipped' && <Button onClick={() => open('deliver')}>{t('sales:deliveries.deliver')}</Button>}
					{canReturn && (data.status === 'shipped' || data.status === 'delivered') && (
						<Button
							variant='outline'
							render={<Link to='/sales/returns/new' search={{ deliveryNoteId }} />}
							nativeButton={false}
						>
							{t('sales:returns.returnGoods')}
						</Button>
					)}
				</div>
			</div>
			{data.status === 'cancelled' && data.cancellationReason && (
				<p className='text-sm text-muted-foreground'>
					{t('sales:delivery.cancelReason')}: {data.cancellationReason}
				</p>
			)}

			<div className='grid gap-6 lg:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle>{t('sales:deliveries.source')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<div>
							<div className='text-muted-foreground'>{t('sales:delivery.order')}</div>
							<Link to='/sales/orders/$orderId' params={{ orderId: data.orderId }} className='hover:underline'>
								{data.orderCode}
							</Link>
						</div>
						<Detail label={t('sales:delivery.customer')} value={data.customerName} />
						<Detail label={t('sales:delivery.date')} value={formatBusinessDate(data.deliveryDate, i18n.language)} />
						<Detail label={t('sales:delivery.warehouse')} value={data.warehouse ? `${data.warehouse.code} — ${data.warehouse.name}` : null} />
						<Detail label={t('sales:delivery.bin')} value={data.bin?.code} />
						<Detail label={t('sales:delivery.driverName')} value={[data.driverName, data.vehicleNumber].filter(Boolean).join(' · ')} />
						<Detail label={t('sales:delivery.shippedAt')} value={data.shippedAt ? formatDateTime(data.shippedAt, i18n.language) : null} />
						<Detail
							label={t('sales:delivery.receiverName')}
							value={data.receiverName ? `${data.receiverName} · ${formatDateTime(data.receivedAt!, i18n.language)}` : null}
						/>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t('sales:deliveries.recipient')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('sales:delivery.projectName')} value={data.projectName} />
						<Detail label={t('sales:delivery.projectLocation')} value={data.projectLocation} />
						<Detail label={t('sales:delivery.recipientName')} value={data.recipientName} />
						<Detail label={t('sales:delivery.recipientPic')} value={data.recipientPic} />
						<Detail label={t('sales:delivery.recipientContact')} value={data.recipientContact} />
						<Detail label={t('sales:delivery.recipientAddress')} value={data.recipientAddress} />
					</CardContent>
				</Card>
			</div>

			<Card className='gap-0 py-0'>
				<CardContent className='p-0'>
					<DeliveryItemsTable items={data.items} canSeeCost={canSeeCost} language={language} />
				</CardContent>
			</Card>
			{data.notes && <p className='whitespace-pre-line text-sm text-muted-foreground'>{data.notes}</p>}

			<Dialog open={action !== null} onOpenChange={(next) => !next && setAction(null)}>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void run();
						}}
					>
						<DialogHeader>
							<DialogTitle>{title}</DialogTitle>
						</DialogHeader>
						{action === 'ship' && <p className='pt-2 text-sm text-muted-foreground'>{t('sales:deliveries.shipHint')}</p>}
						{action === 'cancel' && <p className='pt-2 text-sm text-muted-foreground'>{t('sales:deliveries.cancelHint')}</p>}
						{action !== 'ship' && (
							<FieldGroup className='py-4'>
								<Field>
									<FieldLabel htmlFor='dn-action-input'>
										{action === 'deliver' ? t('sales:delivery.receiverName') : t('sales:delivery.cancelReason')}
									</FieldLabel>
									{action === 'deliver' ? (
										<Input id='dn-action-input' required maxLength={200} value={input} onChange={(e) => setInput(e.target.value)} />
									) : (
										<Textarea id='dn-action-input' required maxLength={1000} value={input} onChange={(e) => setInput(e.target.value)} />
									)}
								</Field>
							</FieldGroup>
						)}
						<DialogFooter className={action === 'ship' ? 'pt-4' : undefined}>
							<Button type='button' variant='outline' onClick={() => setAction(null)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || (action !== 'ship' && input.trim() === '')}>
								{title}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
