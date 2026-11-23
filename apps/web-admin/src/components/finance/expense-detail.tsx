import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Ban, Check, Pencil, Send, X } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import {
	approveExpenseClaim,
	cancelExpenseClaim,
	expenseClaimQueryOptions,
	rejectExpenseClaim,
	submitExpenseClaim,
	type TExpenseClaimItem,
} from '@/lib/finance-api';
import { employeePickerQueryOptions } from '@/lib/hr-api';
import { getActiveOrganizationId } from '@/lib/organization-store';
import { usePermission } from '@/lib/use-permission';
import { ExpenseFormDialog } from './expense-form-dialog';

const routeApi = getRouteApi('/_authed/finance/expenses/$claimId/');

const money = (minor: number) => (minor / 100).toLocaleString();

/** One expense claim: header, lines, workflow actions and the posted entry (ERP-0013). */
export function ExpenseDetail() {
	const { t } = useTranslation(['finance', 'common']);
	const confirm = useConfirm();
	const queryClient = useQueryClient();
	const { claimId } = routeApi.useParams();
	const canEdit = usePermission('expense_claim.update');
	const canSubmit = usePermission('expense_claim.submit');
	const canApprove = usePermission('expense_claim.approve');
	const canReject = usePermission('expense_claim.reject');
	const canCancel = usePermission('expense_claim.cancel');

	const [editing, setEditing] = useState(false);
	const { data: claim, isPending, isError, error } = useQuery(expenseClaimQueryOptions(claimId));

	const organizationId = getActiveOrganizationId();
	const employees = useQuery(employeePickerQueryOptions(organizationId ? [organizationId] : []));
	const employeeName = useMemo(
		() => new Map((employees.data ?? []).map((row) => [row.id, row.fullName])),
		[employees.data],
	);

	const invalidate = async () => {
		await queryClient.invalidateQueries({ queryKey: ['expense-claims'] });
	};
	const onError = (mutationError: Error) => toast.error(mutationError.message);

	const submit = useMutation({
		mutationFn: () => submitExpenseClaim(claimId),
		onSuccess: async () => {
			toast.success(t('finance:expenses.submitted'));
			await invalidate();
		},
		onError,
	});
	const approve = useMutation({
		mutationFn: () => approveExpenseClaim(claimId),
		onSuccess: async () => {
			toast.success(t('finance:expenses.approved'));
			await invalidate();
		},
		onError,
	});
	const reject = useMutation({
		mutationFn: () => rejectExpenseClaim(claimId),
		onSuccess: async () => {
			toast.success(t('finance:expenses.rejected'));
			await invalidate();
		},
		onError,
	});
	const cancel = useMutation({
		mutationFn: () => cancelExpenseClaim(claimId),
		onSuccess: async () => {
			toast.success(t('finance:expenses.cancelled'));
			await invalidate();
		},
		onError,
	});

	const columns = useMemo<ColumnDef<DataTableFeatures, TExpenseClaimItem, CellData>[]>(
		() => [
			{ accessorKey: 'expenseDate', header: t('finance:expenses.expenseDate') },
			{
				id: 'categoryCode',
				header: t('finance:expenses.category'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => row.original.categoryCode ?? t('finance:common.none'),
			},
			{
				id: 'description',
				header: t('finance:expenses.lineDescription'),
				cell: ({ row }) => row.original.description ?? t('finance:common.none'),
			},
			{
				id: 'amount',
				header: t('finance:expenses.amount'),
				meta: { align: 'right' },
				cell: ({ row }) => money(row.original.amount),
			},
			{
				id: 'taxAmount',
				header: t('finance:expenses.tax'),
				meta: { align: 'right' },
				cell: ({ row }) => money(row.original.taxAmount),
			},
		],
		[t],
	);

	if (isError) return <ErrorState error={error} />;
	if (isPending || !claim) return null;

	const status = claim.status;
	const editable = status === 'draft' || status === 'rejected';

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='flex items-center gap-2 text-xl font-semibold'>
						<span className='font-mono'>{claim.code}</span>
						<Badge
							variant={
								status === 'approved'
									? 'secondary'
									: status === 'rejected' || status === 'cancelled'
										? 'destructive'
										: 'outline'
							}
						>
							{t(`finance:status.${status}`)}
						</Badge>
					</h1>
					<p className='text-muted-foreground text-sm'>
						{t('finance:expenses.detail.description')}
					</p>
				</div>
				<div className='flex flex-wrap gap-2'>
					{canEdit && editable ? (
						<Button size='sm' variant='outline' onClick={() => setEditing(true)}>
							<Pencil className='size-4' data-icon='inline-start' />
							{t('finance:expenses.edit')}
						</Button>
					) : null}
					{canSubmit && editable ? (
						<Button size='sm' disabled={submit.isPending} onClick={() => void submit.mutateAsync()}>
							<Send className='size-4' data-icon='inline-start' />
							{t('finance:expenses.submit')}
						</Button>
					) : null}
					{canApprove && status === 'submitted' ? (
						<Button size='sm' disabled={approve.isPending} onClick={() => void approve.mutateAsync()}>
							<Check className='size-4' data-icon='inline-start' />
							{t('finance:expenses.approve')}
						</Button>
					) : null}
					{canReject && status === 'submitted' ? (
						<Button
							size='sm'
							variant='outline'
							disabled={reject.isPending}
							onClick={async () => {
								if (await confirm({ title: t('finance:expenses.rejectConfirm'), destructive: true })) {
									void reject.mutateAsync();
								}
							}}
						>
							<X className='size-4' data-icon='inline-start' />
							{t('finance:expenses.reject')}
						</Button>
					) : null}
					{canCancel && (status === 'draft' || status === 'submitted') ? (
						<Button
							size='sm'
							variant='ghost'
							disabled={cancel.isPending}
							onClick={async () => {
								if (await confirm({ title: t('finance:expenses.cancelConfirm'), destructive: true })) {
									void cancel.mutateAsync();
								}
							}}
						>
							<Ban className='size-4' data-icon='inline-start' />
							{t('finance:expenses.cancel')}
						</Button>
					) : null}
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('finance:expenses.title')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-3 text-sm sm:grid-cols-3'>
					<div>
						<p className='text-muted-foreground'>{t('finance:expenses.employee')}</p>
						<p>
							{claim.employeeId
								? (employeeName.get(claim.employeeId) ?? claim.employeeId)
								: t('finance:common.none')}
						</p>
					</div>
					<div>
						<p className='text-muted-foreground'>{t('finance:expenses.claimDate')}</p>
						<p>{claim.claimDate ?? t('finance:common.none')}</p>
					</div>
					<div>
						<p className='text-muted-foreground'>{t('finance:expenses.total')}</p>
						<p className='font-medium'>{money(claim.totalAmount)}</p>
					</div>
					{claim.notes ? (
						<div className='sm:col-span-3'>
							<p className='text-muted-foreground'>{t('finance:expenses.notes')}</p>
							<p>{claim.notes}</p>
						</div>
					) : null}
					{claim.journalEntry ? (
						<div className='sm:col-span-3'>
							<p className='text-muted-foreground'>{t('finance:expenses.journal')}</p>
							<p>
								<Link to='/finance/journal' className='font-mono text-xs hover:underline'>
									{claim.journalEntry.code}
								</Link>{' '}
								<span className='text-muted-foreground'>
									{claim.journalEntry.entryDate} — {t('finance:expenses.journalHint')}
								</span>
							</p>
						</div>
					) : null}
				</CardContent>
			</Card>

			<DataTableCard title={t('finance:expenses.lines')}>
				{claim.items.length === 0 ? (
					<EmptyState title={t('finance:common.empty')} />
				) : (
					<DataTable
						columns={columns}
						data={claim.items}
						loading={false}
						getRowId={(row) => row.id}
					/>
				)}
			</DataTableCard>

			<ExpenseFormDialog open={editing} onOpenChange={setEditing} claim={claim} />
		</div>
	);
}
