import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { ArrowLeftRight, Landmark, Pencil, Plus, Receipt, Users } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	CashBankFormDialog,
	type TCashBankFormValues,
} from '@/components/finance/cash-bank-form-dialog';
import {
	accountsQueryOptions,
	cashBankAccountsQueryOptions,
	cashBankTransactionsQueryOptions,
	createCashBankAccount,
	type TCashBankAccount,
	type TCashBankTransaction,
	updateCashBankAccount,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';
import { CashBankMovementDialog } from './cash-bank-movement-dialog';
import { GatewaySettlementDialog } from './gateway-settlement-dialog';
import { TaxPaymentDialog } from './tax-payment-dialog';

const PAGE_SIZE = 20;
const ACCOUNT_PAGE_SIZE = 20;

const formatMoney = (minor: number) => (minor / 100).toLocaleString();

/** Literal label keys of the treasury account types (typed for `t`). */
const CASH_TYPE_KEYS = {
	bank: 'finance:accountType.bank',
	cash: 'finance:accountType.cash',
	ewallet: 'finance:accountType.ewallet',
	clearing: 'finance:accountType.clearing',
} as const;

/** Cash & bank: accounts with GL links + movement ledger (F3). */
export function CashBankPage() {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const canRead = usePermission('cash_bank.read');
	const canCreate = usePermission('cash_bank.create');
	const canUpdate = usePermission('cash_bank.update');
	const [settling, setSettling] = useState(false);
	const [payingTax, setPayingTax] = useState(false);
	const [payingPayroll, setPayingPayroll] = useState(false);

	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<TCashBankAccount | null>(null);
	const [movementOpen, setMovementOpen] = useState(false);
	const [page, setPage] = useState(1);
	const [accountPage, setAccountPage] = useState(1);
	const {
		data: accounts,
		isPending: accountsPending,
		isError: accountsError,
		error: accountsErr,
	} = useQuery({
		...cashBankAccountsQueryOptions(),
		enabled: canRead,
	});

	const { data: movements, isPending, isError, error } = useQuery({
		...cashBankTransactionsQueryOptions({ page, limit: PAGE_SIZE }),
		placeholderData: (previous) => previous,
		enabled: canRead,
	});

	const { data: glAccounts } = useQuery({
		...accountsQueryOptions({ page: 1, limit: 100 }),
		enabled: canRead,
	});

	const glById = useMemo(
		() => new Map((glAccounts?.rows ?? []).map((gl) => [gl.id, gl])),
		[glAccounts],
	);

	const accountTotalPages = Math.max(
		1,
		Math.ceil((accounts?.length ?? 0) / ACCOUNT_PAGE_SIZE),
	);
	const safeAccountPage = Math.min(accountPage, accountTotalPages);
	const pagedAccounts = useMemo(
		() =>
			(accounts ?? []).slice(
				(safeAccountPage - 1) * ACCOUNT_PAGE_SIZE,
				safeAccountPage * ACCOUNT_PAGE_SIZE,
			),
		[accounts, safeAccountPage],
	);

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ['cash-bank-accounts'] });
		void queryClient.invalidateQueries({ queryKey: ['cash-bank-transactions'] });
	};

	const createAccount = useMutation({
		mutationFn: (values: TCashBankFormValues) =>
			createCashBankAccount({
				code: values.code,
				name: values.name,
				accountType: values.accountType,
				bankName: values.bankName,
				accountNumber: values.accountNumber,
				accountHolder: values.accountHolder,
				invoiceUsage: values.invoiceUsage,
				isPrimary: values.isPrimary,
				openingBalance: values.openingBalance,
				glAccountId: values.glAccountId,
			}),
		onSuccess: async () => {
			toast.success(t('finance:cashBank.created'));
			setCreating(false);
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const editAccount = useMutation({
		mutationFn: (values: TCashBankFormValues) =>
			updateCashBankAccount(editing?.id ?? '', {
				name: values.name,
				bankName: values.bankName,
				accountNumber: values.accountNumber,
				accountHolder: values.accountHolder,
				invoiceUsage: values.invoiceUsage,
				isPrimary: values.isPrimary,
				glAccountId: values.glAccountId,
			}),
		onSuccess: async () => {
			toast.success(t('finance:cashBank.updated'));
			setEditing(null);
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const accountColumns = useMemo<
		ColumnDef<DataTableFeatures, TCashBankAccount, CellData>[]
	>(() => {
		const base: ColumnDef<DataTableFeatures, TCashBankAccount, CellData>[] = [
			{
				accessorKey: 'code',
				header: t('finance:common.code'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{ accessorKey: 'name', header: t('finance:common.name') },
			{
				id: 'accountType',
				header: t('finance:cashBank.accountType'),
				cell: ({ row }) =>
					t(
						CASH_TYPE_KEYS[
							row.original.accountType as keyof typeof CASH_TYPE_KEYS
						] ?? 'finance:accountType.bank',
					),
			},
			{
				id: 'invoiceUsage',
				header: t('finance:cashBank.invoiceUsage'),
				cell: ({ row }) => {
					const usage = row.original.invoiceUsage;
					if (!usage) return t('finance:common.none');
					return (
						<Badge variant={row.original.isPrimary ? 'default' : 'outline'}>
							{usage === 'vat'
								? t('finance:cashBank.invoiceUsage.vat')
								: t('finance:cashBank.invoiceUsage.nonVat')}
						</Badge>
					);
				},
			},
			{
				id: 'currentBalance',
				header: t('finance:cashBank.currentBalance'),
				meta: { align: 'right' },
				cell: ({ row }) => formatMoney(row.original.currentBalance),
			},
			{
				id: 'glLink',
				header: t('finance:cashBank.glLink'),
				cell: ({ row }) => {
					const gl = row.original.glAccountId
						? glById.get(row.original.glAccountId)
						: null;
					return gl ? (
						<span className='font-mono text-xs'>
							{gl.code} — {gl.name}
						</span>
					) : (
						<span className='text-xs text-muted-foreground'>
							{t('finance:common.none')}
						</span>
					);
				},
			},
		];
		if (!canUpdate) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('finance:common.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('finance:common.actions')}
						disabled={editAccount.isPending}
						actions={[
							{
								key: 'edit',
								label: t('finance:cashBank.edit'),
								icon: Pencil,
								onSelect: () => setEditing(row.original),
							},
						]}
					/>
				),
			},
		];
	}, [canUpdate, editAccount.isPending, glById, t]);

	const movementColumns = useMemo<
		ColumnDef<DataTableFeatures, TCashBankTransaction, CellData>[]
	>(
		() => [
			{ accessorKey: 'transactionDate', header: t('finance:cashBank.movementDate') },
			{
				id: 'code',
				header: t('finance:common.code'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => row.original.id.slice(0, 8),
			},
			{
				id: 'direction',
				header: `${t('finance:cashBank.direction.in')} / ${t('finance:cashBank.direction.out')}`,
				cell: ({ row }) => (
					<Badge variant={row.original.direction === 'in' ? 'secondary' : 'outline'}>
						{row.original.direction === 'in'
							? t('finance:cashBank.direction.in')
							: t('finance:cashBank.direction.out')}
					</Badge>
				),
			},
			{
				id: 'amount',
				header: t('finance:common.amount'),
				meta: { align: 'right' },
				cell: ({ row }) => formatMoney(row.original.amount),
			},
			{
				id: 'balanceAfter',
				header: t('finance:cashBank.balanceAfter'),
				meta: { align: 'right' },
				cell: ({ row }) => formatMoney(row.original.balanceAfter),
			},
			{
				id: 'description',
				header: t('finance:common.description'),
				meta: { cellClassName: 'max-w-72 truncate' },
				cell: ({ row }) => row.original.description ?? t('finance:common.none'),
			},
		],
		[t],
	);

	if (!canRead) {
		return (
			<EmptyState icon={Landmark} title={t('finance:cashBank.title')} bordered />
		);
	}

	return (
		<div className='space-y-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-xl font-semibold'>{t('finance:cashBank.title')}</h1>
					<p className='text-muted-foreground text-sm'>
						{t('finance:cashBank.description')}
					</p>
				</div>
			</div>
			{settling ? <GatewaySettlementDialog accounts={accounts ?? []} onClose={() => setSettling(false)} /> : null}
			{payingTax ? <TaxPaymentDialog accounts={accounts ?? []} onClose={() => setPayingTax(false)} /> : null}
			{payingPayroll ? <TaxPaymentDialog mode='payroll' accounts={accounts ?? []} onClose={() => setPayingPayroll(false)} /> : null}
			{movementOpen ? (
				<CashBankMovementDialog
					accounts={accounts ?? []}
					glAccounts={glAccounts?.rows ?? []}
					onClose={() => setMovementOpen(false)}
				/>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle>{t('finance:cashBank.title')}</CardTitle>
					{canCreate ? (
						<CardAction>
							<Button size='sm' onClick={() => setCreating(true)}>
								<Plus className='size-4' data-icon='inline-start' />
								{t('finance:cashBank.create')}
							</Button>
						</CardAction>
					) : null}
				</CardHeader>
				<CardContent>
					{accountsError ? (
						<ErrorState error={accountsErr} />
					) : !accountsPending && (accounts?.length ?? 0) === 0 ? (
						<EmptyState icon={Landmark} title={t('finance:cashBank.accountsEmpty')} />
					) : (
						<>
							<DataTable
								columns={accountColumns}
								data={pagedAccounts}
								loading={accountsPending}
								getRowId={(row) => row.id}
							/>
							<PaginationControls
								page={safeAccountPage}
								totalPages={accountTotalPages}
								onPageChange={setAccountPage}
							/>
						</>
					)}
				</CardContent>
			</Card>

			{canCreate ? (
				<div className='flex flex-col gap-3 sm:flex-row'>
					<Button
						variant='outline'
						className='h-auto flex-1 flex-col gap-2 px-5 py-4'
						onClick={() => setPayingTax(true)}
					>
						<Receipt className='size-5' />
						{t('finance:taxPayment.title')}
					</Button>
					<Button
						variant='outline'
						className='h-auto flex-1 flex-col gap-2 px-5 py-4'
						onClick={() => setPayingPayroll(true)}
					>
						<Users className='size-5' />
						{t('finance:payrollPayment.title')}
					</Button>
					<Button
						variant='outline'
						className='h-auto flex-1 flex-col gap-2 px-5 py-4'
						onClick={() => setSettling(true)}
					>
						<ArrowLeftRight className='size-5' />
						{t('finance:gatewaySettlement.title')}
					</Button>
				</div>
			) : null}



			<Card>
				<CardHeader>
					<CardTitle>{t('finance:cashBank.movements')}</CardTitle>
					<CardDescription>{t('finance:cashBank.glLinkRequired')}</CardDescription>
					{canCreate ? (
						<CardAction>
							<Button size='sm' onClick={() => setMovementOpen(true)}>
								<Plus className='size-4' data-icon='inline-start' />
								{t('finance:cashBank.newMovement')}
							</Button>
						</CardAction>
					) : null}
				</CardHeader>
				<CardContent>
					{isError ? (
						<ErrorState error={error} />
					) : !isPending && (movements?.rows.length ?? 0) === 0 ? (
						<EmptyState icon={Landmark} title={t('finance:cashBank.movementsEmpty')} />
					) : (
						<>
							<DataTable
								columns={movementColumns}
								data={movements?.rows ?? []}
								loading={isPending}
								getRowId={(row) => row.id}
							/>
							<PaginationControls
								page={page}
								totalPages={movements?.pagination.totalPages ?? 1}
								onPageChange={setPage}
							/>
						</>
					)}
				</CardContent>
			</Card>

			{creating ? (
				<CashBankFormDialog
					account={null}
					submitting={createAccount.isPending}
					onClose={() => setCreating(false)}
					onSave={(values) => void createAccount.mutateAsync(values)}
				/>
			) : null}

			{editing ? (
				<CashBankFormDialog
					account={editing}
					submitting={editAccount.isPending}
					onClose={() => setEditing(null)}
					onSave={(values) => void editAccount.mutateAsync(values)}
				/>
			) : null}
		</div>
	);
}
