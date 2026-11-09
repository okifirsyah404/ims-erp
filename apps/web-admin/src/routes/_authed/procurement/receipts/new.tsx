import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { toast } from '@/components/toast';
import { todayBusinessDate } from '@/lib/format';
import { createGoodsReceipt, receivableOrdersQueryOptions, receivingWarehousesQueryOptions } from '@/lib/goods-receipt-api';

/** A receipt may start from a purchase order page. */
const searchSchema = z.object({ purchaseOrderId: z.string().optional() });

/** `/procurement/receipts/new` — receive goods against a sent purchase order. */
export const Route = createFileRoute('/_authed/procurement/receipts/new')({
	validateSearch: searchSchema,
	component: NewGoodsReceiptPage,
});

type TLineDraft = { quantity: string; serials: string };

const select = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm';

function NewGoodsReceiptPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const search = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const orders = useQuery(receivableOrdersQueryOptions());
	const warehouses = useQuery(receivingWarehousesQueryOptions());
	const [purchaseOrderId, setPurchaseOrderId] = useState(search.purchaseOrderId ?? '');
	const [warehouseId, setWarehouseId] = useState('');
	const [binId, setBinId] = useState('');
	const [receiptDate, setReceiptDate] = useState(todayBusinessDate());
	const [supplierDeliveryRef, setSupplierDeliveryRef] = useState('');
	const [notes, setNotes] = useState('');
	const [lines, setLines] = useState<Record<string, TLineDraft>>({});
	const [submitting, setSubmitting] = useState(false);
	const warehouse = warehouses.data?.find((row) => row.id === warehouseId);

	const order = orders.data?.find((row) => row.id === purchaseOrderId);
	const draft = (id: string): TLineDraft => lines[id] ?? { quantity: '', serials: '' };
	const setLine = (id: string, patch: Partial<TLineDraft>) => setLines((current) => ({ ...current, [id]: { ...draft(id), ...patch } }));

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('procurement:receipts.new')}</h1>
				<p className='text-sm text-muted-foreground'>{t('procurement:receipts.newHint')}</p>
			</div>
			<form
				className='flex flex-col gap-6'
				onSubmit={async (event) => {
					event.preventDefault();
					if (!order) return;
					const chosen = order.items
						.map((item) => ({ item, line: draft(item.id) }))
						.filter(({ line }) => Number(line.quantity) > 0);
					setSubmitting(true);
					try {
						const created = await createGoodsReceipt({
							purchaseOrderId,
							warehouseId,
							binId: binId || null,
							receiptDate,
							supplierDeliveryRef: supplierDeliveryRef.trim() || null,
							notes: notes.trim() || null,
							lines: chosen.map(({ item, line }) => ({
								purchaseOrderItemId: item.id,
								quantity: line.quantity,
								serialNumbers: item.isSerialized
									? line.serials.split(/[\n,]/).map((value) => value.trim()).filter(Boolean)
									: null,
							})),
						});
						await queryClient.invalidateQueries({ queryKey: ['procurement'] });
						toast.success(t('procurement:receipts.saved'));
						void navigate({ to: '/procurement/receipts/$receiptId', params: { receiptId: created.id } });
					} catch (cause) {
						toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
					} finally {
						setSubmitting(false);
					}
				}}
			>
				<Card>
					<CardHeader>
						<CardTitle>{t('procurement:receipts.source')}</CardTitle>
					</CardHeader>
					<CardContent>
						<FieldGroup className='grid gap-4 sm:grid-cols-2'>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor='gr-po'>{t('procurement:po.code')}</FieldLabel>
								<select
									id='gr-po'
									required
									className={select}
									value={purchaseOrderId}
									onChange={(event) => {
										setPurchaseOrderId(event.target.value);
										setLines({});
									}}
								>
									<option value=''>{t('procurement:receipts.pickOrder')}</option>
									{(orders.data ?? []).map((row) => (
										<option key={row.id} value={row.id}>
											{row.code} — {row.supplierName} — {row.subject}
										</option>
									))}
								</select>
								{orders.data?.length === 0 && <FieldDescription>{t('procurement:receipts.noOrders')}</FieldDescription>}
							</Field>
							<Field>
								<FieldLabel htmlFor='gr-warehouse'>{t('procurement:receipt.warehouse')}</FieldLabel>
								<select
									id='gr-warehouse'
									required
									className={select}
									value={warehouseId}
									onChange={(event) => {
										setWarehouseId(event.target.value);
										setBinId('');
									}}
								>
									<option value=''>{t('procurement:receipts.pickWarehouse')}</option>
									{(warehouses.data ?? []).map((row) => (
										<option key={row.id} value={row.id}>
											{row.code} — {row.name}
										</option>
									))}
								</select>
							</Field>
							<Field>
								<FieldLabel htmlFor='gr-bin'>{t('procurement:receipt.bin')}</FieldLabel>
								<select id='gr-bin' className={select} value={binId} onChange={(event) => setBinId(event.target.value)} disabled={!warehouse}>
									<option value=''>{t('procurement:receipts.noBin')}</option>
									{(warehouse?.storages ?? []).map((storage) => (
										<option key={storage.id} value={storage.id}>
											{storage.code}
											{storage.name ? ` — ${storage.name}` : ''}
										</option>
									))}
								</select>
							</Field>
							<Field>
								<FieldLabel htmlFor='gr-date'>{t('procurement:receipt.date')}</FieldLabel>
								<Input id='gr-date' type='date' required value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='gr-ref'>{t('procurement:receipt.supplierDeliveryRef')}</FieldLabel>
								<Input id='gr-ref' maxLength={100} value={supplierDeliveryRef} onChange={(event) => setSupplierDeliveryRef(event.target.value)} />
							</Field>
						</FieldGroup>
					</CardContent>
				</Card>

				{order && (
					<Card>
						<CardHeader>
							<CardTitle>{t('procurement:receipts.lines')}</CardTitle>
						</CardHeader>
						<CardContent className='flex flex-col gap-4'>
							{order.items.map((item) => (
								<div key={item.id} className='grid gap-3 rounded-md border p-3 sm:grid-cols-3'>
									<div className='text-sm sm:col-span-3'>
										<span className='font-medium'>{item.name}</span>
										<span className='text-muted-foreground'>
											{' '}
											· {item.sku} · {t('procurement:receipts.open', { quantity: Number(item.openQuantity), unit: item.unit })}
										</span>
									</div>
									<Field>
										<FieldLabel htmlFor={`gr-qty-${item.id}`}>{t('procurement:receipt.quantity')}</FieldLabel>
										<Input
											id={`gr-qty-${item.id}`}
											type='number'
											min='0'
											max={item.openQuantity}
											step={item.isSerialized ? '1' : '0.001'}
											inputMode='decimal'
											value={draft(item.id).quantity}
											disabled={Number(item.openQuantity) === 0}
											onChange={(event) => setLine(item.id, { quantity: event.target.value })}
										/>
									</Field>
									{item.isSerialized && (
										<Field className='sm:col-span-2'>
											<FieldLabel htmlFor={`gr-serials-${item.id}`}>{t('procurement:receipt.serialNumbers')}</FieldLabel>
											<Textarea
												id={`gr-serials-${item.id}`}
												rows={2}
												value={draft(item.id).serials}
												onChange={(event) => setLine(item.id, { serials: event.target.value })}
											/>
											<FieldDescription>{t('procurement:receipt.serialHint')}</FieldDescription>
										</Field>
									)}
								</div>
							))}
							<Field>
								<FieldLabel htmlFor='gr-notes'>{t('procurement:receipt.notes')}</FieldLabel>
								<Textarea id='gr-notes' rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
							</Field>
						</CardContent>
					</Card>
				)}

				<div className='flex justify-end gap-2'>
					<Button type='button' variant='outline' onClick={() => void navigate({ to: '/procurement/receipts' })}>
						{t('common:action.cancel')}
					</Button>
					<Button
						type='submit'
						disabled={submitting || !order || !warehouseId || !order.items.some((item) => Number(draft(item.id).quantity) > 0)}
					>
						{t('procurement:receipts.post')}
					</Button>
				</div>
			</form>
		</div>
	);
}
