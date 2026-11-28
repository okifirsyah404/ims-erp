import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { FieldGroup } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';

import { RequiredLegend } from '@/components/form/field-label';
import { FormErrorSummary } from '@/components/form/form-error-summary';
import { FormField } from '@/components/form/form-field';
import { useIssueText } from '@/components/form/use-issue-text';
import { SearchableSelect } from '@/components/inventory/searchable-select';
import { MoneyInput } from '@/components/money-input';
import { ApiError } from '@/lib/api-error';
import { focusControl, serverIssues, type TFieldIssue, type TFieldIssues } from '@/lib/form-validation';
import { formatIdr, minorToRupiah, rupiahToMinor, todayBusinessDate } from '@/lib/format';
import { productsQueryOptions } from '@/lib/inventory-api';
import {
	createStandaloneInvoice,
	invoiceCustomerOptionsQueryOptions,
	STANDARD_VAT_RATE_BPS,
	type TInvoice,
	type TInvoiceCustomerOption,
} from '@/lib/invoice-api';

/** One editable line: a catalogue product (optional) or a free description. */
type TLine = { key: string; productId: string | null; description: string; quantity: string; unitPrice: string };

/** Values another screen may hand over (a paid ticket, B-31; a license renewal). */
export type TInvoiceFormInitial = {
	customer?: TInvoiceCustomerOption | null;
	title?: string;
	lines?: { description: string; quantity: number; unitPriceMinor: number }[];
};

/** Control ids in on-screen order (focus and error summary, RF-16). */
const CONTROL_IDS = {
	customerId: 'inv-customer',
	title: 'inv-title',
	dueDate: 'inv-due-date',
	items: 'inv-lines',
	notes: 'inv-notes',
} as const;
type THeaderField = keyof typeof CONTROL_IDS;
const DUE_DAYS_DEFAULT = 30;

const newLine = (seed: Partial<TLine> = {}): TLine => ({
	key: crypto.randomUUID(),
	productId: null,
	description: '',
	quantity: '1',
	unitPrice: '',
	...seed,
});

/** Due date default: 30 days after today (FU9: required, can be changed). */
function defaultDueDate(): string {
	const [year, month, day] = todayBusinessDate().split('-').map(Number) as [number, number, number];
	return new Date(Date.UTC(year, month - 1, day + DUE_DAYS_DEFAULT)).toISOString().slice(0, 10);
}

/** VAT of one line, rounded the way the server rounds it. */
const lineVat = (base: number, vatEnabled: boolean) => (vatEnabled ? Math.round((base * STANDARD_VAT_RATE_BPS) / 10_000) : 0);

/**
 * Invoice without a sales order (B-42, KF-S6): services, extra costs and
 * license renewals billed straight to a customer.
 *
 * @remarks
 * - Saves a **draft**; the invoice page issues it (number fixed, journal
 *   posted) and records payments, exactly like a term invoice.
 * - The amounts shown are a preview; the server recomputes every total and
 *   the VAT from the lines (11% when ticked).
 * - FU9: the due date is required (default 30 days); the server refuses to
 *   issue an invoice without one.
 */
export function InvoiceForm({ initial, onCreated }: { initial?: TInvoiceFormInitial; onCreated: (invoice: TInvoice) => void }) {
	const { t } = useTranslation(['sales', 'finance', 'common']);
	const issueText = useIssueText();
	const queryClient = useQueryClient();

	const [customer, setCustomer] = useState<TInvoiceCustomerOption | null>(initial?.customer ?? null);
	const [title, setTitle] = useState(initial?.title ?? '');
	const [dueDate, setDueDate] = useState(defaultDueDate);
	const [vatEnabled, setVatEnabled] = useState(true);
	const [lines, setLines] = useState<TLine[]>(() =>
		initial?.lines?.length
			? initial.lines.map((line) =>
					newLine({ description: line.description, quantity: String(line.quantity), unitPrice: minorToRupiah(line.unitPriceMinor) }),
				)
			: [newLine()],
	);
	const [notes, setNotes] = useState('');
	const [submitted, setSubmitted] = useState(false);
	const [server, setServer] = useState<TFieldIssues>({});
	const [formMessage, setFormMessage] = useState<string | null>(null);

	const [customerTerm, setCustomerTerm] = useState('');
	const customers = useQuery(invoiceCustomerOptionsQueryOptions(customerTerm));
	const [productTerm, setProductTerm] = useState('');
	const products = useQuery(productsQueryOptions({ search: productTerm || undefined, activeOnly: true }));

	const labels: Record<THeaderField, string> = {
		customerId: t('sales:freeInvoice.customer'),
		title: t('sales:freeInvoice.titleField'),
		dueDate: t('sales:freeInvoice.dueDate'),
		items: t('sales:freeInvoice.lines'),
		notes: t('sales:freeInvoice.notes'),
	};
	const lineLabels = {
		description: t('sales:freeInvoice.lineDescription'),
		quantity: t('sales:freeInvoice.lineQuantity'),
		unitPrice: t('sales:freeInvoice.lineUnitPrice'),
	};

	const amounts = lines.map((line) => {
		const base = Math.round((Number(line.quantity) || 0) * rupiahToMinor(line.unitPrice));
		return { base, vat: lineVat(base, vatEnabled) };
	});
	const subtotal = amounts.reduce((sum, row) => sum + row.base, 0);
	const vatTotal = amounts.reduce((sum, row) => sum + row.vat, 0);

	/** The checks the screen can make before sending (the server re-checks). */
	function localIssues(): TFieldIssues {
		const issues: TFieldIssues = {};
		if (!customer) issues.customerId = { key: 'required' };
		if (!dueDate) issues.dueDate = { key: 'required' };
		lines.forEach((line, index) => {
			if (!line.description.trim()) issues[`items.${index}.description`] = { key: 'required' };
			if (!(Number(line.quantity) > 0)) issues[`items.${index}.quantity`] = { key: 'min', params: { min: 0.001 } };
			if (!(rupiahToMinor(line.unitPrice) > 0)) issues[`items.${index}.unitPrice`] = { key: 'required' };
		});
		return issues;
	}

	const mutation = useMutation({
		mutationFn: () =>
			createStandaloneInvoice({
				customerId: customer!.id,
				title: title.trim() || null,
				dueDate,
				vatEnabled,
				notes: notes.trim() || null,
				items: lines.map((line) => ({
					productId: line.productId,
					description: line.description.trim(),
					quantity: Number(line.quantity),
					unitPrice: rupiahToMinor(line.unitPrice),
				})),
			}),
		onSuccess: async (invoice) => {
			await queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
			onCreated(invoice);
		},
		onError: (cause) => {
			const error = cause instanceof ApiError ? cause : null;
			const fieldIssues = error ? serverIssues(error) : {};
			setServer(fieldIssues);
			if (error?.isNetworkError) setFormMessage(t('common:form.networkError'));
			else if (error?.ref) setFormMessage(t('common:form.serverError', { ref: error.ref }));
			else setFormMessage(error?.message ?? (cause instanceof Error ? cause.message : t('common:error.failed')));
			const first = orderedFields().find((field) => fieldIssues[field]);
			if (first) focusControl(controlOf(first));
		},
	});

	/** Every field name top to bottom (header, then each line). */
	function orderedFields(): string[] {
		return [
			'customerId',
			'title',
			'dueDate',
			...lines.flatMap((_, index) => [`items.${index}.description`, `items.${index}.quantity`, `items.${index}.unitPrice`]),
			'notes',
		];
	}
	function controlOf(field: string): string {
		const line = /^items\.(\d+)\.(\w+)$/.exec(field);
		if (line) return `inv-line-${line[1]}-${line[2]}`;
		return CONTROL_IDS[field as THeaderField] ?? CONTROL_IDS.items;
	}
	function labelOf(field: string): string {
		const line = /^items\.(\d+)\.(\w+)$/.exec(field);
		if (line) {
			const name = lineLabels[line[2] as keyof typeof lineLabels] ?? labels.items;
			return t('sales:freeInvoice.lineLabel', { number: Number(line[1]) + 1, field: name });
		}
		return labels[field as THeaderField] ?? field;
	}

	const local = submitted ? localIssues() : {};
	const issueOf = (field: string): TFieldIssue | undefined => server[field] ?? local[field];
	const errorOf = (field: string) => issueText(issueOf(field), labelOf(field));
	const summary = orderedFields()
		.filter((field) => issueOf(field))
		.map((field) => ({ id: controlOf(field), text: errorOf(field) ?? '' }));

	const onCustomerSearch = useCallback((next: string) => setCustomerTerm(next), []);
	const onProductSearch = useCallback((next: string) => setProductTerm(next), []);
	const customerRows = customers.data ?? [];
	const customerLabel = (row: TInvoiceCustomerOption) => (row.code ? `${row.code} — ${row.name}` : row.name);
	const customerOptions = customerRows.map((row) => ({ value: row.id, label: customerLabel(row) }));
	if (customer && !customerRows.some((row) => row.id === customer.id)) {
		customerOptions.unshift({ value: customer.id, label: customerLabel(customer) });
	}
	const productRows = products.data?.rows ?? [];
	const productOptions = productRows.map((row) => ({ value: row.id, label: `${row.sku} — ${row.name}` }));

	const setLine = (key: string, patch: Partial<TLine>) =>
		setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

	return (
		<Card className='max-w-4xl'>
			<CardHeader>
				<CardTitle>{t('sales:freeInvoice.formTitle')}</CardTitle>
				<RequiredLegend />
			</CardHeader>
			<CardContent>
				<form
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						setSubmitted(true);
						setServer({});
						setFormMessage(null);
						const issues = localIssues();
						const first = orderedFields().find((field) => issues[field]);
						if (first) {
							focusControl(controlOf(first));
							return;
						}
						mutation.mutate();
					}}
				>
					<FieldGroup>
						<FormErrorSummary items={summary} formMessage={formMessage} />
						<div className='grid gap-4 sm:grid-cols-2'>
							<FormField
								id={CONTROL_IDS.customerId}
								label={labels.customerId}
								required
								description={t('sales:freeInvoice.customerHelp')}
								error={errorOf('customerId')}
							>
								<SearchableSelect
									id={CONTROL_IDS.customerId}
									value={customer?.id ?? null}
									options={customerOptions}
									loading={customers.isFetching}
									placeholder={t('sales:freeInvoice.searchCustomer')}
									emptyLabel={t('common:state.noResults')}
									onSearch={onCustomerSearch}
									onChange={(next) => setCustomer(customerRows.find((row) => row.id === next) ?? null)}
								/>
							</FormField>
							<FormField
								id={CONTROL_IDS.dueDate}
								label={labels.dueDate}
								required
								description={t('sales:freeInvoice.dueDateHelp')}
								error={errorOf('dueDate')}
							>
								<Input
									id={CONTROL_IDS.dueDate}
									type='date'
									min={todayBusinessDate()}
									value={dueDate}
									aria-invalid={Boolean(errorOf('dueDate')) || undefined}
									onChange={(event) => setDueDate(event.target.value)}
								/>
							</FormField>
						</div>
						<FormField
							id={CONTROL_IDS.title}
							label={labels.title}
							optional
							description={t('sales:freeInvoice.titleHelp')}
							error={errorOf('title')}
						>
							<Input id={CONTROL_IDS.title} maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
						</FormField>

						<section aria-labelledby='inv-lines-heading' className='flex flex-col gap-3'>
							<div className='flex flex-wrap items-center justify-between gap-2'>
								<div>
									<h3 id='inv-lines-heading' className='text-sm font-semibold'>
										{labels.items}
									</h3>
									<p className='text-xs text-muted-foreground'>{t('sales:freeInvoice.linesHelp')}</p>
								</div>
								<label className='flex items-center gap-2 text-sm'>
									<Checkbox checked={vatEnabled} onCheckedChange={(checked) => setVatEnabled(checked === true)} />
									{t('sales:freeInvoice.vat', { rate: STANDARD_VAT_RATE_BPS / 100 })}
								</label>
							</div>
							<div id={CONTROL_IDS.items} tabIndex={-1} className='flex flex-col gap-3'>
								{lines.map((line, index) => (
									<div key={line.key} className='flex flex-col gap-3 rounded-lg border p-3'>
										<div className='flex items-center justify-between gap-2'>
											<span className='text-sm font-medium'>{t('sales:freeInvoice.lineNumber', { number: index + 1 })}</span>
											<Button
												type='button'
												variant='ghost'
												size='sm'
												disabled={lines.length === 1}
												aria-label={t('sales:freeInvoice.removeLine', { number: index + 1 })}
												onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}
											>
												<Trash2 aria-hidden='true' />
											</Button>
										</div>
										<FormField
											id={`inv-line-${index}-product`}
											label={t('sales:freeInvoice.lineProduct')}
											optional
											description={t('sales:freeInvoice.lineProductHelp')}
										>
											<SearchableSelect
												id={`inv-line-${index}-product`}
												value={line.productId}
												options={
													line.productId && !productRows.some((row) => row.id === line.productId)
														? [{ value: line.productId, label: line.description }, ...productOptions]
														: productOptions
												}
												loading={products.isFetching}
												placeholder={t('sales:freeInvoice.searchProduct')}
												emptyLabel={t('common:state.noResults')}
												onSearch={onProductSearch}
												onChange={(next) => {
													const product = productRows.find((row) => row.id === next);
													setLine(line.key, product
														? { productId: product.id, description: product.name, unitPrice: minorToRupiah(product.sellingPrice) }
														: { productId: null });
												}}
											/>
										</FormField>
										<div className='grid gap-3 sm:grid-cols-[2fr_1fr_1.4fr]'>
											<FormField
												id={`inv-line-${index}-description`}
												label={lineLabels.description}
												required
												error={errorOf(`items.${index}.description`)}
											>
												<Input
													id={`inv-line-${index}-description`}
													maxLength={300}
													value={line.description}
													aria-invalid={Boolean(errorOf(`items.${index}.description`)) || undefined}
													onChange={(event) => setLine(line.key, { description: event.target.value })}
												/>
											</FormField>
											<FormField
												id={`inv-line-${index}-quantity`}
												label={lineLabels.quantity}
												required
												error={errorOf(`items.${index}.quantity`)}
											>
												<Input
													id={`inv-line-${index}-quantity`}
													type='number'
													inputMode='decimal'
													min={0}
													step='0.001'
													value={line.quantity}
													aria-invalid={Boolean(errorOf(`items.${index}.quantity`)) || undefined}
													onChange={(event) => setLine(line.key, { quantity: event.target.value })}
												/>
											</FormField>
											<FormField
												id={`inv-line-${index}-unitPrice`}
												label={lineLabels.unitPrice}
												required
												description={t('sales:freeInvoice.lineUnitPriceHelp')}
												error={errorOf(`items.${index}.unitPrice`)}
											>
												<MoneyInput
													id={`inv-line-${index}-unitPrice`}
													value={line.unitPrice}
													aria-invalid={Boolean(errorOf(`items.${index}.unitPrice`)) || undefined}
													onValueChange={(next) => setLine(line.key, { unitPrice: next })}
												/>
											</FormField>
										</div>
										<p className='text-right text-sm text-muted-foreground'>
											{t('sales:freeInvoice.lineTotal')}: <span className='font-medium text-foreground'>{formatIdr(amounts[index]!.base)}</span>
										</p>
									</div>
								))}
							</div>
							<div>
								<Button type='button' variant='outline' size='sm' onClick={() => setLines((current) => [...current, newLine()])}>
									<Plus aria-hidden='true' />
									{t('sales:freeInvoice.addLine')}
								</Button>
							</div>
							<dl className='ml-auto grid w-full max-w-xs grid-cols-2 gap-1 text-sm'>
								<dt className='text-muted-foreground'>{t('sales:freeInvoice.subtotal')}</dt>
								<dd className='text-right'>{formatIdr(subtotal)}</dd>
								<dt className='text-muted-foreground'>{t('sales:freeInvoice.vatAmount')}</dt>
								<dd className='text-right'>{formatIdr(vatTotal)}</dd>
								<dt className='font-semibold'>{t('sales:freeInvoice.total')}</dt>
								<dd className='text-right font-semibold'>{formatIdr(subtotal + vatTotal)}</dd>
							</dl>
						</section>

						<FormField id={CONTROL_IDS.notes} label={labels.notes} optional>
							<Textarea id={CONTROL_IDS.notes} rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
						</FormField>
						<p className='text-sm text-muted-foreground'>{t('sales:freeInvoice.draftHint')}</p>
						<div className='flex justify-end'>
							<Button type='submit' disabled={mutation.isPending}>
								{mutation.isPending ? t('common:action.saving') : t('sales:freeInvoice.submit')}
							</Button>
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
