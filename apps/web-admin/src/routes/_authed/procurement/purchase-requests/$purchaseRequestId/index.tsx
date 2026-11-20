import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { toast } from '@/components/toast';
import { authClient } from '@/lib/auth-client';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import {
	approvePurchaseRequest,
	cancelPurchaseRequest,
	PR_STATUS_VARIANT,
	purchaseRequestQueryOptions,
	rejectPurchaseRequest,
	submitPurchaseRequest,
	type TPurchaseRequestLine,
} from '@/lib/procurement-api';
import { usePermission } from '@/lib/use-permission';

/** `/procurement/purchase-requests/$purchaseRequestId` — one request: approval, ordering status. */
export const Route = createFileRoute('/_authed/procurement/purchase-requests/$purchaseRequestId/')({
	component: PurchaseRequestDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

/** The request's lines; its own component so the column hooks run before the page's early returns. */
function RequestLinesTable({ lines, locale }: { lines: TPurchaseRequestLine[]; locale: string }) {
	const { t } = useTranslation(['procurement', 'common']);
	const columns = useMemo<ColumnDef<DataTableFeatures, TPurchaseRequestLine, CellData>[]>(
		() => [
			{
				id: 'item',
				header: t('procurement:po.item'),
				cell: ({ row }) => (
					<>
						<div className='font-medium'>{row.original.name}</div>
						<div className='text-xs text-muted-foreground'>{row.original.sku ?? t('procurement:pr.freeText')}</div>
						{row.original.specification && (
							<div className='text-xs whitespace-pre-line text-muted-foreground'>{row.original.specification}</div>
						)}
						{row.original.notes && <div className='text-xs text-muted-foreground'>{row.original.notes}</div>}
					</>
				),
			},
			{
				id: 'quantity',
				header: t('procurement:po.quantity'),
				meta: { align: 'right' },
				cell: ({ row }) => `${Number(row.original.quantity).toLocaleString(locale)} ${row.original.unit}`,
			},
			{
				id: 'estimatedUnitPrice',
				header: t('procurement:pr.estimatedUnitPrice'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.estimatedUnitPrice),
			},
			{
				id: 'estimatedTotal',
				header: t('procurement:pr.estimatedTotal'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.estimatedTotal),
			},
			{
				id: 'orderedOn',
				header: t('procurement:pr.orderedOn'),
				cell: ({ row }) =>
					row.original.purchaseOrderId ? (
						<Link
							to='/procurement/purchase-orders/$purchaseOrderId'
							params={{ purchaseOrderId: row.original.purchaseOrderId }}
							className='hover:underline'
						>
							{row.original.purchaseOrderCode ?? t('procurement:po.noNumber')}
						</Link>
					) : (
						<span className='text-muted-foreground'>—</span>
					),
			},
		],
		[t, locale],
	);

	return <DataTable columns={columns} data={lines} getRowId={(row) => row.id} />;
}

function PurchaseRequestDetailPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const { purchaseRequestId } = Route.useParams();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const canCreate = usePermission('purchase_request.create');
	const canSubmit = usePermission('purchase_request.submit');
	const canApprove = usePermission('purchase_request.approve');
	const canReject = usePermission('purchase_request.reject');
	const canOrder = usePermission('purchase_order.create');
	const [dialog, setDialog] = useState<'reject' | 'cancel' | null>(null);
	const [reason, setReason] = useState('');
	const [busy, setBusy] = useState(false);
	const { data, isPending, isError, error } = useQuery(purchaseRequestQueryOptions(purchaseRequestId));

	async function run(action: () => Promise<unknown>, message: string) {
		setBusy(true);
		try {
			await action();
			await queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-requests'] });
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

	const own = data.requestedBy === session?.user.id;
	const ordered = data.lines.some((line) => line.purchaseOrderId);
	const openLines = data.lines.filter((line) => !line.purchaseOrderId).length;
	const cancellable = own && canCreate && ['draft', 'submitted', 'approved'].includes(data.status) && !ordered;
	const locale = i18n.language === 'en' ? 'en-GB' : 'id-ID';

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/procurement/purchase-requests' className='text-sm text-muted-foreground hover:underline'>
				{t('procurement:prs.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.code ?? t('procurement:pr.noNumber')}</h1>
					<p className='text-sm text-muted-foreground'>{data.subject}</p>
					<Badge className='mt-2' variant={PR_STATUS_VARIANT[data.status]}>
						{t(`procurement:prStatus.${data.status}`)}
					</Badge>
				</div>
				<div className='flex flex-wrap gap-2'>
					{data.status === 'draft' && own && canCreate && (
						<Button
							variant='outline'
							render={<Link to='/procurement/purchase-requests/$purchaseRequestId/edit' params={{ purchaseRequestId }} />}
							nativeButton={false}
						>
							{t('common:action.edit')}
						</Button>
					)}
					{data.status === 'draft' && own && canSubmit && (
						<Button disabled={busy} onClick={() => void run(() => submitPurchaseRequest(purchaseRequestId), t('procurement:prs.submitted'))}>
							{t('procurement:pos.submit')}
						</Button>
					)}
					{data.status === 'submitted' && !own && canApprove && (
						<Button disabled={busy} onClick={() => void run(() => approvePurchaseRequest(purchaseRequestId), t('procurement:prs.approved'))}>
							{t('procurement:pos.approve')}
						</Button>
					)}
					{data.status === 'submitted' && !own && canReject && (
						<Button variant='outline' disabled={busy} onClick={() => setDialog('reject')}>
							{t('procurement:pos.reject')}
						</Button>
					)}
					{data.status === 'approved' && canOrder && openLines > 0 && (
						<Button
							render={<Link to='/procurement/purchase-orders/new' search={{ fromRequest: purchaseRequestId }} />}
							nativeButton={false}
						>
							{t('procurement:prs.createPo')}
						</Button>
					)}
					{cancellable && (
						<Button variant='outline' disabled={busy} onClick={() => setDialog('cancel')}>
							{t('procurement:prs.cancel')}
						</Button>
					)}
				</div>
			</div>
			{data.status === 'submitted' && own && (canApprove || canReject) && (
				<p className='text-sm text-muted-foreground'>{t('procurement:prs.ownNoApprove')}</p>
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

			<Card>
				<CardHeader>
					<CardTitle>{t('procurement:pr.header')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-3 text-sm sm:grid-cols-3'>
					<Detail label={t('procurement:pr.requestedBy')} value={data.requestedByName} />
					<Detail label={t('procurement:pr.requestDate')} value={formatBusinessDate(data.requestDate, i18n.language)} />
					<Detail label={t('procurement:pr.neededBy')} value={formatBusinessDate(data.neededBy, i18n.language)} />
					<Detail label={t('procurement:po.projectName')} value={data.projectName} />
					<div className='sm:col-span-2'>
						<Detail label={t('procurement:pr.justification')} value={data.justification} />
					</div>
				</CardContent>
			</Card>

			<Card className='gap-0 py-0'>
				<CardContent className='p-0'>
					<RequestLinesTable lines={data.lines} locale={locale} />
					<div className='flex justify-end p-4 text-base font-bold'>
						{t('procurement:pr.estimatedTotal')}: {formatIdr(data.estimatedTotal)}
					</div>
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
										? rejectPurchaseRequest(purchaseRequestId, reason.trim())
										: cancelPurchaseRequest(purchaseRequestId, reason.trim()),
								dialog === 'reject' ? t('procurement:prs.rejected') : t('procurement:prs.cancelled'),
							);
						}}
					>
						<DialogHeader>
							<DialogTitle>{dialog === 'reject' ? t('procurement:pos.reject') : t('procurement:prs.cancel')}</DialogTitle>
						</DialogHeader>
						<FieldGroup className='py-4'>
							<Field>
								<FieldLabel htmlFor='pr-reason'>{t('procurement:po.reason')}</FieldLabel>
								<Textarea id='pr-reason' required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
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
