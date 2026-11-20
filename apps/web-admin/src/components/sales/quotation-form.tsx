import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
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
import { customerQueryOptions, customersQueryOptions } from '@/lib/customer-api';
import { formatIdr, minorToRupiah, rupiahToMinor, todayBusinessDate } from '@/lib/format';
import { ITEM_UNIT_LABELS, listProducts, type TItemUnitLabel, type TProduct } from '@/lib/inventory-api';
import {
	DEFAULT_VAT_RATE_BPS,
	previewLineTotal,
	previewTotals,
	type TQuotationDetail,
	type TQuotationInput,
} from '@/lib/quotation-api';

/** A line while it is being edited: money as typed rupiah strings. */
type TLineDraft = {
	key: string;
	productId: string | null;
	sku: string | null;
	name: string;
	specification: string;
	unit: TItemUnitLabel;
	quantity: string;
	unitPrice: string;
	discount: string;
};

type TScheduleDraft = { key: string; label: string; percent: string };

const newKey = () => crypto.randomUUID();

/**
 * Create/edit form for a quotation (SPH). Money is typed in rupiah and sent
 * in minor units; the totals shown are a preview — the server recomputes
 * them from the lines.
 */
export function QuotationForm({
	quotation,
	initialCustomerId,
	leadId,
	defaultTerms,
	submitting,
	onSubmit,
	onCancel,
}: {
	quotation: TQuotationDetail | null;
	initialCustomerId?: string;
	leadId?: string;
	defaultTerms: string | null;
	submitting: boolean;
	onSubmit: (input: TQuotationInput & { leadId?: string | null }) => void;
	onCancel: () => void;
}) {
	const { t } = useTranslation(['sales', 'common']);
	const [customerId, setCustomerId] = useState(quotation?.customerId ?? initialCustomerId ?? '');
	const [customerSearch, setCustomerSearch] = useState('');
	const [title, setTitle] = useState(quotation?.title ?? '');
	const [heading, setHeading] = useState(quotation?.heading ?? '');
	const [attention, setAttention] = useState(quotation?.attention ?? '');
	const [quotationDate, setQuotationDate] = useState(quotation?.quotationDate ?? todayBusinessDate());
	const [validUntil, setValidUntil] = useState(quotation?.validUntil ?? '');
	const [paymentTerms, setPaymentTerms] = useState(quotation?.paymentTerms ?? '');
	const [guarantee, setGuarantee] = useState(quotation?.guarantee ?? '');
	const [vatEnabled, setVatEnabled] = useState(quotation?.vatEnabled ?? true);
	const [vatPercent, setVatPercent] = useState(
		String((quotation?.vatEnabled ? quotation.vatRateBps : DEFAULT_VAT_RATE_BPS) / 100),
	);
	const [notes, setNotes] = useState(quotation?.notes ?? '');
	const [terms, setTerms] = useState(quotation?.terms ?? defaultTerms ?? '');
	const [schedule, setSchedule] = useState<TScheduleDraft[]>(
		(quotation?.paymentSchedule ?? []).map((term) => ({
			key: newKey(),
			label: term.label,
			percent: String(term.percentBps / 100),
		})),
	);
	const [lines, setLines] = useState<TLineDraft[]>(
		(quotation?.items ?? []).map((item) => ({
			key: newKey(),
			productId: item.productId,
			sku: item.sku,
			name: item.name,
			specification: item.specification ?? '',
			unit: item.unit,
			quantity: String(Number(item.quantity)),
			unitPrice: minorToRupiah(item.unitPrice),
			discount: item.discountAmount ? minorToRupiah(item.discountAmount) : '',
		})),
	);
	const [itemSearch, setItemSearch] = useState('');
	const deferredCustomerSearch = useDeferredValue(customerSearch.trim());
	const deferredItemSearch = useDeferredValue(itemSearch.trim());

	const customers = useQuery(
		customersQueryOptions({ status: 'active', search: deferredCustomerSearch || undefined, limit: 20 }),
	);
	const customer = useQuery({ ...customerQueryOptions(customerId), enabled: customerId !== '' });
	const items = useQuery({
		queryKey: ['inventory', 'items', 'quotation-picker', deferredItemSearch] as const,
		queryFn: () => listProducts({ search: deferredItemSearch || undefined, activeOnly: true, limit: 20 }),
		enabled: deferredItemSearch !== '',
	});

	const customerOptions = customers.data?.rows ?? [];
	const chosen = customer.data;
	const pickedInList = customerOptions.some((row) => row.id === customerId);

	const vatRateBps = Math.round(Number(vatPercent || '0') * 100);
	const inputLines = lines.map((line) => ({
		productId: line.productId,
		name: line.name.trim() || null,
		specification: line.specification.trim() || null,
		unit: line.unit,
		quantity: line.quantity,
		unitPrice: line.unitPrice === '' ? null : rupiahToMinor(line.unitPrice),
		discountAmount: rupiahToMinor(line.discount),
	}));
	const totals = previewTotals(inputLines, vatEnabled, vatRateBps);
	const scheduleTotal = schedule.reduce((sum, term) => sum + Math.round(Number(term.percent || '0') * 100), 0);
	const scheduleValid = schedule.length === 0 || scheduleTotal === 10_000;

	const patchLine = (key: string, patch: Partial<TLineDraft>) =>
		setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

	function addItem(item: TProduct) {
		setLines((current) => [
			...current,
			{
				key: newKey(),
				productId: item.id,
				sku: item.sku,
				name: item.name,
				specification: item.specification ?? '',
				unit: item.unitLabel,
				quantity: '1',
				unitPrice: minorToRupiah(item.sellingPrice),
				discount: '',
			},
		]);
		setItemSearch('');
	}

	function addCustomLine() {
		setLines((current) => [
			...current,
			{ key: newKey(), productId: null, sku: null, name: '', specification: '', unit: 'paket', quantity: '1', unitPrice: '', discount: '' },
		]);
	}

	return (
		<form
			className='flex flex-col gap-6'
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit({
					customerId,
					// The billed company is the chosen person's (a contact of it), if any.
					companyId: chosen ? chosen.companyId : (quotation?.companyId ?? null),
					leadId: quotation ? quotation.leadId : (leadId ?? null),
					title: title.trim(),
					heading: heading.trim() || null,
					attention: attention.trim() || null,
					paymentTerms: paymentTerms.trim() || null,
					paymentSchedule: schedule.length
						? schedule.map((term) => ({ label: term.label.trim(), percentBps: Math.round(Number(term.percent) * 100) }))
						: null,
					guarantee: guarantee.trim() || null,
					quotationDate,
					validUntil: validUntil || null,
					vatEnabled,
					vatRateBps: vatEnabled ? vatRateBps : null,
					notes: notes.trim() || null,
					terms: terms.trim() || null,
					lines: inputLines,
				});
			}}
		>
			<Card>
				<CardHeader>
					<CardTitle>{t('sales:form.customer')}</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='quotation-customer-search'>{t('sales:form.customerSearch')}</FieldLabel>
							<InputGroup>
								<InputGroupAddon align='inline-start'>
									<Search aria-hidden='true' />
								</InputGroupAddon>
								<InputGroupInput
									id='quotation-customer-search'
									type='search'
									value={customerSearch}
									onChange={(e) => setCustomerSearch(e.target.value)}
									placeholder={t('sales:form.customerSearchHint')}
								/>
							</InputGroup>
						</Field>
						<Field>
							<FieldLabel htmlFor='quotation-customer'>{t('sales:quotation.customer')}</FieldLabel>
							<Select
								required
								value={customerId === '' ? 'none' : customerId}
								onValueChange={(value: string | null) => {
									setCustomerId(value == null || value === 'none' ? '' : value);
								}}
							>
								<SelectTrigger id='quotation-customer' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>{t('sales:form.pickCustomer')}</SelectItem>
									{!pickedInList && chosen && (
										<SelectItem value={chosen.id}>
											{chosen.code} — {chosen.name}
										</SelectItem>
									)}
									{customerOptions.map((row) => (
										<SelectItem key={row.id} value={row.id}>
											{row.code} — {row.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='quotation-attention'>{t('sales:quotation.attention')}</FieldLabel>
							<Input
								id='quotation-attention'
								maxLength={200}
								value={attention}
								onChange={(e) => setAttention(e.target.value)}
							/>
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('sales:form.document')}</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='quotation-title'>{t('sales:quotation.title')}</FieldLabel>
							<Input
								id='quotation-title'
								required
								maxLength={200}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
							/>
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='quotation-heading'>{t('sales:quotation.heading')}</FieldLabel>
							<Input
								id='quotation-heading'
								maxLength={120}
								value={heading}
								placeholder='QUOTATION'
								onChange={(e) => setHeading(e.target.value)}
							/>
							<FieldDescription>{t('sales:form.headingHint')}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='quotation-date'>{t('sales:quotation.date')}</FieldLabel>
							<DatePicker
								id='quotation-date'
								required
								value={quotationDate}
								onChange={setQuotationDate}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='quotation-valid-until'>{t('sales:quotation.validUntil')}</FieldLabel>
							<DatePicker
								id='quotation-valid-until'
								min={quotationDate}
								value={validUntil}
								onChange={setValidUntil}
							/>
							<FieldDescription>{t('sales:form.validUntilHint')}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='quotation-guarantee'>{t('sales:quotation.guarantee')}</FieldLabel>
							<Input
								id='quotation-guarantee'
								maxLength={300}
								value={guarantee}
								onChange={(e) => setGuarantee(e.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='quotation-payment-terms'>{t('sales:quotation.paymentTerms')}</FieldLabel>
							<Input
								id='quotation-payment-terms'
								maxLength={300}
								value={paymentTerms}
								onChange={(e) => setPaymentTerms(e.target.value)}
							/>
							<FieldDescription>{t('sales:form.paymentTermsHint')}</FieldDescription>
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('sales:form.lines')}</CardTitle>
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					{lines.length === 0 && <p className='text-sm text-muted-foreground'>{t('sales:form.noLines')}</p>}
					{lines.map((line, index) => (
						<div key={line.key} className='grid gap-3 rounded-md border p-3 sm:grid-cols-6'>
							<div className='flex items-center justify-between sm:col-span-6'>
								<span className='text-sm font-medium'>
									{t('sales:form.lineNumber', { number: index + 1 })}
									{line.sku ? ` · ${line.sku}` : ` · ${t('sales:form.customLine')}`}
								</span>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}
								>
									{t('sales:form.removeLine')}
								</Button>
							</div>
							<Field className='sm:col-span-6'>
								<FieldLabel htmlFor={`line-name-${line.key}`}>{t('sales:line.name')}</FieldLabel>
								<Input
									id={`line-name-${line.key}`}
									required
									maxLength={300}
									value={line.name}
									onChange={(e) => patchLine(line.key, { name: e.target.value })}
								/>
							</Field>
							<Field className='sm:col-span-6'>
								<FieldLabel htmlFor={`line-spec-${line.key}`}>{t('sales:line.specification')}</FieldLabel>
								<Textarea
									id={`line-spec-${line.key}`}
									rows={2}
									maxLength={4000}
									value={line.specification}
									onChange={(e) => patchLine(line.key, { specification: e.target.value })}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={`line-qty-${line.key}`}>{t('sales:line.quantity')}</FieldLabel>
								<Input
									id={`line-qty-${line.key}`}
									type='number'
									required
									min='0.001'
									step='0.001'
									inputMode='decimal'
									value={line.quantity}
									onChange={(e) => patchLine(line.key, { quantity: e.target.value })}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={`line-unit-${line.key}`}>{t('sales:line.unit')}</FieldLabel>
								<Select
									value={line.unit}
									onValueChange={(value: string | null) => patchLine(line.key, { unit: value as TItemUnitLabel })}
								>
									<SelectTrigger id={`line-unit-${line.key}`} className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ITEM_UNIT_LABELS.map((unit) => (
											<SelectItem key={unit} value={unit}>
												{unit}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor={`line-price-${line.key}`}>{t('sales:line.unitPrice')}</FieldLabel>
								<Input
									id={`line-price-${line.key}`}
									type='number'
									required
									min='0'
									step='0.01'
									inputMode='decimal'
									value={line.unitPrice}
									onChange={(e) => patchLine(line.key, { unitPrice: e.target.value })}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={`line-discount-${line.key}`}>{t('sales:line.discount')}</FieldLabel>
								<Input
									id={`line-discount-${line.key}`}
									type='number'
									min='0'
									step='0.01'
									inputMode='decimal'
									value={line.discount}
									onChange={(e) => patchLine(line.key, { discount: e.target.value })}
								/>
							</Field>
							<div className='flex flex-col justify-end text-right text-sm'>
								<span className='text-muted-foreground'>{t('sales:line.total')}</span>
								<span className='font-medium'>{formatIdr(previewLineTotal(inputLines[index]!))}</span>
							</div>
						</div>
					))}

					<div className='flex flex-col gap-2 rounded-md border border-dashed p-3'>
						<FieldLabel htmlFor='quotation-item-search'>{t('sales:form.addItem')}</FieldLabel>
						<InputGroup>
							<InputGroupAddon align='inline-start'>
								<Search aria-hidden='true' />
							</InputGroupAddon>
							<InputGroupInput
								id='quotation-item-search'
								type='search'
								value={itemSearch}
								placeholder={t('sales:form.itemSearchHint')}
								onChange={(e) => setItemSearch(e.target.value)}
							/>
						</InputGroup>
						{deferredItemSearch !== '' && (
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
											<span className='text-muted-foreground'>{formatIdr(item.sellingPrice)}</span>
										</button>
									</li>
								))}
								{items.data?.rows.length === 0 && (
									<li className='px-3 py-2 text-sm text-muted-foreground'>{t('sales:form.noItems')}</li>
								)}
							</ul>
						)}
						<div>
							<Button type='button' variant='outline' size='sm' onClick={addCustomLine}>
								{t('sales:form.addCustomLine')}
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('sales:form.totals')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-6 sm:grid-cols-2'>
					<FieldGroup>
						<label className='flex items-center gap-2 text-sm'>
							<Checkbox checked={vatEnabled} onCheckedChange={(checked) => setVatEnabled(checked === true)} />
							{t('sales:quotation.vatEnabled')}
						</label>
						{vatEnabled && (
							<Field>
								<FieldLabel htmlFor='quotation-vat'>{t('sales:quotation.vatRate')}</FieldLabel>
								<Input
									id='quotation-vat'
									type='number'
									min='0'
									max='100'
									step='0.01'
									inputMode='decimal'
									value={vatPercent}
									onChange={(e) => setVatPercent(e.target.value)}
								/>
							</Field>
						)}
						<div className='flex flex-col gap-2'>
							<span className='text-sm font-medium'>{t('sales:quotation.schedule')}</span>
							{schedule.map((term) => (
								<div key={term.key} className='flex gap-2'>
									<Input
										aria-label={t('sales:form.scheduleLabel')}
										placeholder={t('sales:form.scheduleLabel')}
										required
										maxLength={60}
										value={term.label}
										onChange={(e) =>
											setSchedule((rows) =>
												rows.map((row) => (row.key === term.key ? { ...row, label: e.target.value } : row)),
											)
										}
									/>
									<Input
										aria-label={t('sales:form.schedulePercent')}
										type='number'
										className='w-28'
										required
										min='0.01'
										max='100'
										step='0.01'
										inputMode='decimal'
										value={term.percent}
										onChange={(e) =>
											setSchedule((rows) =>
												rows.map((row) => (row.key === term.key ? { ...row, percent: e.target.value } : row)),
											)
										}
									/>
									<Button
										type='button'
										variant='ghost'
										size='sm'
										onClick={() => setSchedule((rows) => rows.filter((row) => row.key !== term.key))}
									>
										{t('sales:form.removeLine')}
									</Button>
								</div>
							))}
							{schedule.length < 6 && (
								<div>
									<Button
										type='button'
										variant='outline'
										size='sm'
										onClick={() => setSchedule((rows) => [...rows, { key: newKey(), label: '', percent: '' }])}
									>
										{t('sales:form.addTerm')}
									</Button>
								</div>
							)}
							{!scheduleValid && (
								<p className='text-sm text-destructive'>
									{t('sales:form.scheduleSum', { percent: scheduleTotal / 100 })}
								</p>
							)}
						</div>
					</FieldGroup>
					<dl className='flex flex-col gap-1 text-sm'>
						<div className='flex justify-between'>
							<dt>{t('sales:quotation.subtotal')}</dt>
							<dd>{formatIdr(totals.subtotal)}</dd>
						</div>
						<div className='flex justify-between'>
							<dt>{t('sales:quotation.discount')}</dt>
							<dd>− {formatIdr(totals.discountTotal)}</dd>
						</div>
						<div className='flex justify-between'>
							<dt>{t('sales:quotation.vat')}</dt>
							<dd>{formatIdr(totals.taxTotal)}</dd>
						</div>
						<div className='flex justify-between border-t pt-1 text-base font-bold'>
							<dt>{t('sales:quotation.grandTotal')}</dt>
							<dd>{formatIdr(totals.grandTotal)}</dd>
						</div>
					</dl>
				</CardContent>
			</Card>

			<Card>
				<CardContent className='pt-6'>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor='quotation-terms'>{t('sales:quotation.terms')}</FieldLabel>
							<Textarea
								id='quotation-terms'
								rows={5}
								maxLength={8000}
								value={terms}
								onChange={(e) => setTerms(e.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='quotation-notes'>{t('sales:quotation.notes')}</FieldLabel>
							<Textarea
								id='quotation-notes'
								rows={3}
								maxLength={4000}
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
							/>
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>

			<div className='flex justify-end gap-2'>
				<Button type='button' variant='outline' onClick={onCancel}>
					{t('common:action.cancel')}
				</Button>
				<Button type='submit' disabled={submitting || lines.length === 0 || !customerId || !scheduleValid}>
					{t('common:action.save')}
				</Button>
			</div>
		</form>
	);
}
