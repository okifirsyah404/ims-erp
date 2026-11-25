import { MoneyInput } from '@/components/money-input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
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
import { Landmark, Pencil, Plus } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
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
	postCashBankMovement,
	toMinor,
	type TCashBankAccount,
	type TCashBankTransaction,
	updateCashBankAccount,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';
import { GatewaySettlementDialog } from './gateway-settlement-dialog';
import { TaxPaymentDialog } from './tax-payment-dialog';

/** The route API for `/finance/cash-bank` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/cash-bank/');

const PAGE_SIZE = 20;

const today = () => new Date().toISOString().slice(0, 10);

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
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const canRead = usePermission('cash_bank.read');
	const canCreate = usePermission('cash_bank.create');
	const canUpdate = usePermission('cash_bank.update');
	const [settling, setSettling] = useState(false);
	const [payingTax, setPayingTax] = useState(false);

	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<TCashBankAccount | null>(null);

	const [movementAccountId, setMovementAccountId] = useState('none');
	const [movementDate, setMovementDate] = useState(today());
	const [movementDirection, setMovementDirection] = useState<'in' | 'out'>('in');
	const [movementAmount, setMovementAmount] = useState('');
	const [movementDescription, setMovementDescription] = useState('');
	const [counterpartAccountId, setCounterpartAccountId] = useState('none');

	const page = search.page ?? 1;
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

	const postMovement = useMutation({
		mutationFn: () =>
			postCashBankMovement({
				cashBankAccountId: movementAccountId,
				transactionDate: movementDate,
				direction: movementDirection,
				amount: toMinor(movementAmount),
				description: movementDescription || null,
				counterpartAccountId,
			}),
		onSuccess: async () => {
			toast.success(t('finance:cashBank.movementCreated'));
			setMovementAmount('');
			setMovementDescription('');
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

	// A movement needs a GL-linked account; the backend rejects it otherwise.
	const canPostMovement = canCreate && movementAccountId !== 'none';

	return (
		<div className='space-y-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-xl font-semibold'>{t('finance:cashBank.title')}</h1>
					<p className='text-muted-foreground text-sm'>
						{t('finance:cashBank.description')}
					</p>
				</div>
				{canCreate ? (
					<div className='flex gap-2'>
						<Button size='sm' variant='outline' onClick={() => setPayingTax(true)}>
							{t('finance:taxPayment.title')}
						</Button>
						<Button size='sm' variant='outline' onClick={() => setSettling(true)}>
							{t('finance:gatewaySettlement.title')}
						</Button>
						<Button size='sm' variant='outline' onClick={() => setCreating(true)}>
							<Plus className='size-4' data-icon='inline-start' />
							{t('finance:cashBank.create')}
						</Button>
					</div>
				) : null}
			</div>
			{settling ? <GatewaySettlementDialog accounts={accounts ?? []} onClose={() => setSettling(false)} /> : null}
			{payingTax ? <TaxPaymentDialog accounts={accounts ?? []} onClose={() => setPayingTax(false)} /> : null}

			{accountsError ? (
				<ErrorState error={accountsErr} bordered />
			) : !accountsPending && (accounts?.length ?? 0) === 0 ? (
				<EmptyState
					icon={Landmark}
					title={t('finance:cashBank.accountsEmpty')}
					bordered
				/>
			) : (
				<DataTableCard>
					<DataTable
						columns={accountColumns}
						data={accounts ?? []}
						loading={accountsPending}
						getRowId={(row) => row.id}
					/>
				</DataTableCard>
			)}

			{canCreate ? (
				<p className='text-muted-foreground text-xs'>{t('finance:cashBank.glLinkRequired')}</p>
			) : null}

			{canCreate ? (
				<div className='flex flex-wrap items-center gap-2 rounded-md border p-4'>
					<Select value={movementAccountId} onValueChange={(value: string | null) => setMovementAccountId(value ?? 'none')}>
						<SelectTrigger className='w-56'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='none'>{t('finance:payments.cashAccount')}</SelectItem>
							{accounts?.map((account) => (
								<SelectItem key={account.id} value={account.id}>
									{account.code} — {account.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<DatePicker
						className='w-40'
						value={movementDate}
						onChange={setMovementDate}
					/>
					<Select
						value={movementDirection}
						onValueChange={(value) =>
							setMovementDirection(value as 'in' | 'out')
						}
					>
						<SelectTrigger className='w-28'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='in'>
								{t('finance:cashBank.direction.in')}
							</SelectItem>
							<SelectItem value='out'>
								{t('finance:cashBank.direction.out')}
							</SelectItem>
						</SelectContent>
					</Select>
					<MoneyInput
						className='w-36'
						placeholder={t('finance:common.amount')}
						value={movementAmount}
						onValueChange={setMovementAmount}
					/>
					<Select value={counterpartAccountId} onValueChange={(value: string | null) => setCounterpartAccountId(value ?? 'none')}>
						<SelectTrigger className='w-64'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='none'>{t('finance:cashBank.counterpart')}</SelectItem>
							{glAccounts?.rows
								.filter(
									(account) =>
										account.isActive &&
										account.isPostable &&
										!account.code.startsWith('1-1'),
								)
								.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.code} — {account.name}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
					<Input
						className='w-56'
						placeholder={t('finance:common.description')}
						value={movementDescription}
						onChange={(event) => setMovementDescription(event.target.value)}
					/>
					<Button
						size='sm'
						disabled={
							!canPostMovement ||
							postMovement.isPending ||
							!movementAmount ||
							counterpartAccountId === 'none'
						}
						onClick={() => void postMovement.mutateAsync()}
					>
						{t('finance:cashBank.newMovement')}
					</Button>
				</div>
			) : null}

			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && (movements?.rows.length ?? 0) === 0 ? (
				<EmptyState
					icon={Landmark}
					title={t('finance:cashBank.movementsEmpty')}
					bordered
				/>
			) : (
				<DataTableCard title={t('finance:cashBank.movements')}>
					<DataTable
						columns={movementColumns}
						data={movements?.rows ?? []}
						loading={isPending}
						getRowId={(row) => row.id}
					/>
					<PaginationControls
						page={page}
						totalPages={movements?.pagination.totalPages ?? 1}
						onPageChange={(next) =>
							void navigate({ search: (prev) => ({ ...prev, page: next }) })
						}
					/>
				</DataTableCard>
			)}

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
