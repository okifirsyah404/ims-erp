import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { FieldLabel } from '@/components/form/field-label';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { toast } from '@/components/toast';
import { billableOrdersQueryOptions, createBillFromOrder } from '@/lib/finance-api';
import { formatIdr, todayBusinessDate } from '@/lib/format';

/**
 * Drafts a supplier bill from a purchase order (ERP-0012): pick the order,
 * match the supplier's invoice, and bill what was received and not billed
 * yet. Prices and VAT come from the order; the server refuses more than is
 * billable.
 */
export function BillFromOrderForm({ onDone }: { onDone: () => void }) {
	const { t, i18n } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const orders = useQuery(billableOrdersQueryOptions());
	const [orderId, setOrderId] = useState('');
	const [invoiceNumber, setInvoiceNumber] = useState('');
	const [billDate, setBillDate] = useState(todayBusinessDate());
	const [dueDate, setDueDate] = useState('');
	const [quantities, setQuantities] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);
	const order = orders.data?.find((row) => row.id === orderId);
	const language = i18n.language === 'en' ? 'en-GB' : 'id-ID';
	const chosen = order ? order.lines.filter((line) => Number(quantities[line.id] ?? 0) > 0) : [];

	return (
		<form
			className='flex flex-col gap-4 rounded-md border p-4'
			onSubmit={async (event) => {
				event.preventDefault();
				if (!order) return;
				setBusy(true);
				try {
					await createBillFromOrder({
						purchaseOrderId: order.id,
						supplierInvoiceNumber: invoiceNumber.trim(),
						billDate,
						dueDate: dueDate || null,
						lines: chosen.map((line) => ({ purchaseOrderItemId: line.id, quantity: quantities[line.id]! })),
					});
					toast.success(t('finance:bills.created'));
					await queryClient.invalidateQueries({ queryKey: ['bills'] });
					onDone();
				} catch (cause) {
					toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
				} finally {
					setBusy(false);
				}
			}}
		>
			<FieldGroup className='grid gap-4 sm:grid-cols-2'>
				<Field className='sm:col-span-2'>
					<FieldLabel htmlFor='bill-po'>{t('finance:bills.fromOrder.order')}</FieldLabel>
					<Select
						value={orderId || 'none'}
						onValueChange={(value: string | null) => {
							const next = value === 'none' || value == null ? '' : value;
							setOrderId(next);
							const picked = orders.data?.find((row) => row.id === next);
							setQuantities(Object.fromEntries((picked?.lines ?? []).map((line) => [line.id, String(Number(line.quantityBillable))])));
						}}
					>
						<SelectTrigger id='bill-po' className='w-full'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='none'>{t('finance:bills.fromOrder.pickOrder')}</SelectItem>
							{(orders.data ?? []).map((row) => (
								<SelectItem key={row.id} value={row.id}>
									{row.code} — {row.supplierName} — {row.subject}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{orders.data?.length === 0 && <FieldDescription>{t('finance:bills.fromOrder.noOrders')}</FieldDescription>}
				</Field>
				<Field>
					<FieldLabel htmlFor='bill-invoice'>{t('finance:bills.fromOrder.invoiceNumber')}</FieldLabel>
					<Input id='bill-invoice' required maxLength={100} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
				</Field>
				<Field>
					<FieldLabel htmlFor='bill-date'>{t('finance:bills.billDate')}</FieldLabel>
					<DatePicker id='bill-date' required value={billDate} onChange={setBillDate} />
				</Field>
				<Field>
					<FieldLabel htmlFor='bill-due' optional>{t('finance:bills.dueDate')}</FieldLabel>
					<DatePicker id='bill-due' min={billDate} value={dueDate} onChange={setDueDate} />
				</Field>
			</FieldGroup>

			{order && (
				<div className='flex flex-col gap-3'>
					<p className='text-sm text-muted-foreground'>{t(`finance:bills.fromOrder.vat.${order.vatMode}`)}</p>
					{order.lines.map((line) => (
						<div key={line.id} className='grid items-end gap-3 rounded-md border p-3 sm:grid-cols-3'>
							<div className='text-sm sm:col-span-2'>
								<div className='font-medium'>{line.name}</div>
								<div className='text-muted-foreground'>
									{line.sku} · {formatIdr(line.unitPrice)} / {line.unit} ·{' '}
									{t('finance:bills.fromOrder.billable', {
										billable: Number(line.quantityBillable).toLocaleString(language),
										received: Number(line.quantityReceived).toLocaleString(language),
									})}
									{line.isStock ? ` · ${t('finance:bills.fromOrder.stock')}` : ''}
								</div>
							</div>
							<Field>
								<FieldLabel htmlFor={`bill-qty-${line.id}`}>{t('finance:bills.fromOrder.quantity')}</FieldLabel>
								<Input
									id={`bill-qty-${line.id}`}
									type='number'
									min='0'
									max={line.quantityBillable}
									step='0.001'
									inputMode='decimal'
									value={quantities[line.id] ?? ''}
									disabled={Number(line.quantityBillable) === 0}
									onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))}
								/>
							</Field>
						</div>
					))}
				</div>
			)}

			<div className='flex justify-end gap-2'>
				<Button type='button' variant='outline' onClick={onDone}>
					{t('common:action.cancel')}
				</Button>
				<Button type='submit' disabled={busy || !order || chosen.length === 0 || invoiceNumber.trim() === ''}>
					{t('finance:bills.fromOrder.create')}
				</Button>
			</div>
		</form>
	);
}
