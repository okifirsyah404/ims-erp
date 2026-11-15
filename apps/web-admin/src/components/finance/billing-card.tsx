import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { toast } from '@/components/toast';
import { formatIdr, rupiahToMinor } from '@/lib/format';
import {
	billingSummaryQueryOptions,
	createInvoice,
	INVOICE_STATUS_VARIANT,
	type TBillingSummary,
	type TTermInput,
} from '@/lib/invoice-api';
import { usePermission } from '@/lib/use-permission';

/** Billing of one sales order: what is invoiced, paid and left, and its invoices. */
export function BillingCard({ orderId, active }: { orderId: string; active: boolean }) {
	const { t } = useTranslation(['finance', 'common']);
	const canRead = usePermission('invoice.read');
	const canCreate = usePermission('invoice.create');
	const [creating, setCreating] = useState(false);
	const { data } = useQuery(billingSummaryQueryOptions(orderId, canRead));
	if (!canRead || !data) return null;

	return (
		<Card>
			<CardHeader className='flex flex-row items-center justify-between gap-2'>
				<CardTitle>{t('finance:billing.title')}</CardTitle>
				{active && canCreate && data.remainingToInvoice > 0 && (
					<Button size='sm' onClick={() => setCreating(true)}>
						{t('finance:billing.newInvoice')}
					</Button>
				)}
			</CardHeader>
			<CardContent className='flex flex-col gap-4 text-sm'>
				<dl className='grid gap-2 sm:grid-cols-4'>
					{(
						[
							['finance:billing.invoiced', data.invoiced],
							['finance:billing.paid', data.paid],
							['finance:billing.outstanding', data.outstanding],
							['finance:billing.remaining', data.remainingToInvoice],
						] as const
					).map(([key, value]) => (
						<div key={key}>
							<dt className='text-muted-foreground'>{t(key)}</dt>
							<dd className='font-medium'>{formatIdr(value)}</dd>
						</div>
					))}
				</dl>
				{data.invoices.length > 0 && (
					<ul className='flex flex-col gap-2'>
						{data.invoices.map((invoice) => (
							<li key={invoice.id} className='flex flex-wrap items-center justify-between gap-2'>
								<Link to='/sales/invoices/$invoiceId' params={{ invoiceId: invoice.id }} className='hover:underline'>
									{invoice.code ?? t('finance:invoice.draftNumber')} · {invoice.description}
								</Link>
								<span className='flex items-center gap-2'>
									<Badge variant={INVOICE_STATUS_VARIANT[invoice.status]}>{t(`finance:status.${invoice.status}`)}</Badge>
									{formatIdr(invoice.grandTotal)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
			{creating && <CreateInvoiceDialog summary={data} onClose={() => setCreating(false)} />}
		</Card>
	);
}

type TMode = 'next' | 'percentage' | 'amount' | 'remaining';

/** Drafts the invoice of one billing term (free terms; the server computes the amounts). */
function CreateInvoiceDialog({ summary, onClose }: { summary: TBillingSummary; onClose: () => void }) {
	const { t } = useTranslation(['finance', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [mode, setMode] = useState<TMode>(summary.nextTerm ? 'next' : 'remaining');
	const [percent, setPercent] = useState('');
	const [amount, setAmount] = useState('');
	const [description, setDescription] = useState('');
	const [dueDate, setDueDate] = useState('');
	const [busy, setBusy] = useState(false);

	const term = (): TTermInput =>
		mode === 'percentage'
			? { mode, bps: Math.round(Number(percent) * 100) }
			: mode === 'amount'
				? { mode, total: rupiahToMinor(amount) }
				: { mode };

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						setBusy(true);
						try {
							const invoice = await createInvoice({
								salesOrderId: summary.salesOrderId,
								term: term(),
								description: description.trim() || null,
								dueDate: dueDate || null,
								notes: null,
							});
							await queryClient.invalidateQueries({ queryKey: ['finance'] });
							toast.success(t('finance:billing.created'));
							void navigate({ to: '/sales/invoices/$invoiceId', params: { invoiceId: invoice.id } });
						} catch (cause) {
							toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
						} finally {
							setBusy(false);
						}
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('finance:billing.newInvoice')}</DialogTitle>
					</DialogHeader>
					<p className='pt-2 text-sm text-muted-foreground'>
						{t('finance:billing.remainingHint', { amount: formatIdr(summary.remainingToInvoice) })}
					</p>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='invoice-term'>{t('finance:billing.term')}</FieldLabel>
							<Select
								value={mode}
								onValueChange={(value: string | null) => setMode(value as TMode)}
							>
								<SelectTrigger id='invoice-term' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{summary.nextTerm && (
										<SelectItem value='next'>{t('finance:billing.mode.next', { term: summary.nextTerm.description })}</SelectItem>
									)}
									<SelectItem value='percentage'>{t('finance:billing.mode.percentage')}</SelectItem>
									<SelectItem value='amount'>{t('finance:billing.mode.amount')}</SelectItem>
									<SelectItem value='remaining'>{t('finance:billing.mode.remaining')}</SelectItem>
								</SelectContent>
							</Select>
						</Field>
						{mode === 'percentage' && (
							<Field>
								<FieldLabel htmlFor='invoice-percent'>{t('finance:billing.percent')}</FieldLabel>
								<Input
									id='invoice-percent'
									type='number'
									required
									min='0.01'
									max='100'
									step='0.01'
									inputMode='decimal'
									value={percent}
									onChange={(e) => setPercent(e.target.value)}
								/>
							</Field>
						)}
						{mode === 'amount' && (
							<Field>
								<FieldLabel htmlFor='invoice-amount'>{t('finance:billing.amount')}</FieldLabel>
								<Input
									id='invoice-amount'
									type='number'
									required
									min='0.01'
									step='0.01'
									inputMode='decimal'
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
								/>
								<FieldDescription>{t('finance:billing.amountHint')}</FieldDescription>
							</Field>
						)}
						<Field>
							<FieldLabel htmlFor='invoice-description'>{t('finance:invoice.description')}</FieldLabel>
							<Input
								id='invoice-description'
								maxLength={200}
								value={description}
								placeholder={mode === 'next' ? summary.nextTerm?.description : undefined}
								onChange={(e) => setDescription(e.target.value)}
							/>
							<FieldDescription>{t('finance:billing.descriptionHint')}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='invoice-due'>{t('finance:invoice.dueDate')}</FieldLabel>
							<DatePicker id='invoice-due' value={dueDate} onChange={setDueDate} />
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={busy}>
							{t('finance:billing.createDraft')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
