import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Ban, Check, FileText, Plus, Send, X } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import {
	approveExpenseClaim,
	cancelExpenseClaim,
	EXPENSE_CLAIM_STATUSES,
	expenseClaimsQueryOptions,
	rejectExpenseClaim,
	submitExpenseClaim,
	type TExpenseClaim,
	type TExpenseClaimStatus,
} from '@/lib/finance-api';
import { employeePickerQueryOptions } from '@/lib/hr-api';
import { getActiveOrganizationId } from '@/lib/organization-store';
import { usePermission } from '@/lib/use-permission';
import { ExpenseFormDialog } from './expense-form-dialog';

const routeApi = getRouteApi('/_authed/finance/expenses/');

const PAGE_SIZE = 20;
const money = (minor: number) => (minor / 100).toLocaleString();

/** Expense claims list: filters, create dialog, row workflow actions (ERP-0013). */
export function ExpenseList() {
	const { t } = useTranslation(['finance', 'common']);
	const confirm = useConfirm();
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const canCreate = usePermission('expense_claim.create');
	const canSubmit = usePermission('expense_claim.submit');
	const canApprove = usePermission('expense_claim.approve');
	const canReject = usePermission('expense_claim.reject');
	const canCancel = usePermission('expense_claim.cancel');

	const [showForm, setShowForm] = useState(false);

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...expenseClaimsQueryOptions({
			page,
			limit: PAGE_SIZE,
			status: search.status,
			from: search.from,
			to: search.to,
			search: search.search,
		}),
		placeholderData: (previous) => previous,
	});

	const organizationId = getActiveOrganizationId();
	const employees = useQuery(employeePickerQueryOptions(organizationId ? [organizationId] : []));
	const employeeName = useMemo(
		() => new Map((employees.data ?? []).map((row) => [row.id, row.fullName])),
		[employees.data],
	);

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['expense-claims'] });

	const onError = (mutationError: Error) => toast.error(mutationError.message);

	const submit = useMutation({
		mutationFn: (id: string) => submitExpenseClaim(id),
		onSuccess: async () => {
			toast.success(t('finance:expenses.submitted'));
			await invalidate();
		},
		onError,
	});
	const approve = useMutation({
		mutationFn: (id: string) => approveExpenseClaim(id),
		onSuccess: async () => {
			toast.success(t('finance:expenses.approved'));
			await invalidate();
		},
		onError,
	});
	const reject = useMutation({
		mutationFn: (id: string) => rejectExpenseClaim(id),
		onSuccess: async () => {
			toast.success(t('finance:expenses.rejected'));
			await invalidate();
		},
		onError,
	});
	const cancel = useMutation({
		mutationFn: (id: string) => cancelExpenseClaim(id),
		onSuccess: async () => {
			toast.success(t('finance:expenses.cancelled'));
			await invalidate();
		},
		onError,
	});

	const columns = useMemo<ColumnDef<DataTableFeatures, TExpenseClaim, CellData>[]>(() => {
		const base: ColumnDef<DataTableFeatures, TExpenseClaim, CellData>[] = [
			{
				id: 'code',
				header: t('finance:common.code'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => (
					<Link
						to='/finance/expenses/$claimId'
						params={{ claimId: row.original.id }}
						className='hover:underline'
					>
						{row.original.code}
					</Link>
				),
			},
			{
				id: 'employee',
				header: t('finance:expenses.employee'),
				cell: ({ row }) =>
					row.original.employeeId
						? (employeeName.get(row.original.employeeId) ?? row.original.employeeId)
						: t('finance:common.none'),
			},
			{ accessorKey: 'claimDate', header: t('finance:expenses.claimDate') },
			{
				id: 'totalAmount',
				header: t('finance:expenses.total'),
				meta: { align: 'right' },
				cell: ({ row }) => money(row.original.totalAmount),
			},
			{
				id: 'status',
				header: t('finance:common.status'),
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.status === 'approved'
								? 'secondary'
								: row.original.status === 'rejected' || row.original.status === 'cancelled'
									? 'destructive'
									: 'outline'
						}
					>
						{t(`finance:status.${row.original.status}`)}
					</Badge>
				),
			},
		];
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('finance:common.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => {
					const status = row.original.status;
					const editable = status === 'draft' || status === 'rejected';
					return (
						<RowActions
							label={t('finance:common.actions')}
							actions={[
								{
									key: 'submit',
									label: t('finance:expenses.submit'),
									icon: Send,
									hidden: !canSubmit || !editable,
									disabled: submit.isPending,
									onSelect: () => void submit.mutateAsync(row.original.id),
								},
								{
									key: 'approve',
									label: t('finance:expenses.approve'),
									icon: Check,
									hidden: !canApprove || status !== 'submitted',
									disabled: approve.isPending,
									onSelect: () => void approve.mutateAsync(row.original.id),
								},
								{
									key: 'reject',
									label: t('finance:expenses.reject'),
									icon: X,
									destructive: true,
									hidden: !canReject || status !== 'submitted',
									disabled: reject.isPending,
									onSelect: async () => {
										if (await confirm({ title: t('finance:expenses.rejectConfirm'), destructive: true })) {
											void reject.mutateAsync(row.original.id);
										}
									},
								},
								{
									key: 'cancel',
									label: t('finance:expenses.cancel'),
									icon: Ban,
									destructive: true,
									hidden: !canCancel || !(status === 'draft' || status === 'submitted'),
									disabled: cancel.isPending,
									onSelect: async () => {
										if (await confirm({ title: t('finance:expenses.cancelConfirm'), destructive: true })) {
											void cancel.mutateAsync(row.original.id);
										}
									},
								},
								{
									key: 'detail',
									label: t('finance:expenses.edit'),
									icon: FileText,
									onSelect: () =>
										void navigate({
											to: '/finance/expenses/$claimId',
											params: { claimId: row.original.id },
										}),
								},
							]}
						/>
					);
				},
			},
		];
	}, [approve, cancel, canApprove, canCancel, canReject, canSubmit, confirm, employeeName, navigate, reject, submit, t]);

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-xl font-semibold'>{t('finance:expenses.title')}</h1>
					<p className='text-muted-foreground text-sm'>{t('finance:expenses.description')}</p>
				</div>
				{canCreate ? (
					<Button size='sm' onClick={() => setShowForm(true)}>
						<Plus className='size-4' data-icon='inline-start' />
						{t('finance:expenses.new')}
					</Button>
				) : null}
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<Select
					value={search.status ?? 'all'}
					onValueChange={(value: string | null) =>
						void navigate({
							search: (prev) => ({
								...prev,
								page: undefined,
								status: value == null || value === 'all' ? undefined : (value as TExpenseClaimStatus),
							}),
						})
					}
				>
					<SelectTrigger className='w-40'>
						<SelectValue placeholder={t('finance:expenses.filterStatus')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('finance:common.all')}</SelectItem>
						{EXPENSE_CLAIM_STATUSES.map((status) => (
							<SelectItem key={status} value={status}>
								{t(`finance:status.${status}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<DatePicker
					className='w-40'
					value={search.from ?? ''}
					onChange={(value) =>
						void navigate({ search: (prev) => ({ ...prev, page: undefined, from: value || undefined }) })
					}
				/>
				<DatePicker
					className='w-40'
					value={search.to ?? ''}
					onChange={(value) =>
						void navigate({ search: (prev) => ({ ...prev, page: undefined, to: value || undefined }) })
					}
				/>
				<Input
					className='w-48'
					placeholder={t('finance:expenses.search')}
					defaultValue={search.search ?? ''}
					onKeyDown={(event) => {
						if (event.key !== 'Enter') return;
						const value = event.currentTarget.value.trim();
						void navigate({
							search: (prev) => ({ ...prev, page: undefined, search: value || undefined }),
						});
					}}
				/>
			</div>

			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && (data?.rows.length ?? 0) === 0 ? (
					<EmptyState icon={FileText} title={t('finance:expenses.empty')} />
				) : (
					<DataTable
						columns={columns}
						data={data?.rows ?? []}
						loading={isPending}
						getRowId={(row) => row.id}
					/>
				)}
				<PaginationControls
					page={page}
					totalPages={data?.pagination.totalPages ?? 1}
					onPageChange={(next) =>
						void navigate({ search: (prev) => ({ ...prev, page: next }) })
					}
				/>
			</DataTableCard>

			<ExpenseFormDialog open={showForm} onOpenChange={setShowForm} />
		</div>
	);
}
