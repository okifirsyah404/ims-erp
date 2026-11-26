import { MoneyInput } from '@/components/money-input';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Ban, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	formatBusinessDate,
	formatIdr,
	todayBusinessDate,
} from '@/lib/format';
import {
	addCost,
	COST_CATEGORIES,
	COST_PAYMENT_SOURCES,
	type TCostPaymentSource,
	type TCostCategory,
	type TProjectCost,
	type TProjectDetail,
	voidCost,
} from '@/lib/project-api';
import { usePermission } from '@/lib/use-permission';

/**
 * Direct costs (only rendered when the server returned them, i.e. with
 * `project:read_cost`), the material value shipped by the order's delivery
 * notes, and the total against the contract value.
 */
export function ProjectCostsCard({ project }: { project: TProjectDetail & { costs: NonNullable<TProjectDetail['costs']> } }) {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const queryClient = useQueryClient();
	const canRecord = usePermission('project.update');
	const active = project.status === 'active';
	const costs = project.costs;
	const receiptRef = useRef<HTMLInputElement>(null);
	const [category, setCategory] = useState<TCostCategory>('transport');
	const [costDate, setCostDate] = useState(todayBusinessDate());
	const [amount, setAmount] = useState('');
	const [description, setDescription] = useState('');
	const [receipt, setReceipt] = useState<File | null>(null);
	const [paymentSource, setPaymentSource] = useState<TCostPaymentSource>('employee_claim');
	const [reference, setReference] = useState('');
	// ERP-0141: a reference already used by a live cost of this project is probably a double entry.
	const duplicateReference =
		reference.trim() !== '' &&
		costs.entries.some((cost) => !cost.voidedAt && cost.reference?.trim().toLowerCase() === reference.trim().toLowerCase());
	const [busy, setBusy] = useState(false);

	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['projects'] });
			toast.success(done);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};
	const margin = costs.contractValue - costs.total;

	const columns = useMemo<ColumnDef<DataTableFeatures, TProjectCost, CellData>[]>(
		() => [
			{
				id: 'date',
				accessorFn: (cost) => cost.costDate,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('projects:costs.date')} />
				),
				cell: ({ row }) => formatBusinessDate(row.original.costDate, i18n.language),
			},
			{
				id: 'category',
				accessorFn: (cost) => t(`projects:costCategory.${cost.category}`),
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('projects:costs.category')} />
				),
				cell: ({ row }) => t(`projects:costCategory.${row.original.category}`),
			},
			{
				id: 'description',
				accessorFn: (cost) => cost.description,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('projects:costs.description')} />
				),
				cell: ({ row }) => (
					<>
						{row.original.description}
						{row.original.voidReason && (
							<div className='text-xs no-underline'>{row.original.voidReason}</div>
						)}
					</>
				),
			},
			{
				id: 'amount',
				accessorFn: (cost) => cost.amount,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('projects:costs.amount')} />
				),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.amount),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('common:action.actions')}
						disabled={busy}
						actions={[
							{
								key: 'view',
								label: t('projects:costs.view'),
								icon: ExternalLink,
								hidden: !row.original.receiptUrl,
								onSelect: () =>
									window.open(row.original.receiptUrl!, '_blank', 'noopener,noreferrer'),
							},
							{
								key: 'void',
								label: t('projects:costs.void'),
								icon: Ban,
								destructive: true,
								hidden: !(active && canRecord && !row.original.voidedAt),
								onSelect: () => {
									const reason = window.prompt(t('projects:costs.voidReason'));
									if (reason?.trim()) {
										void run(
											() => voidCost(project.id, row.original.id, reason.trim()),
											t('projects:costs.voided'),
										);
									}
								},
							},
						]}
					/>
				),
			},
		],
		[active, busy, canRecord, i18n.language, project.id, run, t],
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('projects:costs.title')}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				<dl className='grid gap-3 text-sm sm:grid-cols-5'>
					{[
						[t('projects:costs.contract'), costs.contractValue],
						[t('projects:costs.direct'), costs.directTotal],
						[t('projects:costs.materials'), costs.materialTotal],
						[t('projects:costs.total'), costs.total],
						[t('projects:costs.margin'), margin],
					].map(([label, value]) => (
						<div key={label as string}>
							<dt className='text-muted-foreground'>{label}</dt>
							<dd className='font-semibold'>{formatIdr(value as number)}</dd>
						</div>
					))}
				</dl>
				{costs.materials.length > 0 && (
					<p className='text-xs text-muted-foreground'>
						{t('projects:costs.materialNote', { notes: costs.materials.map((note) => note.code).join(', ') })}
					</p>
				)}
				{costs.entries.length === 0 ? (
					<EmptyState title={t('projects:costs.empty')} size='sm' />
				) : (
					<DataTable
						columns={columns}
						data={costs.entries}
						getRowId={(cost) => cost.id}
						bordered
						rowClassName={(cost) =>
							cost.voidedAt ? 'text-muted-foreground line-through' : undefined
						}
					/>
				)}
				{active && canRecord && (
					<form
						className='grid gap-3 rounded-md border p-3 sm:grid-cols-3'
						onSubmit={(event) => {
							event.preventDefault();
							void run(async () => {
								await addCost(project.id, {
									category,
									costDate,
									// Rupiah as typed → IDR minor units (ADR-0002).
									amount: Math.round(Number(amount) * 100),
									description: description.trim(),
									receipt,
									paymentSource,
									reference: reference.trim() || null,
								});
								setReference('');
								setAmount('');
								setDescription('');
								setReceipt(null);
								if (receiptRef.current) receiptRef.current.value = '';
							}, t('projects:costs.added'));
						}}
					>
						<Field>
							<FieldLabel htmlFor='cost-category'>{t('projects:costs.category')}</FieldLabel>
							<Select value={category} onValueChange={(value: string | null) => setCategory(value as TCostCategory)}>
								<SelectTrigger id='cost-category' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{COST_CATEGORIES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`projects:costCategory.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='cost-date'>{t('projects:costs.date')}</FieldLabel>
							<DatePicker id='cost-date' required value={costDate} onChange={setCostDate} />
						</Field>
						<Field>
							<FieldLabel htmlFor='cost-amount'>{t('projects:costs.amountRp')}</FieldLabel>
							<MoneyInput
								id='cost-amount'
								required
								value={amount}
								onValueChange={setAmount}
							/>
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='cost-description'>{t('projects:costs.description')}</FieldLabel>
							<Input id='cost-description' required maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='cost-receipt'>{t('projects:costs.receipt')}</FieldLabel>
							<Input
								ref={receiptRef}
								id='cost-receipt'
								type='file'
								accept='image/jpeg,image/png,image/webp,application/pdf'
								onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='cost-payment-source'>{t('projects:costs.paymentSource')}</FieldLabel>
							<Select
								value={paymentSource}
								onValueChange={(value: string | null) => value && setPaymentSource(value as TCostPaymentSource)}
							>
								<SelectTrigger id='cost-payment-source' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{COST_PAYMENT_SOURCES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`projects:costs.paymentSource.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='cost-reference'>{t('projects:costs.reference')}</FieldLabel>
							<Input id='cost-reference' maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} />
							{duplicateReference ? <p className='text-destructive text-xs'>{t('projects:costs.duplicateReference')}</p> : null}
						</Field>
						<p className='text-muted-foreground text-xs sm:col-span-3'>{t('projects:costs.ledgerHint')}</p>
						<div className='sm:col-span-3 flex justify-end'>
							<Button type='submit' disabled={busy || !amount || !description.trim()}>
								{t('projects:costs.add')}
							</Button>
						</div>
					</form>
				)}
			</CardContent>
		</Card>
	);
}
