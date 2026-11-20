import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { CreateOrderDialog } from '@/components/sales/create-order-dialog';
import { toast } from '@/components/toast';
import { authClient } from '@/lib/auth-client';
import { formatBusinessDate, formatDateTime, formatIdr } from '@/lib/format';
import {
	decideQuotation,
	markQuotationLost,
	QUOTATION_LOST_REASONS,
	QUOTATION_OPEN_STATUSES,
	QUOTATION_STATUS_VARIANT,
	quotationQueryOptions,
	reviseQuotation,
	sendQuotation,
	submitQuotation,
	type TQuotation,
	type TQuotationItem,
	type TQuotationLostReason,
} from '@/lib/quotation-api';
import { createSalesOrder } from '@/lib/sales-order-api';
import { usePermission } from '@/lib/use-permission';

/** `/sales/quotes/$quotationId` — one SPH: lines, workflow, revisions, history. */
export const Route = createFileRoute('/_authed/sales/quotes/$quotationId/')({
	component: QuotationDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

/** The quotation's lines; its own component so the column hooks run before the page's early returns. */
function QuotationItemsTable({ items, language }: { items: TQuotationItem[]; language: string }) {
	const { t } = useTranslation(['sales', 'common']);
	const columns = useMemo<ColumnDef<DataTableFeatures, TQuotationItem, CellData>[]>(
		() => [
			{
				id: 'name',
				header: t('sales:line.name'),
				cell: ({ row }) => (
					<>
						<div className='font-medium'>{row.original.name}</div>
						{row.original.specification && (
							<div className='whitespace-pre-line text-xs text-muted-foreground'>{row.original.specification}</div>
						)}
					</>
				),
			},
			{
				id: 'quantity',
				header: t('sales:line.quantity'),
				meta: { align: 'right' },
				cell: ({ row }) => `${Number(row.original.quantity).toLocaleString(language)} ${row.original.unit}`,
			},
			{
				id: 'unitPrice',
				header: t('sales:line.unitPrice'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.unitPrice),
			},
			{
				id: 'discount',
				header: t('sales:line.discount'),
				meta: { align: 'right' },
				cell: ({ row }) => (row.original.discountAmount ? formatIdr(row.original.discountAmount) : '—'),
			},
			{
				id: 'lineTotal',
				header: t('sales:line.total'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.lineTotal),
			},
		],
		[t, language],
	);

	return <DataTable columns={columns} data={items} getRowId={(row) => row.id} />;
}

function QuotationDetailPage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const { quotationId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const canUpdate = usePermission('quotation.update');
	const canSubmit = usePermission('quotation.submit');
	const canApprove = usePermission('quotation.approve');
	const canSend = usePermission('quotation.send');
	const canOrder = usePermission('sales_order.create');
	const [ordering, setOrdering] = useState(false);
	const [busy, setBusy] = useState(false);
	const [rejecting, setRejecting] = useState(false);
	const [rejectReason, setRejectReason] = useState('');
	const [losing, setLosing] = useState(false);
	const [lostReason, setLostReason] = useState<TQuotationLostReason>('price');
	const [lostNote, setLostNote] = useState('');
	const { data, isPending, isError, error } = useQuery(quotationQueryOptions(quotationId));

	async function run(action: () => Promise<TQuotation>, message: string, open?: (row: TQuotation) => boolean) {
		setBusy(true);
		try {
			const row = await action();
			await queryClient.invalidateQueries({ queryKey: ['sales', 'quotations'] });
			toast.success(message);
			if (open?.(row)) void navigate({ to: '/sales/quotes/$quotationId', params: { quotationId: row.id } });
			return true;
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
			return false;
		} finally {
			setBusy(false);
		}
	}

	if (isPending) return null;
	if (isError) {
		return (
			<div className='flex flex-col gap-6'>
				<p className='text-sm text-destructive'>{error.message}</p>
				<Link to='/sales/quotes' className='text-sm hover:underline'>
					{t('sales:detail.back')}
				</Link>
			</div>
		);
	}

	const own = data.createdBy === session?.user.id;
	const open = QUOTATION_OPEN_STATUSES.includes(data.status);
	const revisable = ['submitted', 'approved', 'rejected', 'sent', 'lost'].includes(data.status);
	const customer = data.customerSnapshot;

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/sales/quotes' className='text-sm text-muted-foreground hover:underline'>
				{t('sales:detail.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.code}</h1>
					<p className='text-sm text-muted-foreground'>{data.title}</p>
					<div className='mt-2 flex flex-wrap gap-1'>
						<Badge variant={QUOTATION_STATUS_VARIANT[data.status]}>{t(`sales:status.${data.status}`)}</Badge>
						{data.expired && <Badge variant='outline'>{t('sales:quotation.expired')}</Badge>}
					</div>
				</div>
				<div className='flex flex-wrap gap-2'>
					<Button
						variant='outline'
						render={<Link to='/sales/quotes/$quotationId/print' params={{ quotationId }} />}
						nativeButton={false}
					>
						{t('sales:detail.print')}
					</Button>
					{data.status === 'draft' && canUpdate && (
						<Button
							variant='outline'
							render={<Link to='/sales/quotes/$quotationId/edit' params={{ quotationId }} />}
							nativeButton={false}
						>
							{t('common:action.edit')}
						</Button>
					)}
					{data.status === 'draft' && canSubmit && (
						<Button
							disabled={busy}
							onClick={() => void run(() => submitQuotation(quotationId), t('sales:detail.submitted'))}
						>
							{t('sales:detail.submit')}
						</Button>
					)}
					{data.status === 'submitted' && canApprove && !own && (
						<>
							<Button
								disabled={busy}
								onClick={() =>
									void run(() => decideQuotation(quotationId, 'approve'), t('sales:detail.approved'))
								}
							>
								{t('sales:detail.approve')}
							</Button>
							<Button variant='outline' disabled={busy} onClick={() => setRejecting(true)}>
								{t('sales:detail.reject')}
							</Button>
						</>
					)}
					{data.status === 'approved' && canSend && (
						<Button
							disabled={busy}
							onClick={() => void run(() => sendQuotation(quotationId), t('sales:detail.sent'))}
						>
							{t('sales:detail.markSent')}
						</Button>
					)}
					{(data.status === 'approved' || data.status === 'sent') && canOrder && (
						<Button disabled={busy} onClick={() => setOrdering(true)}>
							{t('sales:orders.new')}
						</Button>
					)}
					{data.salesOrder && (
						<Button
							variant='outline'
							render={<Link to='/sales/orders/$orderId' params={{ orderId: data.salesOrder.id }} />}
							nativeButton={false}
						>
							{t('sales:orders.open', { code: data.salesOrder.code })}
						</Button>
					)}
					{revisable && canUpdate && (
						<Button
							variant='outline'
							disabled={busy}
							onClick={() =>
								void run(() => reviseQuotation(quotationId), t('sales:detail.revised'), () => true)
							}
						>
							{t('sales:detail.revise')}
						</Button>
					)}
					{open && canUpdate && (
						<Button variant='outline' disabled={busy} onClick={() => setLosing(true)}>
							{t('sales:detail.markLost')}
						</Button>
					)}
				</div>
			</div>

			{data.status === 'submitted' && canApprove && own && (
				<p className='text-sm text-muted-foreground'>{t('sales:detail.ownNoApprove')}</p>
			)}
			{data.status === 'rejected' && data.rejectedReason && (
				<p className='text-sm text-destructive'>
					{t('sales:quotation.rejectedReason')}: {data.rejectedReason}
				</p>
			)}
			{data.status === 'lost' && data.lostReason && (
				<p className='text-sm text-muted-foreground'>
					{t('sales:quotation.lostReason')}: {t(`sales:lostReason.${data.lostReason}`)}
					{data.lostNote ? ` — ${data.lostNote}` : ''}
				</p>
			)}

			<div className='grid gap-6 lg:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle>{t('sales:form.customer')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('sales:quotation.customer')} value={`${customer.code} — ${customer.name}`} />
						<Detail label={t('sales:quotation.attention')} value={data.attention} />
						<Detail label={t('sales:detail.phone')} value={customer.phone ?? customer.whatsapp} />
						<Detail label={t('sales:detail.email')} value={customer.email} />
						<Detail label={t('sales:detail.address')} value={customer.addressLine} />
						<Detail label={t('sales:detail.taxId')} value={customer.taxId} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t('sales:form.document')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('sales:quotation.date')} value={formatBusinessDate(data.quotationDate, i18n.language)} />
						<Detail label={t('sales:quotation.validUntil')} value={formatBusinessDate(data.validUntil, i18n.language)} />
						<Detail label={t('sales:quotation.paymentTerms')} value={data.paymentTerms} />
						<Detail label={t('sales:quotation.guarantee')} value={data.guarantee} />
						<Detail label={t('sales:detail.createdBy')} value={data.creator?.name ?? null} />
						<Detail label={t('sales:detail.approvedBy')} value={data.approver?.name ?? null} />
					</CardContent>
				</Card>
			</div>

			<Card className='gap-0 py-0'>
				<CardContent className='p-0'>
					<QuotationItemsTable items={data.items} language={i18n.language === 'en' ? 'en-GB' : 'id-ID'} />
					<dl className='ml-auto flex max-w-sm flex-col gap-1 p-4 text-sm'>
						<div className='flex justify-between'>
							<dt>{t('sales:quotation.subtotal')}</dt>
							<dd>{formatIdr(data.subtotal)}</dd>
						</div>
						<div className='flex justify-between'>
							<dt>{t('sales:quotation.discount')}</dt>
							<dd>− {formatIdr(data.discountTotal)}</dd>
						</div>
						<div className='flex justify-between'>
							<dt>
								{data.vatEnabled
									? t('sales:detail.vatAt', { percent: data.vatRateBps / 100 })
									: t('sales:detail.noVat')}
							</dt>
							<dd>{formatIdr(data.taxTotal)}</dd>
						</div>
						<div className='flex justify-between border-t pt-1 text-base font-bold'>
							<dt>{t('sales:quotation.grandTotal')}</dt>
							<dd>{formatIdr(data.grandTotal)}</dd>
						</div>
					</dl>
				</CardContent>
			</Card>

			{data.paymentSchedule && (
				<Card>
					<CardHeader>
						<CardTitle>{t('sales:quotation.schedule')}</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className='flex flex-col gap-1 text-sm'>
							{data.paymentSchedule.map((term) => (
								<li key={term.label} className='flex justify-between'>
									<span>{term.label}</span>
									<span>{term.percentBps / 100}%</span>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			)}

			<div className='grid gap-6 lg:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle>{t('sales:detail.revisions')}</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className='flex flex-col gap-2 text-sm'>
							{data.revisions.map((revision) => (
								<li key={revision.id} className='flex items-center justify-between gap-2'>
									{revision.id === data.id ? (
										<span className='font-medium'>{revision.code}</span>
									) : (
										<Link
											to='/sales/quotes/$quotationId'
											params={{ quotationId: revision.id }}
											className='hover:underline'
										>
											{revision.code}
										</Link>
									)}
									<span className='flex items-center gap-2'>
										<Badge variant={QUOTATION_STATUS_VARIANT[revision.status]}>
											{t(`sales:status.${revision.status}`)}
										</Badge>
										{formatIdr(revision.grandTotal)}
									</span>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t('sales:detail.history')}</CardTitle>
					</CardHeader>
					<CardContent>
						<ol className='flex flex-col gap-2 text-sm'>
							{data.history.map((entry) => (
								<li key={entry.id}>
									<div>
										{t(`sales:status.${entry.toStatus}`)}
										{entry.by ? ` · ${entry.by.name}` : ''}
									</div>
									<div className='text-xs text-muted-foreground'>
										{formatDateTime(entry.changedAt, i18n.language)}
										{entry.note ? ` — ${entry.note}` : ''}
									</div>
								</li>
							))}
						</ol>
					</CardContent>
				</Card>
			</div>

			{(data.terms || data.notes) && (
				<Card>
					<CardHeader>
						<CardTitle>{t('sales:quotation.termsAndNotes')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm'>
						<Detail label={t('sales:quotation.terms')} value={data.terms} />
						<Detail label={t('sales:quotation.notes')} value={data.notes} />
					</CardContent>
				</Card>
			)}

			{ordering && (
				<CreateOrderDialog
					quotationId={quotationId}
					submitting={busy}
					onClose={() => setOrdering(false)}
					onSave={(input) =>
						void run(
							async () => {
								const order = await createSalesOrder(input);
								setOrdering(false);
								void navigate({ to: '/sales/orders/$orderId', params: { orderId: order.id } });
								return data;
							},
							t('sales:orders.created'),
						)
					}
				/>
			)}

			<Dialog open={rejecting} onOpenChange={setRejecting}>
				<DialogContent>
					<form
						onSubmit={async (event) => {
							event.preventDefault();
							const done = await run(
								() => decideQuotation(quotationId, 'reject', rejectReason.trim()),
								t('sales:detail.rejected'),
							);
							if (done) setRejecting(false);
						}}
					>
						<DialogHeader>
							<DialogTitle>{t('sales:detail.reject')}</DialogTitle>
						</DialogHeader>
						<FieldGroup className='py-4'>
							<Field>
								<FieldLabel htmlFor='reject-reason'>{t('sales:quotation.rejectedReason')}</FieldLabel>
								<Textarea
									id='reject-reason'
									required
									maxLength={1000}
									value={rejectReason}
									onChange={(e) => setRejectReason(e.target.value)}
								/>
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setRejecting(false)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || rejectReason.trim() === ''}>
								{t('sales:detail.reject')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog open={losing} onOpenChange={setLosing}>
				<DialogContent>
					<form
						onSubmit={async (event) => {
							event.preventDefault();
							const done = await run(
								() => markQuotationLost(quotationId, lostReason, lostNote.trim() || undefined),
								t('sales:detail.lost'),
							);
							if (done) setLosing(false);
						}}
					>
						<DialogHeader>
							<DialogTitle>{t('sales:detail.markLost')}</DialogTitle>
						</DialogHeader>
						<FieldGroup className='py-4'>
							<Field>
								<FieldLabel htmlFor='lost-reason'>{t('sales:quotation.lostReason')}</FieldLabel>
								<Select value={lostReason} onValueChange={(value: string | null) => setLostReason(value as TQuotationLostReason)}>
									<SelectTrigger id='lost-reason' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{QUOTATION_LOST_REASONS.map((reason) => (
											<SelectItem key={reason} value={reason}>
												{t(`sales:lostReason.${reason}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor='lost-note'>{t('sales:quotation.lostNote')}</FieldLabel>
								<Textarea
									id='lost-note'
									required={lostReason === 'other'}
									maxLength={1000}
									value={lostNote}
									onChange={(e) => setLostNote(e.target.value)}
								/>
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setLosing(false)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy}>
								{t('sales:detail.markLost')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
