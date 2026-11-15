import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { formatIdr, minorToRupiah, rupiahToMinor, todayBusinessDate } from '@/lib/format';
import {
	requestableItemsQueryOptions,
	type TPurchaseRequestDetail,
	type TPurchaseRequestInput,
	type TRequestableItem,
} from '@/lib/procurement-api';

type TLineDraft = {
	key: string;
	/** Empty for a free-text line. */
	itemId: string;
	sku: string;
	name: string;
	unit: string;
	quantity: string;
	price: string;
	specification: string;
	notes: string;
};

const blankText = (): TLineDraft => ({
	key: crypto.randomUUID(),
	itemId: '',
	sku: '',
	name: '',
	unit: '',
	quantity: '1',
	price: '',
	specification: '',
	notes: '',
});

/**
 * Create/edit form for a purchase request: items of the master or free text
 * (name + unit) that purchasing maps to an item on the purchase order.
 * Estimates are a preview; the server recomputes them.
 */
export function PurchaseRequestForm({
	request,
	submitting,
	onSubmit,
	onCancel,
}: {
	request: TPurchaseRequestDetail | null;
	submitting: boolean;
	onSubmit: (input: TPurchaseRequestInput) => void;
	onCancel: () => void;
}) {
	const { t } = useTranslation(['procurement', 'common']);
	const [subject, setSubject] = useState(request?.subject ?? '');
	const [justification, setJustification] = useState(request?.justification ?? '');
	const [projectName, setProjectName] = useState(request?.projectName ?? '');
	const [requestDate, setRequestDate] = useState(request?.requestDate ?? todayBusinessDate());
	const [neededBy, setNeededBy] = useState(request?.neededBy ?? '');
	const [lines, setLines] = useState<TLineDraft[]>(
		(request?.lines ?? []).map((line) => ({
			key: crypto.randomUUID(),
			itemId: line.itemId ?? '',
			sku: line.sku ?? '',
			name: line.name,
			unit: line.unit,
			quantity: String(Number(line.quantity)),
			price: minorToRupiah(line.estimatedUnitPrice),
			specification: line.specification ?? '',
			notes: line.notes ?? '',
		})),
	);
	const [itemSearch, setItemSearch] = useState('');
	const deferredItem = useDeferredValue(itemSearch.trim());
	// Requesters hold no `product:read`: the request module serves the search.
	const items = useQuery(requestableItemsQueryOptions(deferredItem));

	const lineTotals = lines.map((line) =>
		Math.round((Math.round(Number(line.quantity || '0') * 1000) * rupiahToMinor(line.price || '0')) / 1000),
	);
	const total = lineTotals.reduce((sum, value) => sum + value, 0);
	const patch = (key: string, value: Partial<TLineDraft>) =>
		setLines((current) => current.map((line) => (line.key === key ? { ...line, ...value } : line)));

	function addItem(item: TRequestableItem) {
		setLines((current) => [
			...current,
			{
				key: crypto.randomUUID(),
				itemId: item.id,
				sku: item.sku,
				name: item.name,
				unit: item.unitLabel,
				quantity: '1',
				price: minorToRupiah(item.purchasePrice),
				specification: item.specification ?? '',
				notes: '',
			},
		]);
		setItemSearch('');
	}

	const text = (value: string) => value.trim() || null;

	return (
		<form
			className='flex flex-col gap-6'
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit({
					subject: subject.trim(),
					justification: text(justification),
					projectName: text(projectName),
					requestDate,
					neededBy: neededBy || null,
					lines: lines.map((line) => ({
						itemId: line.itemId || null,
						name: line.itemId ? null : text(line.name),
						unit: line.itemId ? null : text(line.unit),
						quantity: line.quantity,
						estimatedUnitPrice: line.price.trim() === '' ? null : rupiahToMinor(line.price),
						specification: text(line.specification),
						notes: text(line.notes),
					})),
				});
			}}
		>
			<Card>
				<CardHeader>
					<CardTitle>{t('procurement:pr.header')}</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='pr-subject'>{t('procurement:pr.subject')}</FieldLabel>
							<Input id='pr-subject' required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} />
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='pr-justification'>{t('procurement:pr.justification')}</FieldLabel>
							<Textarea
								id='pr-justification'
								rows={3}
								maxLength={4000}
								value={justification}
								onChange={(event) => setJustification(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='pr-project'>{t('procurement:po.projectName')}</FieldLabel>
							<Input id='pr-project' maxLength={200} value={projectName} onChange={(event) => setProjectName(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='pr-date'>{t('procurement:pr.requestDate')}</FieldLabel>
							<DatePicker id='pr-date' required value={requestDate} onChange={setRequestDate} />
						</Field>
						<Field>
							<FieldLabel htmlFor='pr-needed-by'>{t('procurement:pr.neededBy')}</FieldLabel>
							<DatePicker id='pr-needed-by' min={requestDate} value={neededBy} onChange={setNeededBy} />
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('procurement:pr.lines')}</CardTitle>
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					{lines.map((line, index) => (
						<div key={line.key} className='grid gap-3 rounded-md border p-3 sm:grid-cols-6'>
							<div className='flex items-center justify-between sm:col-span-6'>
								<span className='text-sm font-medium'>
									{index + 1}. {line.itemId ? `${line.name} · ${line.sku}` : t('procurement:pr.freeText')}
								</span>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}
								>
									{t('procurement:po.removeLine')}
								</Button>
							</div>
							{!line.itemId && (
								<>
									<Field className='sm:col-span-4'>
										<FieldLabel htmlFor={`pr-name-${line.key}`}>{t('procurement:pr.itemName')}</FieldLabel>
										<Input
											id={`pr-name-${line.key}`}
											required
											maxLength={300}
											value={line.name}
											onChange={(event) => patch(line.key, { name: event.target.value })}
										/>
									</Field>
									<Field className='sm:col-span-2'>
										<FieldLabel htmlFor={`pr-unit-${line.key}`}>{t('procurement:pr.unit')}</FieldLabel>
										<Input
											id={`pr-unit-${line.key}`}
											required
											maxLength={32}
											placeholder='pcs'
											value={line.unit}
											onChange={(event) => patch(line.key, { unit: event.target.value })}
										/>
									</Field>
								</>
							)}
							<Field className='sm:col-span-6'>
								<FieldLabel htmlFor={`pr-spec-${line.key}`}>{t('procurement:po.specification')}</FieldLabel>
								<Textarea
									id={`pr-spec-${line.key}`}
									rows={2}
									maxLength={4000}
									value={line.specification}
									onChange={(event) => patch(line.key, { specification: event.target.value })}
								/>
							</Field>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor={`pr-qty-${line.key}`}>
									{t('procurement:po.quantity')}
									{line.unit ? ` (${line.unit})` : ''}
								</FieldLabel>
								<Input
									id={`pr-qty-${line.key}`}
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
								<FieldLabel htmlFor={`pr-price-${line.key}`}>{t('procurement:pr.estimatedUnitPrice')}</FieldLabel>
								<Input
									id={`pr-price-${line.key}`}
									type='number'
									min='0'
									step='0.01'
									inputMode='decimal'
									value={line.price}
									onChange={(event) => patch(line.key, { price: event.target.value })}
								/>
							</Field>
							<div className='flex flex-col justify-end text-right text-sm sm:col-span-2'>
								<span className='text-muted-foreground'>{t('procurement:pr.estimatedTotal')}</span>
								<span className='font-medium'>{formatIdr(lineTotals[index] ?? 0)}</span>
							</div>
							<Field className='sm:col-span-6'>
								<FieldLabel htmlFor={`pr-notes-${line.key}`}>{t('procurement:po.notes')}</FieldLabel>
								<Input
									id={`pr-notes-${line.key}`}
									maxLength={1000}
									value={line.notes}
									onChange={(event) => patch(line.key, { notes: event.target.value })}
								/>
							</Field>
						</div>
					))}
					<div className='flex flex-col gap-2 rounded-md border border-dashed p-3'>
						<FieldLabel htmlFor='pr-item-search'>{t('procurement:po.addItem')}</FieldLabel>
						<Input
							id='pr-item-search'
							type='search'
							placeholder={t('procurement:po.itemSearchHint')}
							value={itemSearch}
							onChange={(event) => setItemSearch(event.target.value)}
						/>
						{deferredItem !== '' && (
							<ul className='flex max-h-56 flex-col overflow-y-auto rounded-md border'>
								{(items.data ?? []).map((item) => (
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
						<div>
							<Button type='button' variant='outline' size='sm' onClick={() => setLines((current) => [...current, blankText()])}>
								{t('procurement:pr.addFreeText')}
							</Button>
						</div>
						<FieldDescription>{t('procurement:pr.freeTextHint')}</FieldDescription>
					</div>
					<div className='flex justify-end text-base font-bold'>
						{t('procurement:pr.estimatedTotal')}: {formatIdr(total)}
					</div>
				</CardContent>
			</Card>

			<div className='flex justify-end gap-2'>
				<Button type='button' variant='outline' onClick={onCancel}>
					{t('common:action.cancel')}
				</Button>
				<Button type='submit' disabled={submitting || lines.length === 0}>
					{t('common:action.save')}
				</Button>
			</div>
		</form>
	);
}
