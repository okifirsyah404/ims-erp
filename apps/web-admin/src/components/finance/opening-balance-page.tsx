import { MoneyInput } from '@/components/money-input';
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
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Scale, Trash2 } from 'lucide-react';
import { RowActions } from '@/components/data-table/row-actions';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import {
	accountsQueryOptions,
	addOpeningBalanceRow,
	openingBalancesQueryOptions,
	postOpeningBalances,
	removeOpeningBalanceRow,
	toMinor,
	type TOpeningBalanceRow,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

const today = () => new Date().toISOString().slice(0, 10);

const formatMoney = (minor: number) => (minor / 100).toLocaleString();

/** Opening balances: draft batch + one-shot post as ONE journal entry (F3). */
export function OpeningBalancePage() {
	const { t } = useTranslation(['finance', 'common']);
	const confirm = useConfirm();
	const queryClient = useQueryClient();
	const canRead = usePermission('journal.read');
	const canEdit = usePermission('journal.update');
	const canPost = usePermission('journal.post');

	const [accountId, setAccountId] = useState('none');
	const [asOfDate, setAsOfDate] = useState(today());
	const [debit, setDebit] = useState('');
	const [credit, setCredit] = useState('');

	const {
		data: rows,
		isPending,
		isError,
		error,
	} = useQuery({
		...openingBalancesQueryOptions(),
		enabled: canRead,
	});

	const { data: accounts } = useQuery({
		...accountsQueryOptions({ page: 1, limit: 100 }),
		enabled: canEdit,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['opening-balances'] });

	const addRow = useMutation({
		mutationFn: () =>
			addOpeningBalanceRow({
				accountId,
				asOfDate,
				debitBalance: toMinor(debit),
				creditBalance: toMinor(credit),
			}),
		onSuccess: async () => {
			toast.success(t('finance:opening.addRowDone'));
			setDebit('');
			setCredit('');
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const removeRow = useMutation({
		mutationFn: (id: string) => removeOpeningBalanceRow(id),
		onSuccess: async () => {
			toast.success(t('finance:opening.rowRemoved'));
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const postBatch = useMutation({
		mutationFn: () => postOpeningBalances(),
		onSuccess: async () => {
			toast.success(t('finance:opening.batchPosted'));
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const draftRows = rows?.filter((row) => row.postedAt == null) ?? [];
	const totalDebit = draftRows.reduce((sum, row) => sum + row.debitBalance, 0);
	const totalCredit = draftRows.reduce(
		(sum, row) => sum + row.creditBalance,
		0,
	);
	const balanced = totalDebit === totalCredit && totalDebit > 0;
	const hasPosted = rows?.some((row) => row.postedAt != null) ?? false;

	const showActions = canEdit && !hasPosted;
	const accountRows = accounts?.rows;
	const columns = useMemo<
		ColumnDef<DataTableFeatures, TOpeningBalanceRow, CellData>[]
	>(() => {
		const base: ColumnDef<DataTableFeatures, TOpeningBalanceRow, CellData>[] = [
			{
				id: 'account',
				header: t('finance:opening.account'),
				cell: ({ row }) => {
					const account = accountRows?.find(
						(item) => item.id === row.original.accountId,
					);
					return account
						? `${account.code} — ${account.name}`
						: row.original.accountId;
				},
			},
			{ accessorKey: 'asOfDate', header: t('finance:opening.asOf') },
			{
				id: 'debit',
				header: t('finance:opening.debit'),
				meta: { align: 'right' },
				cell: ({ row }) => formatMoney(row.original.debitBalance),
			},
			{
				id: 'credit',
				header: t('finance:opening.credit'),
				meta: { align: 'right' },
				cell: ({ row }) => formatMoney(row.original.creditBalance),
			},
			{
				id: 'status',
				header: t('finance:common.status'),
				cell: ({ row }) => (
					<Badge variant={row.original.postedAt ? 'secondary' : 'outline'}>
						{row.original.postedAt
							? t('finance:opening.posted')
							: t('payments.status.draft')}
					</Badge>
				),
			},
		];
		if (!showActions) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('finance:common.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('finance:common.actions')}
						disabled={removeRow.isPending}
						actions={[
							{
								key: 'remove',
								label: t('common:action.delete'),
								icon: Trash2,
								destructive: true,
								hidden: row.original.postedAt != null,
								onSelect: async () => {
									if (
										await confirm({
											title: t('finance:opening.removeConfirm'),
											destructive: true,
										})
									) {
										void removeRow.mutateAsync(row.original.id);
									}
								},
							},
						]}
					/>
				),
			},
		];
	}, [accountRows, confirm, removeRow, showActions, t]);

	if (!canRead) {
		return (
			<EmptyState
				icon={Scale}
				title={t('finance:opening.title')}
				bordered
			/>
		);
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('finance:opening.title')}</h1>
				<p className='text-muted-foreground text-sm'>
					{t('finance:opening.description')}
				</p>
			</div>

			{canEdit && !hasPosted ? (
				<div className='flex flex-wrap items-center gap-2 rounded-md border p-4'>
					<Select
						value={accountId}
						onValueChange={(value: string | null) =>
							setAccountId(value ?? 'none')
						}
					>
						<SelectTrigger className='w-72'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='none'>
								{t('finance:opening.account')}
							</SelectItem>
							{accounts?.rows
								.filter((account) => account.isActive && account.isPostable)
								.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.code} — {account.name}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
					<DatePicker
						className='w-40'
						value={asOfDate}
						onChange={setAsOfDate}
					/>
					<MoneyInput
						className='w-40'
						placeholder={t('finance:opening.debit')}
						value={debit}
						onValueChange={setDebit}
					/>
					<MoneyInput
						className='w-40'
						placeholder={t('finance:opening.credit')}
						value={credit}
						onValueChange={setCredit}
					/>
					<Button
						size='sm'
						disabled={addRow.isPending || accountId === 'none'}
						onClick={() => void addRow.mutateAsync()}
					>
						{t('finance:opening.addRow')}
					</Button>
				</div>
			) : null}

			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && (rows?.length ?? 0) === 0 ? (
					<EmptyState
						icon={Scale}
						title={t('finance:opening.empty')}
					/>
				) : (
					<DataTable
						columns={columns}
						data={rows ?? []}
						loading={isPending}
						getRowId={(row) => row.id}
					/>
				)}
			</DataTableCard>

			{draftRows.length > 0 && canPost && !hasPosted ? (
				<div className='flex flex-wrap items-center gap-3 text-sm'>
					<span>
						{t('finance:journal.totalDebit')}: {formatMoney(totalDebit)}
					</span>
					<span>
						{t('finance:journal.totalCredit')}: {formatMoney(totalCredit)}
					</span>
					<Badge variant={balanced ? 'secondary' : 'destructive'}>
						{balanced
							? t('finance:journal.balance')
							: t('finance:opening.mustBalance')}
					</Badge>
					<Button
						size='sm'
						disabled={!balanced || postBatch.isPending}
						onClick={async () => {
							if (
								await confirm({
									title: t('finance:opening.postBatch') + '?',
									destructive: false,
								})
							) {
								void postBatch.mutateAsync();
							}
						}}
					>
						{postBatch.isPending
							? t('finance:opening.postingBatch')
							: t('finance:opening.postBatch')}
					</Button>
				</div>
			) : null}
		</div>
	);
}
