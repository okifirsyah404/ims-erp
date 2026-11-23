import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { FieldLabel } from '@/components/form/field-label';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { formatBusinessDate, todayBusinessDate } from '@/lib/format';
import type { TPurchaseReturnDetail, TPurchaseReturnInput, TReturnableReceipt } from '@/lib/purchase-return-api';

type TLineDraft = { quantity: string; serials: string[] };

/**
 * The receipts a return can be made from. When editing, the return's own
 * lines are added back: the server counts them as taken while the draft
 * exists, so without this the draft could not keep its own quantities.
 */
function withOwnLines(receipts: TReturnableReceipt[], initial?: TPurchaseReturnDetail): TReturnableReceipt[] {
	if (!initial) return receipts;
	const base = receipts.find((receipt) => receipt.id === initial.goodsReceiptId);
	const merged: TReturnableReceipt = base
		? { ...base, items: base.items.map((item) => ({ ...item, serialNumbers: [...item.serialNumbers] })) }
		: {
				id: initial.goodsReceiptId,
				code: initial.goodsReceiptCode,
				receiptDate: '',
				purchaseOrderId: initial.purchaseOrderId,
				purchaseOrderCode: initial.purchaseOrderCode,
				supplierName: initial.supplierName,
				items: [],
			};
	for (const line of initial.items) {
		const found = merged.items.find((item) => item.id === line.goodsReceiptItemId);
		if (found) {
			found.returnableQuantity = (Number(found.returnableQuantity) + Number(line.quantity)).toFixed(3);
			found.serialNumbers = [...found.serialNumbers, ...(line.serialNumbers ?? [])].sort();
		} else {
			merged.items.push({
				id: line.goodsReceiptItemId,
				productId: line.productId,
				sku: line.sku,
				name: line.name,
				unit: line.unit,
				quantity: line.quantity,
				returnableQuantity: line.quantity,
				serialNumbers: line.serialNumbers ?? [],
				isSerialized: line.serialNumbers !== null,
			});
		}
	}
	return [merged, ...receipts.filter((receipt) => receipt.id !== initial.goodsReceiptId)];
}

/** Create or edit a draft purchase return (ERP-0068). */
export function PurchaseReturnForm({
	receipts,
	initial,
	initialReceiptId,
	onSubmit,
}: {
	receipts: TReturnableReceipt[];
	initial?: TPurchaseReturnDetail;
	initialReceiptId?: string;
	onSubmit: (input: TPurchaseReturnInput) => Promise<void>;
}) {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const navigate = useNavigate();
	const options = useMemo(() => withOwnLines(receipts, initial), [receipts, initial]);
	const [receiptId, setReceiptId] = useState(initial?.goodsReceiptId ?? initialReceiptId ?? '');
	const [returnDate, setReturnDate] = useState(initial?.returnDate ?? todayBusinessDate());
	const [reason, setReason] = useState(initial?.reason ?? '');
	const [notes, setNotes] = useState(initial?.notes ?? '');
	const [lines, setLines] = useState<Record<string, TLineDraft>>(() =>
		Object.fromEntries(
			(initial?.items ?? []).map((item) => [item.goodsReceiptItemId, { quantity: String(Number(item.quantity)), serials: item.serialNumbers ?? [] }]),
		),
	);
	const [submitting, setSubmitting] = useState(false);
	const language = i18n.language === 'en' ? 'en-GB' : 'id-ID';

	const receipt = options.find((row) => row.id === receiptId);
	const draft = (id: string): TLineDraft => lines[id] ?? { quantity: '', serials: [] };
	const setLine = (id: string, patch: Partial<TLineDraft>) => setLines((current) => ({ ...current, [id]: { ...draft(id), ...patch } }));
	const quantityOf = (item: TReturnableReceipt['items'][number]) =>
		item.isSerialized ? draft(item.id).serials.length : Number(draft(item.id).quantity);
	const chosen = receipt ? receipt.items.filter((item) => quantityOf(item) > 0) : [];

	return (
		<form
			className='flex flex-col gap-6'
			onSubmit={async (event) => {
				event.preventDefault();
				if (!receipt) return;
				setSubmitting(true);
				try {
					await onSubmit({
						goodsReceiptId: receipt.id,
						returnDate,
						reason: reason.trim(),
						notes: notes.trim() || null,
						lines: chosen.map((item) => ({
							goodsReceiptItemId: item.id,
							quantity: String(quantityOf(item)),
							serialNumbers: item.isSerialized ? draft(item.id).serials : null,
						})),
					});
				} finally {
					setSubmitting(false);
				}
			}}
		>
			<Card>
				<CardHeader>
					<CardTitle>{t('procurement:returns.source')}</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='rt-receipt'>{t('procurement:receipt.code')}</FieldLabel>
							<Select
								required
								disabled={!!initial}
								value={receiptId || 'none'}
								onValueChange={(value: string | null) => {
									setReceiptId(value === 'none' || value == null ? '' : value);
									setLines({});
								}}
							>
								<SelectTrigger id='rt-receipt' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>{t('procurement:returns.pickReceipt')}</SelectItem>
									{options.map((row) => (
										<SelectItem key={row.id} value={row.id}>
											{row.code} — {row.purchaseOrderCode ?? '—'} — {row.supplierName}
											{row.receiptDate ? ` — ${formatBusinessDate(row.receiptDate, i18n.language)}` : ''}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{options.length === 0 && <FieldDescription>{t('procurement:returns.noReceipts')}</FieldDescription>}
						</Field>
						<Field>
							<FieldLabel htmlFor='rt-date'>{t('procurement:return.date')}</FieldLabel>
							<DatePicker id='rt-date' required value={returnDate} onChange={setReturnDate} />
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='rt-reason'>{t('procurement:return.reason')}</FieldLabel>
							<Textarea id='rt-reason' required rows={2} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
							<FieldDescription>{t('procurement:returns.reasonHint')}</FieldDescription>
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>

			{receipt && (
				<Card>
					<CardHeader>
						<CardTitle>{t('procurement:returns.lines')}</CardTitle>
					</CardHeader>
					<CardContent className='flex flex-col gap-4'>
						{receipt.items.map((item) => (
							<div key={item.id} className='grid gap-3 rounded-md border p-3 sm:grid-cols-3'>
								<div className='text-sm sm:col-span-3'>
									<span className='font-medium'>{item.name}</span>
									<span className='text-muted-foreground'>
										{' '}
										· {item.sku} ·{' '}
										{t('procurement:returns.returnable', {
											quantity: Number(item.returnableQuantity).toLocaleString(language),
											unit: item.unit,
										})}
									</span>
								</div>
								{item.isSerialized ? (
									<Field className='sm:col-span-3'>
										<FieldLabel>{t('procurement:receipt.serialNumbers')}</FieldLabel>
										<div className='flex flex-wrap gap-4'>
											{item.serialNumbers.map((serial) => (
												<Field key={serial} orientation='horizontal' className='w-auto'>
													<Checkbox
														id={`serial-${item.id}-${serial}`}
														checked={draft(item.id).serials.includes(serial)}
														onCheckedChange={(checked) =>
															setLine(item.id, {
																serials:
																	checked === true
																		? [...draft(item.id).serials, serial]
																		: draft(item.id).serials.filter((value) => value !== serial),
															})
														}
													/>
													<FieldLabel htmlFor={`serial-${item.id}-${serial}`}>{serial}</FieldLabel>
												</Field>
											))}
										</div>
										<FieldDescription>{t('procurement:returns.serialHint')}</FieldDescription>
									</Field>
								) : (
									<Field>
										<FieldLabel htmlFor={`rt-qty-${item.id}`}>{t('procurement:return.quantity')}</FieldLabel>
										<Input
											id={`rt-qty-${item.id}`}
											type='number'
											min='0'
											max={item.returnableQuantity}
											step='0.001'
											inputMode='decimal'
											value={draft(item.id).quantity}
											onChange={(event) => setLine(item.id, { quantity: event.target.value })}
										/>
									</Field>
								)}
							</div>
						))}
						<Field>
							<FieldLabel htmlFor='rt-notes' optional>{t('procurement:return.notes')}</FieldLabel>
							<Textarea id='rt-notes' rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
						</Field>
					</CardContent>
				</Card>
			)}

			<div className='flex justify-end gap-2'>
				<Button
					type='button'
					variant='outline'
					onClick={() =>
						void (initial
							? navigate({ to: '/procurement/purchase-returns/$purchaseReturnId', params: { purchaseReturnId: initial.id } })
							: navigate({ to: '/procurement/purchase-returns' }))
					}
				>
					{t('common:action.cancel')}
				</Button>
				<Button type='submit' disabled={submitting || !receipt || chosen.length === 0 || reason.trim() === ''}>
					{t('procurement:returns.saveDraft')}
				</Button>
			</div>
		</form>
	);
}
