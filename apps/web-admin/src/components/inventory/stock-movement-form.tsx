import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { FieldGroup } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { NativeSelect, NativeSelectOption } from '@ims-erp/ui/components/native-select';
import { Textarea } from '@ims-erp/ui/components/textarea';

import { RequiredLegend } from '@/components/form/field-label';
import { FormErrorSummary } from '@/components/form/form-error-summary';
import { FormField } from '@/components/form/form-field';
import { useIssueText } from '@/components/form/use-issue-text';
import { SearchableSelect } from '@/components/inventory/searchable-select';
import { toast } from '@/components/toast';
import { ApiError } from '@/lib/api-error';
import { focusControl, serverIssues, type TFieldIssue, type TFieldIssues } from '@/lib/form-validation';
import { productsQueryOptions, type TProduct } from '@/lib/inventory-api';
import {
	issueStock,
	parseSerialLines,
	receiveStock,
	stockProjectOptionsQueryOptions,
	warehouseSerialsQueryOptions,
} from '@/lib/stock-api';
import { linkedWarehousesQueryOptions } from '@/lib/warehouse-api';

/** Control ids in on-screen order (focus and error summary, RF-16). */
const CONTROL_IDS = {
	warehouseId: 'sm-warehouse',
	binId: 'sm-bin',
	productId: 'sm-product',
	quantity: 'sm-quantity',
	projectId: 'sm-project',
	serialNumbers: 'sm-serials',
	notes: 'sm-notes',
} as const;
type TField = keyof typeof CONTROL_IDS;
const FIELD_ORDER = Object.keys(CONTROL_IDS) as TField[];
const NO_BIN = '__none__';

/**
 * Shared form of the manual stock screens (B-29, KF-G1): warehouse, storage,
 * item, quantity, project, serial numbers and notes.
 *
 * @remarks
 * - `issue` takes stock out (project material or own use); `receipt` brings
 *   it in outside a purchase order (material back from site, own stock).
 * - A serialized item is counted by its serial numbers: an issue picks
 *   `in_stock` units of the warehouse, a receipt lists one serial per line
 *   (units issued earlier can be clicked in).
 * - Errors follow the P7-6 pattern: the rule is shown before typing (RF-31),
 *   the server's refusal lands under its field or in the summary (RF-17).
 */
export function StockMovementForm({ kind }: { kind: 'receipt' | 'issue' }) {
	const { t } = useTranslation(['inventory', 'common']);
	const issueText = useIssueText();
	const queryClient = useQueryClient();

	const [warehouseId, setWarehouseId] = useState('');
	const [binId, setBinId] = useState('');
	const [product, setProduct] = useState<TProduct | null>(null);
	const [quantity, setQuantity] = useState('');
	const [projectId, setProjectId] = useState('');
	const [chosenSerials, setChosenSerials] = useState<string[]>([]);
	const [serialText, setSerialText] = useState('');
	const [notes, setNotes] = useState('');
	const [submitted, setSubmitted] = useState(false);
	const [server, setServer] = useState<TFieldIssues>({});
	const [formMessage, setFormMessage] = useState<string | null>(null);

	const warehouses = useQuery(linkedWarehousesQueryOptions());
	const [productTerm, setProductTerm] = useState('');
	const products = useQuery(productsQueryOptions({ search: productTerm || undefined, activeOnly: true }));
	const [projectTerm, setProjectTerm] = useState('');
	const projects = useQuery({ ...stockProjectOptionsQueryOptions(projectTerm), enabled: kind === 'issue' || kind === 'receipt' });
	const serialized = product?.isSerialized ?? false;
	const serialPool = useQuery({
		...warehouseSerialsQueryOptions(product?.id ?? '', warehouseId, kind === 'issue' ? 'in_stock' : 'issued'),
		enabled: serialized && warehouseId !== '',
	});

	const warehouseRows = warehouses.data ?? [];
	const storages = (warehouseRows.find((row) => row.id === warehouseId)?.storages ?? []).filter(
		(storage) => storage.isActive && storage.deletedAt === null,
	);
	const serials = kind === 'issue' ? chosenSerials : parseSerialLines(serialText);
	const effectiveQuantity = serialized ? serials.length : Number(quantity);

	const labels: Record<TField, string> = {
		warehouseId: t('inventory:manualStock.warehouse'),
		binId: t('inventory:manualStock.bin'),
		productId: t('inventory:manualStock.product'),
		quantity: t('inventory:manualStock.quantity'),
		projectId: t('inventory:manualStock.project'),
		serialNumbers: t('inventory:manualStock.serials'),
		notes: t('inventory:manualStock.notes'),
	};

	/** The checks the screen can make before sending (the server re-checks). */
	function localIssues(): TFieldIssues {
		const issues: TFieldIssues = {};
		if (!warehouseId) issues.warehouseId = { key: 'required' };
		if (!product) issues.productId = { key: 'required' };
		if (serialized) {
			if (serials.length === 0) issues.serialNumbers = { key: 'required' };
		} else if (!quantity) issues.quantity = { key: 'required' };
		else if (!(Number(quantity) > 0)) issues.quantity = { key: 'min', params: { min: 0.001 } };
		return issues;
	}

	const mutation = useMutation({
		mutationFn: () => {
			const input = {
				warehouseId,
				binId: binId || null,
				productId: product!.id,
				quantity: effectiveQuantity,
				projectId: projectId || null,
				serialNumbers: serialized ? serials : undefined,
				notes: notes.trim() || null,
			};
			return kind === 'issue' ? issueStock(input) : receiveStock(input);
		},
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({ queryKey: ['stock'] });
			toast.success(
				kind === 'issue'
					? t('inventory:manualStock.issuedDone', { code: result?.movement.code ?? '' })
					: t('inventory:manualStock.receivedDone', { code: result?.movement.code ?? '' }),
			);
			// Keep warehouse and project for the next line; clear the item.
			setProduct(null);
			setQuantity('');
			setChosenSerials([]);
			setSerialText('');
			setNotes('');
			setSubmitted(false);
		},
		onError: (cause) => {
			const error = cause instanceof ApiError ? cause : null;
			const fieldIssues = error ? serverIssues(error) : {};
			setServer(fieldIssues);
			if (error?.isNetworkError) setFormMessage(t('common:form.networkError'));
			else if (error?.ref) setFormMessage(t('common:form.serverError', { ref: error.ref }));
			else setFormMessage(error?.message ?? (cause instanceof Error ? cause.message : t('common:error.failed')));
			const first = FIELD_ORDER.find((field) => fieldIssues[field]);
			if (first) focusControl(CONTROL_IDS[first]);
		},
	});

	const local = submitted ? localIssues() : {};
	const issueOf = (field: TField): TFieldIssue | undefined => server[field] ?? local[field];
	const errorOf = (field: TField) => issueText(issueOf(field), labels[field]);
	const summary = FIELD_ORDER.filter((field) => issueOf(field)).map((field) => ({
		id: CONTROL_IDS[field],
		text: errorOf(field) ?? '',
	}));

	const onProductSearch = useCallback((next: string) => setProductTerm(next), []);
	const onProjectSearch = useCallback((next: string) => setProjectTerm(next), []);
	const productRows = products.data?.rows ?? [];
	const productOptions = productRows.map((row) => ({ value: row.id, label: `${row.sku} — ${row.name}` }));
	if (product && !productRows.some((row) => row.id === product.id)) {
		productOptions.unshift({ value: product.id, label: `${product.sku} — ${product.name}` });
	}
	const projectOptions = (projects.data ?? []).map((row) => ({
		value: row.id,
		label: `${row.code} — ${row.title} (${row.customerName})`,
	}));

	return (
		<Card className='max-w-3xl'>
			<CardHeader>
				<CardTitle>{kind === 'issue' ? t('inventory:manualStock.issueFormTitle') : t('inventory:manualStock.receiptFormTitle')}</CardTitle>
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
						const first = FIELD_ORDER.find((field) => issues[field]);
						if (first) {
							focusControl(CONTROL_IDS[first]);
							return;
						}
						mutation.mutate();
					}}
				>
					<FieldGroup>
						<FormErrorSummary items={summary} formMessage={formMessage} />
						<div className='grid gap-4 sm:grid-cols-2'>
							<FormField id={CONTROL_IDS.warehouseId} label={labels.warehouseId} required error={errorOf('warehouseId')}>
								<NativeSelect
									id={CONTROL_IDS.warehouseId}
									className='w-full'
									value={warehouseId}
									aria-invalid={Boolean(errorOf('warehouseId')) || undefined}
									onChange={(event) => {
										setWarehouseId(event.target.value);
										setBinId('');
										setChosenSerials([]);
									}}
								>
									<NativeSelectOption value=''>{t('inventory:manualStock.pickWarehouse')}</NativeSelectOption>
									{warehouseRows.map((row) => (
										<NativeSelectOption key={row.id} value={row.id}>
											{row.code} — {row.name}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</FormField>
							<FormField id={CONTROL_IDS.binId} label={labels.binId} optional description={t('inventory:manualStock.binHelp')}>
								<NativeSelect
									id={CONTROL_IDS.binId}
									className='w-full'
									value={binId || NO_BIN}
									disabled={storages.length === 0}
									onChange={(event) => setBinId(event.target.value === NO_BIN ? '' : event.target.value)}
								>
									<NativeSelectOption value={NO_BIN}>{t('inventory:manualStock.noBin')}</NativeSelectOption>
									{storages.map((storage) => (
										<NativeSelectOption key={storage.id} value={storage.id}>
											{storage.code} — {storage.name}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</FormField>
						</div>
						<FormField id={CONTROL_IDS.productId} label={labels.productId} required error={errorOf('productId')}>
							<SearchableSelect
								id={CONTROL_IDS.productId}
								value={product?.id ?? null}
								options={productOptions}
								loading={products.isFetching}
								placeholder={t('inventory:manualStock.searchProduct')}
								emptyLabel={t('common:state.noResults')}
								onSearch={onProductSearch}
								onChange={(next) => {
									setProduct(productRows.find((row) => row.id === next) ?? null);
									setChosenSerials([]);
									setSerialText('');
								}}
							/>
						</FormField>
						<div className='grid gap-4 sm:grid-cols-2'>
							<FormField
								id={CONTROL_IDS.quantity}
								label={product ? `${labels.quantity} (${product.unitLabel})` : labels.quantity}
								required={!serialized}
								description={t('inventory:manualStock.quantityHelp')}
								error={errorOf('quantity')}
							>
								<Input
									id={CONTROL_IDS.quantity}
									type='number'
									inputMode='decimal'
									min={0}
									step='0.001'
									disabled={serialized}
									value={serialized ? String(serials.length) : quantity}
									aria-invalid={Boolean(errorOf('quantity')) || undefined}
									onChange={(event) => setQuantity(event.target.value)}
								/>
							</FormField>
							<FormField
								id={CONTROL_IDS.projectId}
								label={labels.projectId}
								optional
								description={kind === 'issue' ? t('inventory:manualStock.projectHelpIssue') : t('inventory:manualStock.projectHelpReceipt')}
								error={errorOf('projectId')}
							>
								<SearchableSelect
									id={CONTROL_IDS.projectId}
									value={projectId || null}
									options={projectOptions}
									loading={projects.isFetching}
									placeholder={t('inventory:manualStock.searchProject')}
									emptyLabel={t('inventory:manualStock.noProjects')}
									onSearch={onProjectSearch}
									onChange={(next) => setProjectId(next ?? '')}
								/>
							</FormField>
						</div>
						{serialized && (
							<FormField
								id={CONTROL_IDS.serialNumbers}
								label={labels.serialNumbers}
								required
								description={kind === 'issue' ? t('inventory:manualStock.serialsHelpIssue') : t('inventory:manualStock.serialsHelpReceipt')}
								error={errorOf('serialNumbers')}
							>
								{kind === 'issue' ? (
									<div id={CONTROL_IDS.serialNumbers} tabIndex={-1} className='flex flex-col gap-2 rounded-md border p-3'>
										{!warehouseId ? (
											<p className='text-sm text-muted-foreground'>{t('inventory:manualStock.pickWarehouseFirst')}</p>
										) : (serialPool.data ?? []).length === 0 ? (
											<p className='text-sm text-muted-foreground'>{t('inventory:manualStock.noSerialsInStock')}</p>
										) : (
											(serialPool.data ?? []).map((serial) => (
												<label key={serial} className='flex items-center gap-2 text-sm'>
													<Checkbox
														checked={chosenSerials.includes(serial)}
														onCheckedChange={(checked) =>
															setChosenSerials((current) =>
																checked ? [...current, serial] : current.filter((value) => value !== serial),
															)
														}
													/>
													<span className='font-mono'>{serial}</span>
												</label>
											))
										)}
									</div>
								) : (
									<div className='flex flex-col gap-2'>
										<Textarea
											id={CONTROL_IDS.serialNumbers}
											rows={4}
											className='font-mono'
											value={serialText}
											aria-invalid={Boolean(errorOf('serialNumbers')) || undefined}
											onChange={(event) => setSerialText(event.target.value)}
										/>
										{(serialPool.data ?? []).length > 0 && (
											<div className='flex flex-wrap items-center gap-2 text-sm'>
												<span className='text-muted-foreground'>{t('inventory:manualStock.serialsIssued')}</span>
												{(serialPool.data ?? []).map((serial) => (
													<Button
														key={serial}
														type='button'
														size='sm'
														variant='outline'
														className='font-mono'
														onClick={() => setSerialText((text) => [...parseSerialLines(text), serial].join('\n'))}
													>
														{serial}
													</Button>
												))}
											</div>
										)}
									</div>
								)}
							</FormField>
						)}
						<FormField id={CONTROL_IDS.notes} label={labels.notes} optional>
							<Textarea id={CONTROL_IDS.notes} rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
						</FormField>
						<div className='flex flex-wrap items-center justify-end gap-2'>
							<Button
								type='button'
								variant='outline'
								render={<Link to='/inventory/stock/movements' />}
								nativeButton={false}
							>
								{t('inventory:manualStock.viewMovements')}
							</Button>
							<Button type='submit' disabled={mutation.isPending}>
								{mutation.isPending
									? t('common:action.saving')
									: kind === 'issue'
										? t('inventory:manualStock.submitIssue')
										: t('inventory:manualStock.submitReceipt')}
							</Button>
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
