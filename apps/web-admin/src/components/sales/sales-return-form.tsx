import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
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
import type { TSalesReturnDetail, TSalesReturnInput, TReturnableDelivery } from '@/lib/sales-return-api';

type TLineDraft = { quantity: string; serials: string[] };

/**
 * The delivery notes a return can be made from. When editing, the return's own
 * lines are added back: the server counts them as taken while the draft
 * exists, so without this the draft could not keep its own quantities.
 */
function withOwnLines(receipts: TReturnableDelivery[], initial?: TSalesReturnDetail): TReturnableDelivery[] {
	if (!initial) return receipts;
	const base = receipts.find((receipt) => receipt.id === initial.deliveryNoteId);
	const merged: TReturnableDelivery = base
		? { ...base, items: base.items.map((item) => ({ ...item, serialNumbers: [...item.serialNumbers] })) }
		: {
				id: initial.deliveryNoteId,
				code: initial.deliveryNoteCode,
				deliveryDate: '',
				salesOrderId: initial.salesOrderId,
				salesOrderCode: initial.salesOrderCode,
				customerName: initial.customerName,
				warehouseId: initial.warehouseId,
				items: [],
			};
	for (const line of initial.items) {
		const found = merged.items.find((item) => item.id === line.deliveryNoteItemId);
		if (found) {
			found.returnableQuantity = (Number(found.returnableQuantity) + Number(line.quantity)).toFixed(3);
			found.serialNumbers = [...found.serialNumbers, ...(line.serialNumbers ?? [])].sort();
		} else {
			merged.items.push({
				id: line.deliveryNoteItemId,
				itemId: line.itemId,
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
	return [merged, ...receipts.filter((receipt) => receipt.id !== initial.deliveryNoteId)];
}

/** Create or edit a draft purchase return (ERP-0062). */
export function SalesReturnForm({
	receipts,
	initial,
	initialDeliveryId,
	onSubmit,
}: {
	receipts: TReturnableDelivery[];
	initial?: TSalesReturnDetail;
	initialDeliveryId?: string;
	onSubmit: (input: TSalesReturnInput) => Promise<void>;
}) {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const navigate = useNavigate();
	const options = useMemo(() => withOwnLines(receipts, initial), [receipts, initial]);
	const [deliveryId, setDeliveryId] = useState(initial?.deliveryNoteId ?? initialDeliveryId ?? '');
	const [returnDate, setReturnDate] = useState(initial?.returnDate ?? todayBusinessDate());
	const [reason, setReason] = useState(initial?.reason ?? '');
	const [notes, setNotes] = useState(initial?.notes ?? '');
	const [lines, setLines] = useState<Record<string, TLineDraft>>(() =>
		Object.fromEntries(
			(initial?.items ?? []).map((item) => [item.deliveryNoteItemId, { quantity: String(Number(item.quantity)), serials: item.serialNumbers ?? [] }]),
		),
	);
	const [submitting, setSubmitting] = useState(false);
	const language = i18n.language === 'en' ? 'en-GB' : 'id-ID';

	const receipt = options.find((row) => row.id === deliveryId);
	const draft = (id: string): TLineDraft => lines[id] ?? { quantity: '', serials: [] };
	const setLine = (id: string, patch: Partial<TLineDraft>) => setLines((current) => ({ ...current, [id]: { ...draft(id), ...patch } }));
	const quantityOf = (item: TReturnableDelivery['items'][number]) =>
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
						deliveryNoteId: receipt.id,
						returnDate,
						reason: reason.trim(),
						notes: notes.trim() || null,
						lines: chosen.map((item) => ({
							deliveryNoteItemId: item.id,
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
					<CardTitle>{t('sales:returns.source')}</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='srt-receipt'>{t('sales:delivery.code')}</FieldLabel>
							<Select
								required
								disabled={!!initial}
								value={deliveryId || 'none'}
								onValueChange={(value: string | null) => {
									setDeliveryId(value === 'none' || value == null ? '' : value);
									setLines({});
								}}
							>
								<SelectTrigger id='srt-receipt' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>{t('sales:returns.pickDelivery')}</SelectItem>
									{options.map((row) => (
										<SelectItem key={row.id} value={row.id}>
											{row.code} — {row.salesOrderCode ?? '—'} — {row.customerName}
											{row.deliveryDate ? ` — ${formatBusinessDate(row.deliveryDate, i18n.language)}` : ''}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{options.length === 0 && <FieldDescription>{t('sales:returns.noDeliveries')}</FieldDescription>}
						</Field>
						<Field>
							<FieldLabel htmlFor='rt-date'>{t('sales:return.date')}</FieldLabel>
							<DatePicker id='srt-date' required value={returnDate} onChange={setReturnDate} />
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='rt-reason'>{t('sales:return.reason')}</FieldLabel>
							<Textarea id='srt-reason' required rows={2} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
							<FieldDescription>{t('sales:returns.reasonHint')}</FieldDescription>
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>

			{receipt && (
				<Card>
					<CardHeader>
						<CardTitle>{t('sales:returns.lines')}</CardTitle>
					</CardHeader>
					<CardContent className='flex flex-col gap-4'>
						{receipt.items.map((item) => (
							<div key={item.id} className='grid gap-3 rounded-md border p-3 sm:grid-cols-3'>
								<div className='text-sm sm:col-span-3'>
									<span className='font-medium'>{item.name}</span>
									<span className='text-muted-foreground'>
										{' '}
										· {item.sku} ·{' '}
										{t('sales:returns.returnable', {
											quantity: Number(item.returnableQuantity).toLocaleString(language),
											unit: item.unit,
										})}
									</span>
								</div>
								{item.isSerialized ? (
									<Field className='sm:col-span-3'>
										<FieldLabel>{t('sales:return.serialNumbers')}</FieldLabel>
										<div className='flex flex-wrap gap-4'>
											{item.serialNumbers.map((serial) => (
												<label key={serial} className='flex items-center gap-2 text-sm'>
													<Checkbox
														aria-label={serial}
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
													{serial}
												</label>
											))}
										</div>
										<FieldDescription>{t('sales:returns.serialHint')}</FieldDescription>
									</Field>
								) : (
									<Field>
										<FieldLabel htmlFor={`rt-qty-${item.id}`}>{t('sales:return.quantity')}</FieldLabel>
										<Input
											id={`srt-qty-${item.id}`}
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
							<FieldLabel htmlFor='rt-notes'>{t('sales:return.notes')}</FieldLabel>
							<Textarea id='srt-notes' rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
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
							? navigate({ to: '/sales/returns/$salesReturnId', params: { salesReturnId: initial.id } })
							: navigate({ to: '/sales/returns' }))
					}
				>
					{t('common:action.cancel')}
				</Button>
				<Button type='submit' disabled={submitting || !receipt || chosen.length === 0 || reason.trim() === ''}>
					{t('sales:returns.saveDraft')}
				</Button>
			</div>
		</form>
	);
}
