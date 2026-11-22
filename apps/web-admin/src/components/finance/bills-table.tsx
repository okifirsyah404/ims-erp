import { MoneyInput } from '@/components/money-input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, ErrorState } from '@/components/empty-state';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Ban, Check, Plus } from 'lucide-react';
import { RowActions } from '@/components/data-table/row-actions';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import {
	billsQueryOptions,
	cancelBill,
	createBill,
	recordBill,
	toMinor,
	type TSupplierBill,
} from '@/lib/finance-api';
import { supplierCompaniesQueryOptions } from '@/lib/supplier-api';
import { usePermission } from '@/lib/use-permission';
import { BillFromOrderForm } from './bill-from-order-form';

const formatMoney = (minor: number) => (minor / 100).toLocaleString();

const today = () => new Date().toISOString().slice(0, 10);

/** Supplier bills: create draft, record (post AP), cancel draft (F5). */
export function BillsTable() {
	const { t } = useTranslation(['finance', 'common']);
	const confirm = useConfirm();
	const queryClient = useQueryClient();
	const canRead = usePermission('bill.read');
	const canCreate = usePermission('bill.create');
	const canRecord = usePermission('bill.record');

	const [page, setPage] = useState(1);
	const [showForm, setShowForm] = useState(false);
	const [showFromOrder, setShowFromOrder] = useState(false);
	const [supplierCompanyId, setSupplierCompanyId] = useState('');
	const [billDate, setBillDate] = useState(today());
	const [dueDate, setDueDate] = useState('');
	const [subtotal, setSubtotal] = useState('');
	const [taxTotal, setTaxTotal] = useState('');

	const { data, isPending, isError, error } = useQuery({
		...billsQueryOptions({ page, limit: 20 }),
		placeholderData: (previous) => previous,
		enabled: canRead,
	});

	const suppliers = useQuery({
		...supplierCompaniesQueryOptions({ status: 'active', limit: 100 }),
		enabled: canCreate && showForm,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['bills'] });

	const create = useMutation({
		mutationFn: () =>
			createBill({
				supplierCompanyId,
				billDate,
				dueDate: dueDate || null,
				subtotal: toMinor(subtotal),
				taxTotal: toMinor(taxTotal),
			}),
		onSuccess: async () => {
			toast.success(t('finance:bills.created'));
			setShowForm(false);
			setSubtotal('');
			setTaxTotal('');
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const record = useMutation({
		mutationFn: (id: string) => recordBill(id),
		onSuccess: async () => {
			toast.success(t('finance:bills.recorded'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const cancel = useMutation({
		mutationFn: (id: string) => cancelBill(id),
		onSuccess: async () => {
			toast.success(t('finance:bills.cancelled'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const columns = useMemo<ColumnDef<DataTableFeatures, TSupplierBill, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('finance:common.code'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => (
					<>
						{row.original.code}
						{row.original.supplierInvoiceNumber ? (
							<div className='font-sans text-muted-foreground'>
								{row.original.supplierInvoiceNumber}
							</div>
						) : null}
					</>
				),
			},
			{ accessorKey: 'billDate', header: t('finance:bills.billDate') },
			{ accessorKey: 'dueDate', header: t('finance:bills.dueDate') },
			{
				id: 'grandTotal',
				header: t('finance:bills.grandTotal'),
				meta: { align: 'right' },
				cell: ({ row }) => formatMoney(row.original.grandTotal),
			},
			{
				id: 'paidTotal',
				header: t('finance:bills.paid'),
				meta: { align: 'right' },
				cell: ({ row }) => formatMoney(row.original.paidTotal),
			},
			{
				id: 'outstandingTotal',
				header: t('finance:bills.outstanding'),
				meta: { align: 'right' },
				cell: ({ row }) => formatMoney(row.original.outstandingTotal),
			},
			{
				id: 'status',
				header: t('finance:common.status'),
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.status === 'paid'
								? 'secondary'
								: row.original.status === 'void'
									? 'outline'
									: row.original.status === 'overdue'
										? 'destructive'
										: 'outline'
						}
					>
						{t(`finance:bills.status.${row.original.status}`)}
					</Badge>
				),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('finance:common.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => {
					const editable = row.original.status === 'draft' && canRecord;
					return (
						<RowActions
							label={t('finance:common.actions')}
							actions={[
								{
									key: 'record',
									label: t('finance:bills.record'),
									icon: Check,
									disabled: record.isPending,
									hidden: !editable,
									onSelect: () => void record.mutateAsync(row.original.id),
								},
								{
									key: 'cancel',
									label: t('finance:bills.cancel'),
									icon: Ban,
									destructive: true,
									disabled: cancel.isPending,
									hidden: !editable,
									onSelect: async () => {
										if (
											await confirm({
												title: t('finance:bills.cancelConfirm'),
												destructive: true,
											})
										) {
											void cancel.mutateAsync(row.original.id);
										}
									},
								},
							]}
						/>
					);
				},
			},
		],
		[
			cancel,
			canRecord,
			confirm,
			record,
			t,
		],
	);

	if (!canRead) return null;

	return (
		<div className='space-y-3'>
			{canCreate ? (
				<div className='flex justify-end gap-2 pt-2'>
					<Button size='sm' onClick={() => setShowFromOrder((v) => !v)}>
						<Plus className='size-4' data-icon='inline-start' />
						{t('finance:bills.fromOrder.open')}
					</Button>
					<Button
						size='sm'
						variant='outline'
						onClick={() => setShowForm((v) => !v)}
					>
						<Plus className='size-4' data-icon='inline-start' />
						{t('finance:bills.create')}
					</Button>
				</div>
			) : null}

			{canCreate && showFromOrder ? (
				<BillFromOrderForm onDone={() => setShowFromOrder(false)} />
			) : null}

			{canCreate && showForm ? (
				<div className='flex flex-wrap items-center gap-2 rounded-md border p-4'>
					<Select
						value={supplierCompanyId || 'none'}
						onValueChange={(value: string | null) =>
							setSupplierCompanyId(
								value == null || value === 'none' ? '' : value,
							)
						}
					>
						<SelectTrigger className='w-64'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='none'>
								{t('finance:aging.party.supplier')}
							</SelectItem>
							{suppliers.data?.rows.map((row) => (
								<SelectItem key={row.id} value={row.id}>
									{row.code} - {row.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<DatePicker
						className='w-40'
						value={billDate}
						onChange={setBillDate}
					/>
					<DatePicker className='w-40' value={dueDate} onChange={setDueDate} />
					<MoneyInput
						className='w-36'
						placeholder={t('finance:bills.subtotal')}
						value={subtotal}
						onValueChange={setSubtotal}
					/>
					<MoneyInput
						className='w-36'
						placeholder={t('finance:bills.tax')}
						value={taxTotal}
						onValueChange={setTaxTotal}
					/>
					<Button
						size='sm'
						disabled={create.isPending || !supplierCompanyId || !subtotal}
						onClick={() => void create.mutateAsync()}
					>
						{create.isPending
							? t('finance:common.creating')
							: t('finance:common.create')}
					</Button>
				</div>
			) : null}

			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && (data?.rows.length ?? 0) === 0 ? (
				<EmptyState title={t('finance:bills.empty')} bordered />
			) : (
				<DataTableCard title={t('finance:bills.title')}>
					<DataTable
						columns={columns}
						data={data?.rows ?? []}
						loading={isPending}
						getRowId={(row) => row.id}
					/>
					<PaginationControls
						page={page}
						totalPages={data?.pagination.totalPages ?? 1}
						onPageChange={setPage}
					/>
				</DataTableCard>
			)}
		</div>
	);
}
