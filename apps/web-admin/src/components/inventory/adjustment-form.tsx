import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Field,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { NativeSelect } from '@ims-erp/ui/components/native-select';
import {
	createAdjustment,
	type TAdjustmentLineInput,
	type TAdjustmentType,
} from '@/lib/adjustment-api';
import { itemsQueryOptions } from '@/lib/inventory-api';
import { balancesQueryOptions } from '@/lib/stock-api';
import { linkedWarehousesQueryOptions } from '@/lib/warehouse-api';

/** One editable line row. `key` is React's, so removing a row cannot reuse state. */
type TLineDraft = {
	key: number;
	itemId: string;
	/** Optional storage bin; the balance is tracked per bin when set. */
	binId: string;
	/** Counted total as typed; empty means "not entered yet". */
	quantityAfter: string;
	note: string;
};

let nextKey = 1;
const blankLine = (): TLineDraft => ({
	key: nextKey++,
	itemId: '',
	binId: '',
	quantityAfter: '',
	note: '',
});

/**
 * The adjustment create form.
 *
 * @remarks
 * Each line takes a **counted total**, not a difference — the same asymmetry the
 * backend enforces (`quantity_before` is snapshotted server-side, direction is
 * derived from the difference). Asking for a delta here would let a typo of one
 * sign flip the movement, so the form deliberately cannot express one.
 *
 * The document is always created in `draft`: creating it does not move stock,
 * so the form has no "post" action. Posting happens from the list, after
 * approval, by someone holding the post permission.
 */
export function AdjustmentForm() {
	const { t } = useTranslation(['inventory', 'common']);
	const queryClient = useQueryClient();

	const [warehouseId, setWarehouseId] = useState('');
	const [adjustmentType, setAdjustmentType] =
		useState<TAdjustmentType>('recount');
	const [reasonCode, setReasonCode] = useState('');
	const [notes, setNotes] = useState('');
	const [lines, setLines] = useState<TLineDraft[]>([blankLine()]);

	const warehouses = useQuery(linkedWarehousesQueryOptions());
	const items = useQuery(itemsQueryOptions({}));
	// The system's belief, so the counter sees what they are counting against.
	// Only meaningful once a warehouse is chosen: a balance is per warehouse.
	const balances = useQuery({
		...balancesQueryOptions({
			limit: 100,
			...(warehouseId === '' ? {} : { warehouseId }),
		}),
		enabled: warehouseId !== '',
	});

	const creation = useMutation({
		mutationFn: (payload: {
			warehouseId: string;
			adjustmentType: TAdjustmentType;
			reasonCode: string | null;
			notes: string | null;
			lines: TAdjustmentLineInput[];
		}) => createAdjustment(payload),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['stock'] });
			// Creating a draft does not move stock, so the balance queries are
			// untouched; resetting the form is all that is left.
			setLines([blankLine()]);
			setNotes('');
			setReasonCode('');
		},
	});

	function updateLine(key: number, patch: Partial<TLineDraft>) {
		setLines((current) =>
			current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
		);
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!warehouseId) return;

		// Rows the user added but never filled are dropped rather than rejected:
		// an empty trailing row is a UI affordance, not a mistake.
		const payloadLines = lines
			.filter((line) => line.itemId !== '' && line.quantityAfter !== '')
			.map((line) => ({
				itemId: line.itemId,
				binId: line.binId === '' ? null : line.binId,
				quantityAfter: Number(line.quantityAfter),
				note: line.note === '' ? null : line.note,
			}));

		if (payloadLines.length === 0) return;

		creation.mutate({
			warehouseId,
			adjustmentType,
			reasonCode: reasonCode === '' ? null : reasonCode,
			notes: notes === '' ? null : notes,
			lines: payloadLines,
		});
	}

	const warehouseRows = warehouses.data ?? [];
	const itemRows = items.data?.rows ?? [];
	const balanceRows = balances.data?.rows ?? [];

	/** The system's on-hand for an item in the chosen warehouse, or `null`. */
	function systemQuantity(itemId: string, binId: string): string | null {
		if (itemId === '') return null;
		const match = balanceRows.find(
			(row) =>
				row.itemId === itemId && row.binId === (binId === '' ? null : binId),
		);
		return match?.quantityOnHand ?? '0';
	}

	/**
	 * Renders the counted-minus-system difference for one line.
	 *
	 * @remarks
	 * Shown, never submitted: the backend snapshots `quantity_before` and derives
	 * the direction itself, so this is a preview of what posting would do. A
	 * zero difference posts nothing, which is valid — says so rather than
	 * showing a bare `+0`.
	 */
	function differenceLabel(line: TLineDraft): string {
		const system = systemQuantity(line.itemId, line.binId);
		if (system === null || line.quantityAfter === '') return '—';
		const delta = Number(line.quantityAfter) - Number(system);
		if (delta === 0) return '0';
		return `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`;
	}
	const canSubmit =
		warehouseId !== '' &&
		lines.some((line) => line.itemId !== '' && line.quantityAfter !== '');

	return (
		<form onSubmit={handleSubmit} className='space-y-4'>
			<div>
				<h1 className='text-2xl font-semibold'>
					{t('inventory:adjustmentForm.new')}
				</h1>
				<p className='text-sm text-muted-foreground'>
					{t('inventory:adjustmentForm.newDescription')}
				</p>
			</div>

			<Card>
				<CardContent className='pt-6'>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='adjustment-warehouse'>
								{t('inventory:adjustmentForm.warehouse')}
							</FieldLabel>
							<NativeSelect
								id='adjustment-warehouse'
								value={warehouseId}
								required
								onChange={(event) => setWarehouseId(event.target.value)}
							>
								<option value='' />
								{warehouseRows.map((warehouse) => (
									<option key={warehouse.id} value={warehouse.id}>
										{warehouse.code} — {warehouse.name}
									</option>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel htmlFor='adjustment-type'>
								{t('inventory:adjustmentForm.type')}
							</FieldLabel>
							<NativeSelect
								id='adjustment-type'
								value={adjustmentType}
								onChange={(event) =>
									setAdjustmentType(event.target.value as TAdjustmentType)
								}
							>
								<option value='recount'>
									{t('inventory:adjustments.type.recount')}
								</option>
								<option value='increase'>
									{t('inventory:adjustments.type.increase')}
								</option>
								<option value='decrease'>
									{t('inventory:adjustments.type.decrease')}
								</option>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel htmlFor='adjustment-reason'>
								{t('inventory:adjustmentForm.reasonCode')}
							</FieldLabel>
							<Input
								id='adjustment-reason'
								value={reasonCode}
								onChange={(event) => setReasonCode(event.target.value)}
								maxLength={64}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='adjustment-notes'>
								{t('inventory:adjustmentForm.notes')}
							</FieldLabel>
							<Input
								id='adjustment-notes'
								value={notes}
								onChange={(event) => setNotes(event.target.value)}
								maxLength={2000}
							/>
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('inventory:adjustmentForm.lines')}</CardTitle>
					<CardDescription>
						{t('inventory:adjustmentForm.linesDescription')}
					</CardDescription>
				</CardHeader>
				<CardContent className='space-y-3'>
					{lines.map((line, index) => (
						<div
							key={line.key}
							className='grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_2fr_auto]'
						>
							<Field>
								<FieldLabel htmlFor={`line-item-${line.key}`}>
									{t('inventory:adjustmentForm.item')}
								</FieldLabel>
								<NativeSelect
									id={`line-item-${line.key}`}
									value={line.itemId}
									onChange={(event) =>
										updateLine(line.key, { itemId: event.target.value })
									}
								>
									<option value='' />
									{itemRows.map((item) => (
										<option key={item.id} value={item.id}>
											{item.sku} — {item.name}
										</option>
									))}
								</NativeSelect>
							</Field>
							<Field>
								<FieldLabel htmlFor={`line-bin-${line.key}`}>
									{t('inventory:adjustmentForm.bin')}
								</FieldLabel>
								<Input
									id={`line-bin-${line.key}`}
									value={line.binId}
									onChange={(event) =>
										updateLine(line.key, { binId: event.target.value })
									}
									placeholder={t('inventory:stock.noBin')}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={`line-system-${line.key}`}>
									{t('inventory:adjustmentForm.systemQuantity')}
								</FieldLabel>
								{/*
								 * Read-only: the system quantity is whatever the
								 * ledger says. Editable here would let the
								 * counter change the baseline they are being
								 * judged against.
								 */}
								<Input
									id={`line-system-${line.key}`}
									value={systemQuantity(line.itemId, line.binId) ?? '—'}
									readOnly
									className='bg-muted'
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={`line-qty-${line.key}`}>
									{t('inventory:adjustmentForm.countedQuantity')}
								</FieldLabel>
								<Input
									id={`line-qty-${line.key}`}
									type='number'
									min={0}
									step='0.001'
									value={line.quantityAfter}
									onChange={(event) =>
										updateLine(line.key, { quantityAfter: event.target.value })
									}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={`line-diff-${line.key}`}>
									{t('inventory:adjustmentForm.difference')}
								</FieldLabel>
								{/*
								 * Derived, never submitted: the backend recomputes
								 * it from the counted total so a client cannot
								 * disagree about the direction of the movement.
								 */}
								<Input
									id={`line-diff-${line.key}`}
									value={differenceLabel(line)}
									readOnly
									className='bg-muted'
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={`line-note-${line.key}`}>
									{t('inventory:adjustmentForm.lineNote')}
								</FieldLabel>
								<Input
									id={`line-note-${line.key}`}
									value={line.note}
									onChange={(event) =>
										updateLine(line.key, { note: event.target.value })
									}
									maxLength={1000}
								/>
							</Field>
							<Button
								type='button'
								variant='ghost'
								size='sm'
								disabled={lines.length === 1}
								onClick={() =>
									setLines((current) =>
										current.filter((_, position) => position !== index),
									)
								}
							>
								{t('inventory:adjustmentForm.removeLine')}
							</Button>
						</div>
					))}

					<Button
						type='button'
						variant='outline'
						size='sm'
						onClick={() => setLines((current) => [...current, blankLine()])}
					>
						{t('inventory:adjustmentForm.addLine')}
					</Button>
				</CardContent>
			</Card>

			{creation.isError ? (
				<p className='text-sm text-destructive'>{creation.error.message}</p>
			) : null}
			{creation.isSuccess ? (
				<p className='text-sm text-muted-foreground'>
					{t('inventory:adjustmentForm.created')}
				</p>
			) : null}

			<div className='flex justify-end gap-2'>
				<Button type='submit' disabled={!canSubmit || creation.isPending}>
					{creation.isPending
						? t('inventory:adjustmentForm.creating')
						: t('inventory:adjustmentForm.create')}
				</Button>
			</div>

			{lines.every((line) => line.itemId === '') ? (
				<p className='text-xs text-muted-foreground'>
					{t('inventory:adjustmentForm.emptyLines')}
				</p>
			) : null}
		</form>
	);
}
