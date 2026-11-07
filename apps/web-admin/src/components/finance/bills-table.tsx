import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { Plus } from 'lucide-react';
import { toast } from '@/components/toast';
import {
	billsQueryOptions,
	cancelBill,
	createBill,
	recordBill,
	toMinor,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

const formatMoney = (minor: number) => (minor / 100).toLocaleString();

const today = () => new Date().toISOString().slice(0, 10);

/** Supplier bills: create draft, record (post AP), cancel draft (F5). */
export function BillsTable() {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const canRead = usePermission('bill.read');
	const canCreate = usePermission('bill.create');
	const canRecord = usePermission('bill.record');

	const [page, setPage] = useState(1);
	const [showForm, setShowForm] = useState(false);
	const [supplierId, setSupplierId] = useState('');
	const [billDate, setBillDate] = useState(today());
	const [dueDate, setDueDate] = useState('');
	const [subtotal, setSubtotal] = useState('');
	const [taxTotal, setTaxTotal] = useState('');

	const { data, isPending, isError, error } = useQuery({
		...billsQueryOptions({ page, limit: 20 }),
		placeholderData: (previous) => previous,
		enabled: canRead,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['bills'] });

	const create = useMutation({
		mutationFn: () =>
			createBill({
				supplierId,
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

	if (!canRead) return null;

	return (
		<div className='space-y-3'>
			<div className='flex items-center justify-between pt-2'>
				<h2 className='font-semibold'>{t('finance:bills.title')}</h2>
				{canCreate ? (
					<Button size='sm' variant='outline' onClick={() => setShowForm((v) => !v)}>
						<Plus className='mr-1 size-4' />
						{t('finance:bills.create')}
					</Button>
				) : null}
			</div>

			{canCreate && showForm ? (
				<div className='flex flex-wrap items-center gap-2 rounded-md border p-4'>
					<Input
						className='w-56'
						placeholder='Supplier ID (UUID)'
						value={supplierId}
						onChange={(event) => setSupplierId(event.target.value)}
					/>
					<Input
						type='date'
						className='w-40'
						value={billDate}
						onChange={(event) => setBillDate(event.target.value)}
					/>
					<Input
						type='date'
						className='w-40'
						value={dueDate}
						onChange={(event) => setDueDate(event.target.value)}
					/>
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
						disabled={create.isPending || !supplierId || !subtotal}
						onClick={() => void create.mutateAsync()}
					>
						{create.isPending ? t('finance:common.creating') : t('finance:common.create')}
					</Button>
				</div>
			) : null}

			{isPending ? null : isError ? (
				<p className='text-muted-foreground text-sm'>{error.message}</p>
			) : (data?.rows.length ?? 0) === 0 ? (
				<p className='text-muted-foreground text-sm'>{t('finance:bills.empty')}</p>
			) : (
				<>
					<div className='overflow-x-auto rounded-md border'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('finance:common.code')}</TableHead>
									<TableHead>{t('finance:bills.billDate')}</TableHead>
									<TableHead>{t('finance:bills.dueDate')}</TableHead>
									<TableHead className='text-right'>{t('finance:bills.grandTotal')}</TableHead>
									<TableHead className='text-right'>{t('finance:bills.paid')}</TableHead>
									<TableHead className='text-right'>{t('finance:bills.outstanding')}</TableHead>
									<TableHead>{t('finance:common.status')}</TableHead>
									<TableHead className='text-right'>{t('finance:common.actions')}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data?.rows.map((bill) => (
									<TableRow key={bill.id}>
										<TableCell className='font-mono text-xs'>{bill.code}</TableCell>
										<TableCell>{bill.billDate}</TableCell>
										<TableCell>{bill.dueDate}</TableCell>
										<TableCell className='text-right'>
											{formatMoney(bill.grandTotal)}
										</TableCell>
										<TableCell className='text-right'>
											{formatMoney(bill.paidTotal)}
										</TableCell>
										<TableCell className='text-right'>
											{formatMoney(bill.outstandingTotal)}
										</TableCell>
										<TableCell>
											<Badge
												variant={
													bill.status === 'paid'
														? 'secondary'
														: bill.status === 'void'
															? 'outline'
															: bill.status === 'overdue'
																? 'destructive'
																: 'outline'
												}
											>
												{t(`finance:bills.status.${bill.status}`)}
											</Badge>
										</TableCell>
										<TableCell className='text-right'>
											{bill.status === 'draft' && canRecord ? (
												<>
													<Button
														size='sm'
														className='mr-1'
														disabled={record.isPending}
														onClick={() => void record.mutateAsync(bill.id)}
													>
														{t('finance:bills.record')}
													</Button>
													<Button
														size='sm'
														variant='ghost'
														disabled={cancel.isPending}
														onClick={() => {
															if (window.confirm(t('finance:bills.cancelConfirm'))) {
																void cancel.mutateAsync(bill.id);
															}
														}}
													>
														{t('finance:bills.cancel')}
													</Button>
												</>
											) : null}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
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
