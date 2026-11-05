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
import { BillingCard } from '@/components/finance/billing-card';
import { toast } from '@/components/toast';
import { formatBusinessDate, formatDateTime, formatIdr } from '@/lib/format';
import { cancelSalesOrder, SALES_ORDER_STATUS_VARIANT, salesOrderQueryOptions } from '@/lib/sales-order-api';
import { usePermission } from '@/lib/use-permission';

/** `/sales/orders/$orderId` — one sales order: lines, amounts, history. */
export const Route = createFileRoute('/_authed/sales/orders/$orderId')({
	component: SalesOrderDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

function SalesOrderDetailPage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const { orderId } = Route.useParams();
	const queryClient = useQueryClient();
	const canCancel = usePermission('sales_order.cancel');
	const [cancelling, setCancelling] = useState(false);
	const [reason, setReason] = useState('');
	const [busy, setBusy] = useState(false);
	const { data, isPending, isError, error } = useQuery(salesOrderQueryOptions(orderId));

	if (isPending) return null;
	if (isError) {
		return (
			<div className='flex flex-col gap-4 p-6'>
				<p className='text-sm text-destructive'>{error.message}</p>
				<Link to='/sales/orders' className='text-sm hover:underline'>
					{t('sales:orders.back')}
				</Link>
			</div>
		);
	}

	const customer = data.customerSnapshot;
	const language = i18n.language === 'en' ? 'en-GB' : 'id-ID';

	return (
		<div className='flex flex-col gap-6 p-6'>
			<Link to='/sales/orders' className='text-sm text-muted-foreground hover:underline'>
				{t('sales:orders.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.code}</h1>
					<p className='text-sm text-muted-foreground'>{data.title}</p>
					<div className='mt-2'>
						<Badge variant={SALES_ORDER_STATUS_VARIANT[data.status]}>{t(`sales:orderStatus.${data.status}`)}</Badge>
					</div>
				</div>
				{data.status === 'confirmed' && canCancel && (
					<Button variant='outline' onClick={() => setCancelling(true)}>
						{t('sales:orders.cancel')}
					</Button>
				)}
			</div>
			{data.status === 'cancelled' && data.cancellationReason && (
				<p className='text-sm text-muted-foreground'>
					{t('sales:order.cancellationReason')}: {data.cancellationReason}
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
						<Detail label={t('sales:order.customerPo')} value={data.customerPoNumber} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t('sales:form.document')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('sales:order.date')} value={formatBusinessDate(data.orderDate, i18n.language)} />
						<Detail label={t('sales:order.deliveryDate')} value={formatBusinessDate(data.deliveryDate, i18n.language)} />
						<div>
							<div className='text-muted-foreground'>{t('sales:order.quotation')}</div>
							<Link
								to='/sales/quotes/$quotationId'
								params={{ quotationId: data.quotationId }}
								className='hover:underline'
							>
								{data.quotationCode}
							</Link>
						</div>
						<Detail label={t('sales:order.salesPerson')} value={data.salesPerson?.name ?? null} />
						<Detail label={t('sales:quotation.paymentTerms')} value={data.paymentTerms} />
						<Detail label={t('sales:quotation.guarantee')} value={data.guarantee} />
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardContent className='p-0'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('sales:line.name')}</TableHead>
								<TableHead className='text-right'>{t('sales:line.quantity')}</TableHead>
								<TableHead className='text-right'>{t('sales:order.delivered')}</TableHead>
								<TableHead className='text-right'>{t('sales:line.unitPrice')}</TableHead>
								<TableHead className='text-right'>{t('sales:line.total')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.items.map((item) => (
								<TableRow key={item.id}>
									<TableCell>
										<div className='font-medium'>{item.name}</div>
										{item.specification && (
											<div className='whitespace-pre-line text-xs text-muted-foreground'>{item.specification}</div>
										)}
									</TableCell>
									<TableCell className='text-right'>
										{Number(item.quantity).toLocaleString(language)} {item.unit}
									</TableCell>
									<TableCell className='text-right'>{Number(item.quantityDelivered).toLocaleString(language)}</TableCell>
									<TableCell className='text-right'>{formatIdr(item.unitPrice)}</TableCell>
									<TableCell className='text-right'>{formatIdr(item.lineTotal)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
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
								{data.vatEnabled ? t('sales:detail.vatAt', { percent: data.vatRateBps / 100 }) : t('sales:detail.noVat')}
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

			<BillingCard orderId={orderId} active={data.status !== 'cancelled'} />

			<div className='grid gap-6 lg:grid-cols-2'>
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
				<Card>
					<CardHeader>
						<CardTitle>{t('sales:detail.history')}</CardTitle>
					</CardHeader>
					<CardContent>
						<ol className='flex flex-col gap-2 text-sm'>
							{data.history.map((entry) => (
								<li key={entry.id}>
									<div>
										{t(`sales:orderStatus.${entry.toStatus}`)}
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

			<Dialog open={cancelling} onOpenChange={setCancelling}>
				<DialogContent>
					<form
						onSubmit={async (event) => {
							event.preventDefault();
							setBusy(true);
							try {
								await cancelSalesOrder(orderId, reason.trim());
								await queryClient.invalidateQueries({ queryKey: ['sales'] });
								toast.success(t('sales:orders.cancelled'));
								setCancelling(false);
							} catch (cause) {
								toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
							} finally {
								setBusy(false);
							}
						}}
					>
						<DialogHeader>
							<DialogTitle>{t('sales:orders.cancel')}</DialogTitle>
						</DialogHeader>
						<p className='pt-2 text-sm text-muted-foreground'>{t('sales:orders.cancelHint')}</p>
						<FieldGroup className='py-4'>
							<Field>
								<FieldLabel htmlFor='order-cancel-reason'>{t('sales:order.cancellationReason')}</FieldLabel>
								<Textarea
									id='order-cancel-reason'
									required
									maxLength={1000}
									value={reason}
									onChange={(e) => setReason(e.target.value)}
								/>
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setCancelling(false)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || reason.trim() === ''}>
								{t('sales:orders.cancel')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
