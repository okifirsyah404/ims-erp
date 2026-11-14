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
import { Input } from '@ims-erp/ui/components/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { GatewayPaymentsCard } from '@/components/finance/gateway-payments-card';
import { toast } from '@/components/toast';
import { formatBusinessDate, formatIdr, minorToRupiah, rupiahToMinor, todayBusinessDate } from '@/lib/format';
import {
	addReceipt,
	INVOICE_STATUS_VARIANT,
	invoiceQueryOptions,
	isOverdue,
	issueInvoice,
	RECEIPT_METHODS,
	reverseReceipt,
	type TReceiptMethod,
	voidInvoice,
} from '@/lib/invoice-api';
import { usePermission } from '@/lib/use-permission';

/** `/sales/invoices/$invoiceId` — one invoice: issue, void, receipts, print. */
export const Route = createFileRoute('/_authed/sales/invoices/$invoiceId/')({
	component: InvoiceDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

type TDialog = 'issue' | 'void' | 'receipt' | { reverse: string } | null;

function InvoiceDetailPage() {
	const { t, i18n } = useTranslation(['finance', 'sales', 'common']);
	const { invoiceId } = Route.useParams();
	const queryClient = useQueryClient();
	const canIssue = usePermission('invoice.issue');
	const canVoid = usePermission('invoice.void');
	const canReceive = usePermission('receipt.create');
	const canReverse = usePermission('receipt.reverse');
	const [dialog, setDialog] = useState<TDialog>(null);
	const [busy, setBusy] = useState(false);
	const [issueDate, setIssueDate] = useState(todayBusinessDate());
	const [dueDate, setDueDate] = useState('');
	const [reason, setReason] = useState('');
	const [amount, setAmount] = useState('');
	const [receivedDate, setReceivedDate] = useState(todayBusinessDate());
	const [method, setMethod] = useState<TReceiptMethod>('bank_transfer');
	const [reference, setReference] = useState('');
	const { data, isPending, isError, error } = useQuery(invoiceQueryOptions(invoiceId));

	async function run(action: () => Promise<unknown>, message: string) {
		setBusy(true);
		try {
			await action();
			await queryClient.invalidateQueries({ queryKey: ['finance'] });
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
	if (isError) {
		return (
			<div className='flex flex-col gap-6'>
				<p className='text-sm text-destructive'>{error.message}</p>
				<Link to='/sales/invoices' className='text-sm hover:underline'>
					{t('finance:invoices.back')}
				</Link>
			</div>
		);
	}

	const payable = data.status === 'issued' || data.status === 'partially_paid';
	const voidable = (data.status === 'draft' || data.status === 'issued') && data.paidTotal === 0;
	const open = (next: TDialog) => {
		if (next === 'receipt') setAmount(minorToRupiah(data.outstandingTotal));
		if (next === 'issue') setDueDate(data.dueDate ?? '');
		setDialog(next);
	};

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/sales/invoices' className='text-sm text-muted-foreground hover:underline'>
				{t('finance:invoices.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.code ?? t('finance:invoice.draftNumber')}</h1>
					<p className='text-sm text-muted-foreground'>
						{data.description} · {data.title}
					</p>
					<div className='mt-2 flex flex-wrap gap-1'>
						<Badge variant={INVOICE_STATUS_VARIANT[data.status]}>{t(`finance:status.${data.status}`)}</Badge>
						<Badge variant='outline'>{t(`finance:termKind.${data.termKind}`)}</Badge>
						{isOverdue(data, todayBusinessDate()) && <Badge variant='destructive'>{t('finance:invoice.overdue')}</Badge>}
					</div>
				</div>
				<div className='flex flex-wrap gap-2'>
					{data.status !== 'draft' && data.status !== 'void' && (
						<Button
							variant='outline'
							render={<Link to='/sales/invoices/$invoiceId/print' params={{ invoiceId }} />}
							nativeButton={false}
						>
							{t('finance:invoice.print')}
						</Button>
					)}
					{data.status === 'draft' && canIssue && (
						<Button disabled={busy} onClick={() => open('issue')}>
							{t('finance:invoice.issue')}
						</Button>
					)}
					{payable && canReceive && (
						<Button disabled={busy} onClick={() => open('receipt')}>
							{t('finance:receipt.add')}
						</Button>
					)}
					{voidable && canVoid && (
						<Button variant='outline' disabled={busy} onClick={() => open('void')}>
							{t('finance:invoice.void')}
						</Button>
					)}
				</div>
			</div>
			{data.status === 'void' && data.voidReason && (
				<p className='text-sm text-muted-foreground'>
					{t('finance:invoice.voidReason')}: {data.voidReason}
				</p>
			)}

			<div className='grid gap-6 lg:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle>{t('finance:invoice.billTo')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('finance:invoice.customer')} value={data.customerSnapshot.name} />
						<Detail label={t('sales:quotation.attention')} value={data.order?.attention} />
						<div>
							<div className='text-muted-foreground'>{t('finance:invoice.salesOrder')}</div>
							<Link to='/sales/orders/$orderId' params={{ orderId: data.salesOrderId }} className='hover:underline'>
								{data.salesOrderCode}
							</Link>
						</div>
						<Detail label={t('finance:invoice.reference')} value={data.quotationCode} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t('finance:invoice.amounts')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('finance:invoice.issueDate')} value={formatBusinessDate(data.issueDate, i18n.language)} />
						<Detail label={t('finance:invoice.dueDate')} value={formatBusinessDate(data.dueDate, i18n.language)} />
						<Detail label={t('finance:invoice.taxBase')} value={formatIdr(data.subtotal)} />
						<Detail
							label={data.vatEnabled ? t('sales:detail.vatAt', { percent: data.vatRateBps / 100 }) : t('sales:detail.noVat')}
							value={formatIdr(data.taxTotal)}
						/>
						<Detail label={t('finance:invoice.grandTotal')} value={formatIdr(data.grandTotal)} />
						<Detail label={t('finance:invoice.outstanding')} value={formatIdr(data.outstandingTotal)} />
					</CardContent>
				</Card>
			</div>

			<GatewayPaymentsCard invoiceId={invoiceId} payable={payable} />

			<Card>
				<CardHeader>
					<CardTitle>{t('finance:receipt.title')}</CardTitle>
				</CardHeader>
				<CardContent className='p-0'>
					{data.receipts.length === 0 ? (
						<p className='p-4 text-sm text-muted-foreground'>{t('finance:receipt.empty')}</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('finance:receipt.code')}</TableHead>
									<TableHead>{t('finance:receipt.date')}</TableHead>
									<TableHead>{t('finance:receipt.method')}</TableHead>
									<TableHead>{t('finance:receipt.reference')}</TableHead>
									<TableHead className='text-right'>{t('finance:receipt.amount')}</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.receipts.map((receipt) => (
									<TableRow key={receipt.id} className={receipt.status === 'reversed' ? 'text-muted-foreground line-through' : ''}>
										<TableCell>{receipt.code}</TableCell>
										<TableCell>{formatBusinessDate(receipt.receivedDate, i18n.language)}</TableCell>
										<TableCell>{t(`finance:method.${receipt.method}`)}</TableCell>
										<TableCell>{receipt.reference ?? '—'}</TableCell>
										<TableCell className='text-right'>{formatIdr(receipt.amount)}</TableCell>
										<TableCell className='text-right'>
											{receipt.status === 'posted' && canReverse && (
												<Button variant='ghost' size='sm' onClick={() => open({ reverse: receipt.id })}>
													{t('finance:receipt.reverse')}
												</Button>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Dialog open={dialog !== null} onOpenChange={(value) => !value && setDialog(null)}>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (dialog === 'issue') {
								void run(() => issueInvoice(invoiceId, { issueDate, dueDate: dueDate || null }), t('finance:invoice.issued'));
							} else if (dialog === 'void') {
								void run(() => voidInvoice(invoiceId, reason.trim()), t('finance:invoice.voided'));
							} else if (dialog === 'receipt') {
								void run(
									() =>
										addReceipt(invoiceId, {
											amount: rupiahToMinor(amount),
											receivedDate,
											method,
											reference: reference.trim() || null,
											notes: null,
										}),
									t('finance:receipt.added'),
								);
							} else if (dialog) {
								void run(() => reverseReceipt(dialog.reverse, reason.trim()), t('finance:receipt.reversed'));
							}
						}}
					>
						<DialogHeader>
							<DialogTitle>
								{dialog === 'issue'
									? t('finance:invoice.issue')
									: dialog === 'void'
										? t('finance:invoice.void')
										: dialog === 'receipt'
											? t('finance:receipt.add')
											: t('finance:receipt.reverse')}
							</DialogTitle>
						</DialogHeader>
						<FieldGroup className='py-4'>
							{dialog === 'issue' && (
								<div className='grid gap-4 sm:grid-cols-2'>
									<Field>
										<FieldLabel htmlFor='issue-date'>{t('finance:invoice.issueDate')}</FieldLabel>
										<Input
											id='issue-date'
											type='date'
											required
											value={issueDate}
											onChange={(e) => setIssueDate(e.target.value)}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor='issue-due'>{t('finance:invoice.dueDate')}</FieldLabel>
										<Input
											id='issue-due'
											type='date'
											min={issueDate}
											value={dueDate}
											onChange={(e) => setDueDate(e.target.value)}
										/>
									</Field>
								</div>
							)}
							{dialog === 'receipt' && (
								<>
									<div className='grid gap-4 sm:grid-cols-2'>
										<Field>
											<FieldLabel htmlFor='receipt-amount'>{t('finance:receipt.amountRp')}</FieldLabel>
											<Input
												id='receipt-amount'
												type='number'
												required
												min='0.01'
												max={data.outstandingTotal / 100}
												step='0.01'
												inputMode='decimal'
												value={amount}
												onChange={(e) => setAmount(e.target.value)}
											/>
										</Field>
										<Field>
											<FieldLabel htmlFor='receipt-date'>{t('finance:receipt.date')}</FieldLabel>
											<Input
												id='receipt-date'
												type='date'
												required
												value={receivedDate}
												onChange={(e) => setReceivedDate(e.target.value)}
											/>
										</Field>
									</div>
									<div className='grid gap-4 sm:grid-cols-2'>
										<Field>
											<FieldLabel htmlFor='receipt-method'>{t('finance:receipt.method')}</FieldLabel>
											<select
												id='receipt-method'
												className='h-9 w-full rounded-md border bg-transparent px-3 text-sm'
												value={method}
												onChange={(e) => setMethod(e.target.value as TReceiptMethod)}
											>
												{RECEIPT_METHODS.map((value) => (
													<option key={value} value={value}>
														{t(`finance:method.${value}`)}
													</option>
												))}
											</select>
										</Field>
										<Field>
											<FieldLabel htmlFor='receipt-reference'>{t('finance:receipt.reference')}</FieldLabel>
											<Input
												id='receipt-reference'
												maxLength={100}
												value={reference}
												onChange={(e) => setReference(e.target.value)}
											/>
										</Field>
									</div>
								</>
							)}
							{(dialog === 'void' || (typeof dialog === 'object' && dialog !== null)) && (
								<Field>
									<FieldLabel htmlFor='finance-reason'>{t('finance:reason')}</FieldLabel>
									<Textarea
										id='finance-reason'
										required
										maxLength={1000}
										value={reason}
										onChange={(e) => setReason(e.target.value)}
									/>
								</Field>
							)}
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setDialog(null)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy}>
								{t('common:action.save')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
