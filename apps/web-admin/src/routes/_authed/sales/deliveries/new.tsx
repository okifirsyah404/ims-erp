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
import {
	createDeliveryNote,
	deliverableOrdersQueryOptions,
	inStockSerialsQueryOptions,
	shippingWarehousesQueryOptions,
	type TDeliverableOrder,
} from '@/lib/delivery-note-api';
import { todayBusinessDate } from '@/lib/format';

/** A delivery note may start from a sales order page. */
const searchSchema = z.object({ salesOrderId: z.string().optional() });

/** `/sales/deliveries/new` — prepare a surat jalan against a sales order. */
export const Route = createFileRoute('/_authed/sales/deliveries/new')({
	validateSearch: searchSchema,
	component: NewDeliveryNotePage,
});

type TLineDraft = { quantity: string; serials: string[]; remarks: string };
type TRecipient = { projectName: string; projectLocation: string; recipientName: string; recipientAddress: string; recipientPic: string; recipientContact: string };

const select = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm';

const recipientOf = (order: TDeliverableOrder | undefined): TRecipient => ({
	projectName: order?.title ?? '',
	projectLocation: '',
	recipientName: order?.customerName ?? '',
	recipientAddress: order?.customerAddress ?? '',
	recipientPic: order?.attention ?? '',
	recipientContact: order?.customerContact ?? '',
});

/** In-stock serials of one line's item in the chosen warehouse, as checkboxes. */
function SerialPicker({
	lineId,
	itemId,
	warehouseId,
	value,
	onChange,
}: {
	lineId: string;
	itemId: string;
	warehouseId: string;
	value: string[];
	onChange: (serials: string[]) => void;
}) {
	const { t } = useTranslation('sales');
	const serials = useQuery(inStockSerialsQueryOptions(itemId, warehouseId));
	if (!warehouseId) return <FieldDescription>{t('deliveries.noSerials')}</FieldDescription>;
	return (
		<div className='flex flex-col gap-2'>
			<FieldDescription>{t('deliveries.pickSerials', { count: serials.data?.length ?? 0 })}</FieldDescription>
			<div className='flex flex-wrap gap-x-4 gap-y-1'>
				{(serials.data ?? []).map((serial) => (
					<label key={serial} className='flex items-center gap-1.5 text-sm'>
						<input
							type='checkbox'
							name={`dn-serial-${lineId}`}
							value={serial}
							checked={value.includes(serial)}
							onChange={(event) =>
								onChange(event.target.checked ? [...value, serial] : value.filter((entry) => entry !== serial))
							}
						/>
						{serial}
					</label>
				))}
			</div>
		</div>
	);
}

function NewDeliveryNotePage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const search = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const orders = useQuery(deliverableOrdersQueryOptions());
	const warehouses = useQuery(shippingWarehousesQueryOptions());
	const [salesOrderId, setSalesOrderId] = useState(search.salesOrderId ?? '');
	const [warehouseId, setWarehouseId] = useState('');
	const [binId, setBinId] = useState('');
	const [deliveryDate, setDeliveryDate] = useState(todayBusinessDate());
	const [recipient, setRecipient] = useState<TRecipient>(recipientOf(undefined));
	const [driverName, setDriverName] = useState('');
	const [vehicleNumber, setVehicleNumber] = useState('');
	// The note is printed in Indonesian whatever the UI language.
	const [notes, setNotes] = useState<string>(() => i18n.getFixedT('id', 'sales')('delivery.defaultNotes'));
	const [lines, setLines] = useState<Record<string, TLineDraft>>({});
	const [submitting, setSubmitting] = useState(false);

	const order = orders.data?.find((row) => row.id === salesOrderId);
	const warehouse = warehouses.data?.find((row) => row.id === warehouseId);
	const draft = (id: string): TLineDraft => lines[id] ?? { quantity: '', serials: [], remarks: '' };
	const setLine = (id: string, patch: Partial<TLineDraft>) => setLines((current) => ({ ...current, [id]: { ...draft(id), ...patch } }));
	const setField = (key: keyof TRecipient, value: string) => setRecipient((current) => ({ ...current, [key]: value }));

	// Prefill the recipient from the order (also when it comes from the URL
	// and the orders load later): adjust state while rendering, not in an effect.
	const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
	if (order && prefilledFor !== order.id) {
		setPrefilledFor(order.id);
		setRecipient(recipientOf(order));
	}

	const text = (value: string) => value.trim() || null;
	const recipientFields: [keyof TRecipient, string][] = [
		['projectName', t('sales:delivery.projectName')],
		['projectLocation', t('sales:delivery.projectLocation')],
		['recipientName', t('sales:delivery.recipientName')],
		['recipientPic', t('sales:delivery.recipientPic')],
		['recipientContact', t('sales:delivery.recipientContact')],
	];

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('sales:deliveries.new')}</h1>
				<p className='text-sm text-muted-foreground'>{t('sales:deliveries.newHint')}</p>
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
						const created = await createDeliveryNote({
							salesOrderId,
							warehouseId,
							binId: binId || null,
							deliveryDate,
							projectName: text(recipient.projectName),
							projectLocation: text(recipient.projectLocation),
							recipientName: text(recipient.recipientName),
							recipientAddress: text(recipient.recipientAddress),
							recipientPic: text(recipient.recipientPic),
							recipientContact: text(recipient.recipientContact),
							driverName: text(driverName),
							vehicleNumber: text(vehicleNumber),
							notes: text(notes),
							lines: chosen.map(({ item, line }) => ({
								salesOrderItemId: item.id,
								quantity: line.quantity,
								serialNumbers: item.isSerialized ? line.serials : null,
								remarks: text(line.remarks),
							})),
						});
						await queryClient.invalidateQueries({ queryKey: ['sales'] });
						toast.success(t('sales:deliveries.saved'));
						void navigate({ to: '/sales/deliveries/$deliveryNoteId', params: { deliveryNoteId: created.id } });
					} catch (cause) {
						toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
					} finally {
						setSubmitting(false);
					}
				}}
			>
				<Card>
					<CardHeader>
						<CardTitle>{t('sales:deliveries.source')}</CardTitle>
					</CardHeader>
					<CardContent>
						<FieldGroup className='grid gap-4 sm:grid-cols-2'>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor='dn-order'>{t('sales:delivery.order')}</FieldLabel>
								<select
									id='dn-order'
									required
									className={select}
									value={salesOrderId}
									onChange={(event) => {
										setSalesOrderId(event.target.value);
										setLines({});
									}}
								>
									<option value=''>{t('sales:deliveries.pickOrder')}</option>
									{(orders.data ?? []).map((row) => (
										<option key={row.id} value={row.id}>
											{row.code} — {row.customerName} — {row.title}
										</option>
									))}
								</select>
								{orders.data?.length === 0 && <FieldDescription>{t('sales:deliveries.noOrders')}</FieldDescription>}
							</Field>
							<Field>
								<FieldLabel htmlFor='dn-warehouse'>{t('sales:delivery.warehouse')}</FieldLabel>
								<select
									id='dn-warehouse'
									required
									className={select}
									value={warehouseId}
									onChange={(event) => {
										setWarehouseId(event.target.value);
										setBinId('');
										setLines((current) =>
											Object.fromEntries(Object.entries(current).map(([id, line]) => [id, { ...line, serials: [] }])),
										);
									}}
								>
									<option value=''>{t('sales:deliveries.pickWarehouse')}</option>
									{(warehouses.data ?? []).map((row) => (
										<option key={row.id} value={row.id}>
											{row.code} — {row.name}
										</option>
									))}
								</select>
							</Field>
							<Field>
								<FieldLabel htmlFor='dn-bin'>{t('sales:delivery.bin')}</FieldLabel>
								<select id='dn-bin' className={select} value={binId} onChange={(event) => setBinId(event.target.value)} disabled={!warehouse}>
									<option value=''>{t('sales:deliveries.noBin')}</option>
									{(warehouse?.storages ?? []).map((storage) => (
										<option key={storage.id} value={storage.id}>
											{storage.code}
											{storage.name ? ` — ${storage.name}` : ''}
										</option>
									))}
								</select>
							</Field>
							<Field>
								<FieldLabel htmlFor='dn-date'>{t('sales:delivery.date')}</FieldLabel>
								<Input id='dn-date' type='date' required value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
							</Field>
						</FieldGroup>
					</CardContent>
				</Card>

				{order && (
					<>
						<Card>
							<CardHeader>
								<CardTitle>{t('sales:deliveries.recipient')}</CardTitle>
							</CardHeader>
							<CardContent>
								<FieldGroup className='grid gap-4 sm:grid-cols-2'>
									{recipientFields.map(([key, label]) => (
										<Field key={key}>
											<FieldLabel htmlFor={`dn-${key}`}>{label}</FieldLabel>
											<Input
												id={`dn-${key}`}
												maxLength={key === 'recipientPic' || key === 'recipientContact' ? 200 : 300}
												required={key === 'recipientName'}
												value={recipient[key]}
												onChange={(event) => setField(key, event.target.value)}
											/>
										</Field>
									))}
									<Field className='sm:col-span-2'>
										<FieldLabel htmlFor='dn-recipientAddress'>{t('sales:delivery.recipientAddress')}</FieldLabel>
										<Textarea
											id='dn-recipientAddress'
											rows={2}
											maxLength={1000}
											value={recipient.recipientAddress}
											onChange={(event) => setField('recipientAddress', event.target.value)}
										/>
									</Field>
								</FieldGroup>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>{t('sales:deliveries.lines')}</CardTitle>
							</CardHeader>
							<CardContent className='flex flex-col gap-4'>
								{order.items.map((item) => (
									<div key={item.id} className='grid gap-3 rounded-md border p-3 sm:grid-cols-3'>
										<div className='text-sm sm:col-span-3'>
											<span className='font-medium'>{item.name}</span>
											<span className='text-muted-foreground'>
												{item.sku ? ` · ${item.sku}` : ''} ·{' '}
												{t('sales:deliveries.open', { quantity: Number(item.openQuantity), unit: item.unit })}
											</span>
											{!item.isStockTracked && <div className='text-xs text-muted-foreground'>{t('sales:deliveries.notStock')}</div>}
										</div>
										<Field>
											<FieldLabel htmlFor={`dn-qty-${item.id}`}>{t('sales:delivery.quantity')}</FieldLabel>
											<Input
												id={`dn-qty-${item.id}`}
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
										<Field className='sm:col-span-2'>
											<FieldLabel htmlFor={`dn-remarks-${item.id}`}>{t('sales:delivery.remarks')}</FieldLabel>
											<Input
												id={`dn-remarks-${item.id}`}
												maxLength={500}
												value={draft(item.id).remarks}
												onChange={(event) => setLine(item.id, { remarks: event.target.value })}
											/>
										</Field>
										{item.isSerialized && item.itemId && Number(draft(item.id).quantity) > 0 && (
											<Field className='sm:col-span-3'>
												<FieldLabel>{t('sales:delivery.serialNumbers')}</FieldLabel>
												<SerialPicker
													lineId={item.id}
													itemId={item.itemId}
													warehouseId={warehouseId}
													value={draft(item.id).serials}
													onChange={(serials) => setLine(item.id, { serials })}
												/>
											</Field>
										)}
									</div>
								))}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>{t('sales:deliveries.transport')}</CardTitle>
							</CardHeader>
							<CardContent>
								<FieldGroup className='grid gap-4 sm:grid-cols-2'>
									<Field>
										<FieldLabel htmlFor='dn-driver'>{t('sales:delivery.driverName')}</FieldLabel>
										<Input id='dn-driver' maxLength={200} value={driverName} onChange={(event) => setDriverName(event.target.value)} />
									</Field>
									<Field>
										<FieldLabel htmlFor='dn-vehicle'>{t('sales:delivery.vehicleNumber')}</FieldLabel>
										<Input id='dn-vehicle' maxLength={32} value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} />
									</Field>
									<Field className='sm:col-span-2'>
										<FieldLabel htmlFor='dn-notes'>{t('sales:delivery.notes')}</FieldLabel>
										<Textarea id='dn-notes' rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
									</Field>
								</FieldGroup>
							</CardContent>
						</Card>
					</>
				)}

				<div className='flex justify-end gap-2'>
					<Button type='button' variant='outline' onClick={() => void navigate({ to: '/sales/deliveries' })}>
						{t('common:action.cancel')}
					</Button>
					<Button
						type='submit'
						disabled={submitting || !order || !warehouseId || !order.items.some((item) => Number(draft(item.id).quantity) > 0)}
					>
						{t('sales:deliveries.save')}
					</Button>
				</div>
			</form>
		</div>
	);
}
