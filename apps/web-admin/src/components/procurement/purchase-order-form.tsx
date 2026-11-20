import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { Search } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { formatIdr, minorToRupiah, rupiahToMinor, todayBusinessDate } from '@/lib/format';
import { listProducts, type TProduct } from '@/lib/inventory-api';
import {
	openRequestLinesQueryOptions,
	PO_VAT_MODES,
	previewPoTotals,
	PURCHASE_CATEGORIES,
	type TOpenRequestLine,
	type TPoVatMode,
	type TPurchaseCategory,
	type TPurchaseOrderDetail,
	type TPurchaseOrderInput,
} from '@/lib/procurement-api';
import { supplierCompaniesQueryOptions, supplierPeopleQueryOptions } from '@/lib/supplier-api';

type TLineDraft = {
	key: string;
	/** inventory.products id; empty while a free-text purchase request line is not mapped yet. */
	productId: string;
	sku: string;
	name: string;
	unit: string;
	quantity: string;
	unitPrice: string;
	specification: string;
	/** The purchase request line this line orders (PR → PO), and what it asked for. */
	purchaseRequestItemId: string | null;
	requestLabel: string | null;
};

/** Item search used to map a free-text request line to an item of the master. */
function ItemMapper({ id, onPick }: { id: string; onPick: (item: TProduct) => void }) {
	const { t } = useTranslation(['procurement']);
	const [search, setSearch] = useState('');
	const deferred = useDeferredValue(search.trim());
	const items = useQuery({
		queryKey: ['inventory', 'items', 'po-mapper', deferred] as const,
		queryFn: () => listProducts({ search: deferred || undefined, activeOnly: true, limit: 10 }),
		enabled: deferred !== '',
	});
	return (
		<div className='flex flex-col gap-2 rounded-md border border-dashed border-amber-500 p-2'>
			<FieldLabel htmlFor={id}>{t('procurement:po.mapItem')}</FieldLabel>
			<Input id={id} type='search' placeholder={t('procurement:po.itemSearchHint')} value={search} onChange={(event) => setSearch(event.target.value)} />
			{deferred !== '' && (
				<ul className='flex max-h-40 flex-col overflow-y-auto rounded-md border'>
					{(items.data?.rows ?? []).map((item) => (
						<li key={item.id}>
							<button
								type='button'
								className='flex w-full justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-muted'
								onClick={() => onPick(item)}
							>
								<span>
									<span className='font-medium'>{item.name}</span>
									<span className='text-muted-foreground'> · {item.sku}</span>
								</span>
								<span className='text-muted-foreground'>{formatIdr(item.purchasePrice)}</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/** A purchase order line drafted from an open purchase request line. */
function fromRequestLine(line: TOpenRequestLine): TLineDraft {
	return {
		key: crypto.randomUUID(),
		productId: line.productId ?? '',
		sku: line.sku ?? '',
		name: line.name,
		unit: line.unit,
		quantity: String(Number(line.quantity)),
		unitPrice: minorToRupiah(line.estimatedUnitPrice),
		specification: line.specification ?? '',
		purchaseRequestItemId: line.id,
		requestLabel: `${line.purchaseRequestCode ?? '—'} · ${line.name}`,
	};
}

/** Create/edit form for a purchase order; totals are a preview, the server recomputes. */
export function PurchaseOrderForm({
	order,
	fromRequestId,
	submitting,
	onSubmit,
	onCancel,
}: {
	order: TPurchaseOrderDetail | null;
	/** Prefills the open lines of this approved purchase request (new PO only). */
	fromRequestId?: string;
	submitting: boolean;
	onSubmit: (input: TPurchaseOrderInput) => void;
	onCancel: () => void;
}) {
	const { t } = useTranslation(['procurement', 'common']);
	const [supplierId, setSupplierId] = useState(order?.supplierCompanyId ?? '');
	const [supplierPicId, setSupplierPicId] = useState(order?.supplierPicId ?? '');
	const [supplierSearch, setSupplierSearch] = useState('');
	const [category, setCategory] = useState<TPurchaseCategory>(order?.category ?? 'hardware');
	const [subject, setSubject] = useState(order?.subject ?? '');
	const [orderDate, setOrderDate] = useState(order?.orderDate ?? todayBusinessDate());
	const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(order?.expectedDeliveryDate ?? '');
	const [supplierQuoteRef, setSupplierQuoteRef] = useState(order?.supplierQuoteRef ?? '');
	const [supplierQuoteDate, setSupplierQuoteDate] = useState(order?.supplierQuoteDate ?? '');
	const [projectName, setProjectName] = useState(order?.projectName ?? '');
	const [buyerPicName, setBuyerPicName] = useState(order?.buyerPicName ?? '');
	const [vatMode, setVatMode] = useState<TPoVatMode>(order?.vatMode ?? 'included');
	const [vatPercent, setVatPercent] = useState(String((order && order.vatMode !== 'none' ? order.vatRateBps : 1100) / 100));
	const [paymentTerms, setPaymentTerms] = useState(order?.paymentTerms ?? '');
	const [terms, setTerms] = useState(order?.terms ?? '');
	const [notes, setNotes] = useState(order?.notes ?? '');
	const [lines, setLines] = useState<TLineDraft[]>(
		(order?.items ?? []).map((item) => ({
			key: crypto.randomUUID(),
			productId: item.productId ?? '',
			sku: item.sku,
			name: item.name,
			unit: item.unit,
			quantity: String(Number(item.quantity)),
			unitPrice: minorToRupiah(item.unitPrice),
			specification: item.specification ?? '',
			purchaseRequestItemId: item.purchaseRequestItemId,
			requestLabel: item.purchaseRequestCode,
		})),
	);
	const [requestSearch, setRequestSearch] = useState('');
	const [showRequests, setShowRequests] = useState(false);
	const deferredRequest = useDeferredValue(requestSearch.trim());
	const openLines = useQuery(openRequestLinesQueryOptions({ search: deferredRequest || undefined }, showRequests));
	const prefill = useQuery(openRequestLinesQueryOptions({ purchaseRequestId: fromRequestId }, !!fromRequestId && !order));
	const prefilled = useRef(false);
	useEffect(() => {
		if (prefilled.current || !prefill.data || prefill.data.length === 0) return;
		prefilled.current = true;
		const first = prefill.data[0]!;
		setLines((current) => [...current, ...prefill.data.map(fromRequestLine)]);
		setSubject((current) => current || first.purchaseRequestSubject.slice(0, 200));
		setProjectName((current) => current || (first.projectName ?? ''));
	}, [prefill.data]);
	const usedRequestLines = new Set(lines.map((line) => line.purchaseRequestItemId).filter(Boolean));
	const [itemSearch, setItemSearch] = useState('');
	const deferredSupplier = useDeferredValue(supplierSearch.trim());
	const deferredItem = useDeferredValue(itemSearch.trim());
	const suppliers = useQuery(supplierCompaniesQueryOptions({ status: 'active', search: deferredSupplier || undefined, limit: 20 }));
	const supplierPeople = useQuery(supplierPeopleQueryOptions(supplierId));
	const items = useQuery({
		queryKey: ['inventory', 'items', 'po-picker', deferredItem] as const,
		queryFn: () => listProducts({ search: deferredItem || undefined, activeOnly: true, limit: 20 }),
		enabled: deferredItem !== '',
	});

	const vatRateBps = Math.round(Number(vatPercent || '0') * 100);
	const lineTotals = lines.map((line) => Math.round((Math.round(Number(line.quantity) * 1000) * rupiahToMinor(line.unitPrice)) / 1000));
	const totals = previewPoTotals(lineTotals, vatMode, vatMode === 'none' ? 0 : vatRateBps);
	const supplierOptions = suppliers.data?.rows ?? [];
	const patch = (key: string, value: Partial<TLineDraft>) =>
		setLines((current) => current.map((line) => (line.key === key ? { ...line, ...value } : line)));

	function addItem(item: TProduct) {
		setLines((current) => [
			...current,
			{
				key: crypto.randomUUID(),
				productId: item.id,
				sku: item.sku,
				name: item.name,
				unit: item.unitLabel,
				quantity: '1',
				unitPrice: minorToRupiah(item.purchasePrice),
				specification: item.specification ?? '',
				purchaseRequestItemId: null,
				requestLabel: null,
			},
		]);
		setItemSearch('');
	}

	/** Maps a free-text request line to an item: name, SKU and unit come from the master. */
	function mapItem(key: string, item: TProduct) {
		patch(key, {
			productId: item.id,
			sku: item.sku,
			name: item.name,
			unit: item.unitLabel,
			specification: item.specification ?? '',
		});
	}

	const unmapped = lines.some((line) => !line.productId);

	const text = (value: string) => value.trim() || null;
	const input = (id: string, label: string, value: string, set: (value: string) => void, props: React.ComponentProps<typeof Input> = {}) => (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input id={id} value={value} onChange={(event) => set(event.target.value)} {...props} />
		</Field>
	);

	return (
		<form
			className='flex flex-col gap-6'
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit({
					supplierCompanyId: supplierId,
					supplierPicId: supplierPicId || null,
					category,
					subject: subject.trim(),
					orderDate,
					expectedDeliveryDate: expectedDeliveryDate || null,
					supplierQuoteRef: text(supplierQuoteRef),
					supplierQuoteDate: supplierQuoteDate || null,
					projectName: text(projectName),
					buyerPicName: text(buyerPicName),
					vatMode,
					vatRateBps: vatMode === 'none' ? null : vatRateBps,
					paymentTerms: text(paymentTerms),
					terms: text(terms),
					notes: text(notes),
					lines: lines.map((line) => ({
						productId: line.productId,
						quantity: line.quantity,
						unitPrice: rupiahToMinor(line.unitPrice),
						specification: text(line.specification),
						purchaseRequestItemId: line.purchaseRequestItemId,
					})),
				});
			}}
		>
			<Card>
				<CardHeader>
					<CardTitle>{t('procurement:po.header')}</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='po-supplier-search'>{t('procurement:po.findSupplier')}</FieldLabel>
							<InputGroup>
								<InputGroupAddon align='inline-start'>
									<Search aria-hidden='true' />
								</InputGroupAddon>
								<InputGroupInput
									id='po-supplier-search'
									type='search'
									value={supplierSearch}
									onChange={(event) => setSupplierSearch(event.target.value)}
								/>
							</InputGroup>
						</Field>
						<Field>
							<FieldLabel htmlFor='po-supplier'>{t('procurement:po.supplier')}</FieldLabel>
							<Select
								required
								value={supplierId === '' ? 'none' : supplierId}
								onValueChange={(value: string | null) => {
									setSupplierId(value == null || value === 'none' ? '' : value);
									setSupplierPicId('');
								}}
							>
								<SelectTrigger id='po-supplier' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>{t('procurement:po.pickSupplier')}</SelectItem>
									{order && !supplierOptions.some((row) => row.id === order.supplierCompanyId) && (
										<SelectItem value={order.supplierCompanyId}>
											{order.supplierSnapshot.code} — {order.supplierSnapshot.name}
										</SelectItem>
									)}
									{supplierOptions.map((row) => (
										<SelectItem key={row.id} value={row.id}>
											{row.code} — {row.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='po-supplier-pic'>{t('procurement:po.supplierPic')}</FieldLabel>
							<Select
								value={supplierPicId === '' ? 'none' : supplierPicId}
								onValueChange={(value: string | null) => setSupplierPicId(value == null || value === 'none' ? '' : value)}
							>
								<SelectTrigger id='po-supplier-pic' className='w-full' disabled={supplierId === ''}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>{t('procurement:po.noPic')}</SelectItem>
									{(supplierPeople.data ?? []).map((person) => (
										<SelectItem key={person.id} value={person.id}>
											{person.name}
											{person.title ? ` (${person.title})` : ''}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='po-category'>{t('procurement:po.category')}</FieldLabel>
							<Select
								value={category}
								onValueChange={(value: string | null) => setCategory(value as TPurchaseCategory)}
							>
								<SelectTrigger id='po-category' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PURCHASE_CATEGORIES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`procurement:category.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						{input('po-subject', t('procurement:po.subject'), subject, setSubject, { required: true, maxLength: 200 })}
						{input('po-date', t('procurement:po.orderDate'), orderDate, setOrderDate, { type: 'date', required: true })}
						{input('po-delivery', t('procurement:po.expectedDeliveryDate'), expectedDeliveryDate, setExpectedDeliveryDate, { type: 'date', min: orderDate })}
						{input('po-quote-ref', t('procurement:po.supplierQuoteRef'), supplierQuoteRef, setSupplierQuoteRef, { maxLength: 100 })}
						{input('po-quote-date', t('procurement:po.supplierQuoteDate'), supplierQuoteDate, setSupplierQuoteDate, { type: 'date' })}
						{input('po-project', t('procurement:po.projectName'), projectName, setProjectName, { maxLength: 200 })}
						{input('po-buyer-pic', t('procurement:po.buyerPicName'), buyerPicName, setBuyerPicName, { maxLength: 120 })}
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('procurement:po.lines')}</CardTitle>
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					{lines.map((line, index) => (
						<div key={line.key} className='grid gap-3 rounded-md border p-3 sm:grid-cols-6'>
							<div className='flex items-center justify-between sm:col-span-6'>
								<span className='text-sm font-medium'>
									{index + 1}. {line.name}
									{line.sku ? ` · ${line.sku}` : ''}
									{line.requestLabel && (
										<span className='ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground'>
											{t('procurement:po.fromRequest', { request: line.requestLabel })}
										</span>
									)}
								</span>
								<Button type='button' variant='ghost' size='sm' onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}>
									{t('procurement:po.removeLine')}
								</Button>
							</div>
							{!line.productId && (
								<div className='sm:col-span-6'>
									<ItemMapper id={`po-map-${line.key}`} onPick={(item) => mapItem(line.key, item)} />
								</div>
							)}
							<Field className='sm:col-span-6'>
								<FieldLabel htmlFor={`po-spec-${line.key}`}>{t('procurement:po.specification')}</FieldLabel>
								<Textarea
									id={`po-spec-${line.key}`}
									rows={2}
									maxLength={4000}
									value={line.specification}
									onChange={(event) => patch(line.key, { specification: event.target.value })}
								/>
							</Field>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor={`po-qty-${line.key}`}>
									{t('procurement:po.quantity')} ({line.unit})
								</FieldLabel>
								<Input
									id={`po-qty-${line.key}`}
									type='number'
									required
									min='0.001'
									step='0.001'
									inputMode='decimal'
									value={line.quantity}
									onChange={(event) => patch(line.key, { quantity: event.target.value })}
								/>
							</Field>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor={`po-price-${line.key}`}>{t('procurement:po.unitPrice')}</FieldLabel>
								<Input
									id={`po-price-${line.key}`}
									type='number'
									required
									min='0'
									step='0.01'
									inputMode='decimal'
									value={line.unitPrice}
									onChange={(event) => patch(line.key, { unitPrice: event.target.value })}
								/>
							</Field>
							<div className='flex flex-col justify-end text-right text-sm sm:col-span-2'>
								<span className='text-muted-foreground'>{t('procurement:po.lineTotal')}</span>
								<span className='font-medium'>{formatIdr(lineTotals[index] ?? 0)}</span>
							</div>
						</div>
					))}
					<div className='flex flex-col gap-2 rounded-md border border-dashed p-3'>
						<div className='flex items-center justify-between gap-2'>
							<span className='text-sm font-medium'>{t('procurement:po.fromRequests')}</span>
							<Button type='button' variant='outline' size='sm' onClick={() => setShowRequests((value) => !value)}>
								{showRequests ? t('procurement:po.hideRequests') : t('procurement:po.showRequests')}
							</Button>
						</div>
						{showRequests && (
							<>
								<Input
									id='po-request-search'
									type='search'
									aria-label={t('procurement:po.requestSearchHint')}
									placeholder={t('procurement:po.requestSearchHint')}
									value={requestSearch}
									onChange={(event) => setRequestSearch(event.target.value)}
								/>
								<ul className='flex max-h-64 flex-col overflow-y-auto rounded-md border'>
									{(openLines.data ?? [])
										.filter((line) => !usedRequestLines.has(line.id))
										.map((line) => (
											<li key={line.id}>
												<button
													type='button'
													className='flex w-full justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-muted'
													onClick={() => setLines((current) => [...current, fromRequestLine(line)])}
												>
													<span>
														<span className='font-medium'>{line.name}</span>
														<span className='text-muted-foreground'>
															{' '}
															· {Number(line.quantity)} {line.unit} · {line.purchaseRequestCode ?? '—'} · {line.requestedByName ?? '—'}
														</span>
													</span>
													<span className='text-muted-foreground'>{line.productId ? formatIdr(line.estimatedUnitPrice) : t('procurement:pr.freeText')}</span>
												</button>
											</li>
										))}
									{openLines.data?.filter((line) => !usedRequestLines.has(line.id)).length === 0 && (
										<li>
											<EmptyState title={t('procurement:po.noOpenRequests')} size='sm' />
										</li>
									)}
								</ul>
							</>
						)}
					</div>
					<div className='flex flex-col gap-2 rounded-md border border-dashed p-3'>
						<FieldLabel htmlFor='po-item-search'>{t('procurement:po.addItem')}</FieldLabel>
						<InputGroup>
							<InputGroupAddon align='inline-start'>
								<Search aria-hidden='true' />
							</InputGroupAddon>
							<InputGroupInput
								id='po-item-search'
								type='search'
								placeholder={t('procurement:po.itemSearchHint')}
								value={itemSearch}
								onChange={(event) => setItemSearch(event.target.value)}
							/>
						</InputGroup>
						{deferredItem !== '' && (
							<ul className='flex max-h-56 flex-col overflow-y-auto rounded-md border'>
								{(items.data?.rows ?? []).map((item) => (
									<li key={item.id}>
										<button
											type='button'
											className='flex w-full justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-muted'
											onClick={() => addItem(item)}
										>
											<span>
												<span className='font-medium'>{item.name}</span>
												<span className='text-muted-foreground'> · {item.sku}</span>
											</span>
											<span className='text-muted-foreground'>{formatIdr(item.purchasePrice)}</span>
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('procurement:po.totalsAndTerms')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-6 sm:grid-cols-2'>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor='po-vat-mode'>{t('procurement:po.vatMode')}</FieldLabel>
							<Select
								value={vatMode}
								onValueChange={(value: string | null) => setVatMode(value as TPoVatMode)}
							>
								<SelectTrigger id='po-vat-mode' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PO_VAT_MODES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`procurement:vatMode.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						{vatMode !== 'none' &&
							input('po-vat-rate', t('procurement:po.vatRate'), vatPercent, setVatPercent, {
								type: 'number',
								min: '0',
								max: '100',
								step: '0.01',
								inputMode: 'decimal',
							})}
						<Field>
							<FieldLabel htmlFor='po-payment'>{t('procurement:po.paymentTerms')}</FieldLabel>
							<Input id='po-payment' maxLength={500} value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} />
							<FieldDescription>{t('procurement:po.paymentTermsHint')}</FieldDescription>
						</Field>
					</FieldGroup>
					<dl className='flex flex-col gap-1 text-sm'>
						<div className='flex justify-between'>
							<dt>{t('procurement:po.subtotal')}</dt>
							<dd>{formatIdr(totals.subtotal)}</dd>
						</div>
						<div className='flex justify-between'>
							<dt>{t(`procurement:vatMode.${vatMode}`)}</dt>
							<dd>{formatIdr(totals.taxTotal)}</dd>
						</div>
						<div className='flex justify-between border-t pt-1 text-base font-bold'>
							<dt>{t('procurement:po.grandTotal')}</dt>
							<dd>{formatIdr(totals.grandTotal)}</dd>
						</div>
					</dl>
					<Field className='sm:col-span-2'>
						<FieldLabel htmlFor='po-terms'>{t('procurement:po.terms')}</FieldLabel>
						<Textarea id='po-terms' rows={5} maxLength={8000} value={terms} onChange={(event) => setTerms(event.target.value)} />
						<FieldDescription>{t('procurement:po.termsHint')}</FieldDescription>
					</Field>
					<Field className='sm:col-span-2'>
						<FieldLabel htmlFor='po-notes'>{t('procurement:po.notes')}</FieldLabel>
						<Textarea id='po-notes' rows={3} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />
					</Field>
				</CardContent>
				<CardFooter className='justify-end gap-2'>
					<Button type='button' variant='outline' onClick={onCancel}>
						{t('common:action.cancel')}
					</Button>
					{unmapped && <span className='self-center text-sm text-amber-600'>{t('procurement:po.unmappedHint')}</span>}
					<Button type='submit' disabled={submitting || lines.length === 0 || !supplierId || unmapped}>
						{t('common:action.save')}
					</Button>
				</CardFooter>
			</Card>
		</form>
	);
}
