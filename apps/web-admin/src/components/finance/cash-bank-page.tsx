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
import { Landmark, Plus } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
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

/** The route API for `/finance/cash-bank` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/cash-bank/');

const PAGE_SIZE = 20;

const today = () => new Date().toISOString().slice(0, 10);

const formatMoney = (minor: number) => (minor / 100).toLocaleString();

/** Cash & bank: accounts with GL links + movement ledger (F3). */
export function CashBankPage() {
	const { t } = useTranslation(['finance', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const canRead = usePermission('cash_bank.read');
	const canCreate = usePermission('cash_bank.create');
	const canUpdate = usePermission('cash_bank.update');

	const [showAccountForm, setShowAccountForm] = useState(false);
	const [code, setCode] = useState('');
	const [name, setName] = useState('');
	const [accountType, setAccountType] = useState<'bank' | 'cash'>('bank');
	const [bankName, setBankName] = useState('');
	const [openingBalance, setOpeningBalance] = useState('');
	const [glAccountId, setGlAccountId] = useState('none');
	// The backend does not return the GL link of an account (it lives in a link
	// table), so show the links set in this session only.
	const [linkedGl, setLinkedGl] = useState<Record<string, string>>({});

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
		enabled: canCreate || canUpdate,
	});

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ['cash-bank-accounts'] });
		void queryClient.invalidateQueries({ queryKey: ['cash-bank-transactions'] });
	};

	const createAccount = useMutation({
		mutationFn: () =>
			createCashBankAccount({
				code,
				name,
				accountType,
				bankName: bankName || null,
				openingBalance: toMinor(openingBalance),
				glAccountId: glAccountId === 'none' ? null : glAccountId,
			}),
		onSuccess: async () => {
			toast.success(t('finance:cashBank.created'));
			setShowAccountForm(false);
			setCode('');
			setName('');
			setBankName('');
			setOpeningBalance('');
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const linkGl = useMutation({
		mutationFn: (input: { id: string; glAccountId: string | null }) =>
			updateCashBankAccount(input.id, { glAccountId: input.glAccountId }),
		onSuccess: async (_account, input) => {
			setLinkedGl((previous) => ({ ...previous, [input.id]: input.glAccountId ?? 'none' }));
			toast.success(t('finance:cashBank.updated'));
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
						row.original.accountType === 'cash'
							? 'finance:accountType.cash'
							: 'finance:accountType.bank',
					),
			},
			{
				id: 'currentBalance',
				header: t('finance:cashBank.currentBalance'),
				meta: { align: 'right' },
				cell: ({ row }) => formatMoney(row.original.currentBalance),
			},
		];
		if (!canUpdate) return base;
		return [
			...base,
			{
				id: 'glLink',
				header: t('finance:cashBank.glLink'),
				cell: ({ row }) => (
					<Select
						value={linkedGl[row.original.id] ?? 'none'}
						disabled={linkGl.isPending}
						onValueChange={(value: string | null) =>
							void linkGl.mutateAsync({
								id: row.original.id,
								glAccountId: value == null || value === 'none' ? null : value,
							})
						}
					>
						<SelectTrigger className='w-56 text-xs'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='none'>{t('finance:common.none')}</SelectItem>
							{glAccounts?.rows
								.filter((gl) => gl.isActive && gl.isPostable)
								.map((gl) => (
									<SelectItem key={gl.id} value={gl.id}>
										{gl.code} — {gl.name}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
				),
			},
		];
	}, [canUpdate, glAccounts, linkGl, linkedGl, t]);

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
					<Button
						size='sm'
						variant='outline'
						onClick={() => setShowAccountForm((value) => !value)}
					>
						<Plus className='size-4' data-icon='inline-start' />
						{t('finance:cashBank.create')}
					</Button>
				) : null}
			</div>

			{canCreate && showAccountForm ? (
				<div className='flex flex-wrap items-center gap-2 rounded-md border p-4'>
					<Input
						className='w-28'
						placeholder={t('finance:common.code')}
						value={code}
						onChange={(event) => setCode(event.target.value)}
					/>
					<Input
						className='w-48'
						placeholder={t('finance:common.name')}
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
					<Select
						value={accountType}
						onValueChange={(value) => setAccountType(value as 'bank' | 'cash')}
					>
						<SelectTrigger className='w-32'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='bank'>{t('finance:accountType.bank')}</SelectItem>
							<SelectItem value='cash'>{t('finance:accountType.cash')}</SelectItem>
						</SelectContent>
					</Select>
					<Input
						className='w-40'
						placeholder={t('finance:cashBank.bankName')}
						value={bankName}
						onChange={(event) => setBankName(event.target.value)}
					/>
					<MoneyInput
						className='w-40'
						placeholder={t('finance:cashBank.openingBalance')}
						value={openingBalance}
						onValueChange={setOpeningBalance}
					/>
					<Select value={glAccountId} onValueChange={(value: string | null) => setGlAccountId(value ?? 'none')}>
						<SelectTrigger className='w-64'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='none'>{t('finance:cashBank.glLink')} — {t('finance:common.none')}</SelectItem>
							{glAccounts?.rows
								.filter((account) => account.isActive && account.isPostable)
								.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.code} — {account.name}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
					<Button
						size='sm'
						disabled={createAccount.isPending || !code || !name}
						onClick={() => void createAccount.mutateAsync()}
					>
						{createAccount.isPending
							? t('finance:common.creating')
							: t('finance:common.create')}
					</Button>
				</div>
			) : null}

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
		</div>
	);
}
