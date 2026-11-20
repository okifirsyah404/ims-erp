import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { Input } from '@ims-erp/ui/components/input';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
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
				header: t('finance:common.actions'),
				meta: { align: 'right' },
				cell: ({ row }) =>
					row.original.status === 'draft' && canRecord ? (
						<>
							<Button
								size='sm'
								className='mr-1'
								disabled={record.isPending}
								onClick={() => void record.mutateAsync(row.original.id)}
							>
								{t('finance:bills.record')}
							</Button>
							<Button
								size='sm'
								variant='ghost'
								disabled={cancel.isPending}
								onClick={async () => {
									if (
										await confirm({
											title: t('finance:bills.cancelConfirm'),
											destructive: true,
										})
									) {
										void cancel.mutateAsync(row.original.id);
									}
								}}
							>
								{t('finance:bills.cancel')}
							</Button>
						</>
					) : null,
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
			<div className='flex items-center justify-between pt-2'>
				<h2 className='font-semibold'>{t('finance:bills.title')}</h2>
				{canCreate ? (
					<div className='flex gap-2'>
						<Button size='sm' onClick={() => setShowFromOrder((v) => !v)}>
							<Plus className='mr-1 size-4' />
							{t('finance:bills.fromOrder.open')}
						</Button>
						<Button
							size='sm'
							variant='outline'
							onClick={() => setShowForm((v) => !v)}
						>
							<Plus className='mr-1 size-4' />
							{t('finance:bills.create')}
						</Button>
					</div>
				) : null}
			</div>

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
					<Input
						className='w-36'
						placeholder={t('finance:bills.subtotal')}
						value={subtotal}
						onChange={(event) => setSubtotal(event.target.value)}
					/>
					<Input
						className='w-36'
						placeholder={t('finance:bills.tax')}
						value={taxTotal}
						onChange={(event) => setTaxTotal(event.target.value)}
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

			{isPending ? null : isError ? (
				<p className='text-muted-foreground text-sm'>{error.message}</p>
			) : (data?.rows.length ?? 0) === 0 ? (
				<p className='text-muted-foreground text-sm'>
					{t('finance:bills.empty')}
				</p>
			) : (
				<>
					<DataTable
						columns={columns}
						data={data?.rows ?? []}
						getRowId={(row) => row.id}
						bordered
					/>
					<div className='flex items-center gap-2 text-sm'>
						<Button
							size='sm'
							variant='outline'
							disabled={page <= 1}
							onClick={() => setPage((value) => Math.max(1, value - 1))}
						>
							‹
						</Button>
						<span>
							{page} / {data?.pagination.totalPages ?? 1}
						</span>
						<Button
							size='sm'
							variant='outline'
							disabled={page >= (data?.pagination.totalPages ?? 1)}
							onClick={() => setPage((value) => value + 1)}
						>
							›
						</Button>
					</div>
				</>
			)}
		</div>
	);
}
