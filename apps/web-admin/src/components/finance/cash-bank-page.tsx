import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { Landmark, Plus } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	accountsQueryOptions,
	cashBankAccountsQueryOptions,
	cashBankTransactionsQueryOptions,
	createCashBankAccount,
	postCashBankMovement,
	toMinor,
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

	const [movementAccountId, setMovementAccountId] = useState('none');
	const [movementDate, setMovementDate] = useState(today());
	const [movementDirection, setMovementDirection] = useState<'in' | 'out'>('in');
	const [movementAmount, setMovementAmount] = useState('');
	const [movementDescription, setMovementDescription] = useState('');
	const [counterpartAccountId, setCounterpartAccountId] = useState('none');

	const page = search.page ?? 1;
	const { data: accounts, isError: accountsError, error: accountsErr } = useQuery({
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
		onSuccess: async () => {
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

	if (!canRead) {
		return (
			<EmptyState icon={Landmark} title={t('finance:cashBank.title')} className='border' />
		);
	}

	const selectedAccount = accounts?.find(
		(account) => account.id === movementAccountId,
	);
	const glLinked = selectedAccount?.glAccountId != null;
	const canPostMovement = canCreate && glLinked && movementAccountId !== 'none';

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
						<Plus className='mr-1 size-4' />
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
					<Input
						className='w-40'
						placeholder={t('finance:cashBank.openingBalance')}
						value={openingBalance}
						onChange={(event) => setOpeningBalance(event.target.value)}
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
				<EmptyState icon={Landmark} title={accountsErr.message} className='border' />
			) : (accounts?.length ?? 0) === 0 ? (
				<EmptyState
					icon={Landmark}
					title={t('finance:cashBank.accountsEmpty')}
					className='border'
				/>
			) : (
				<div className='overflow-x-auto rounded-md border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('finance:common.code')}</TableHead>
								<TableHead>{t('finance:common.name')}</TableHead>
								<TableHead>{t('finance:cashBank.accountType')}</TableHead>
								<TableHead className='text-right'>
									{t('finance:cashBank.currentBalance')}
								</TableHead>
								<TableHead>{t('finance:cashBank.glLink')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{accounts?.map((account) => (
								<TableRow key={account.id}>
									<TableCell className='font-mono text-xs'>{account.code}</TableCell>
									<TableCell>{account.name}</TableCell>
									<TableCell>
										{t(
											account.accountType === 'cash'
												? 'finance:accountType.cash'
												: 'finance:accountType.bank',
										)}
									</TableCell>
									<TableCell className='text-right'>
										{formatMoney(account.currentBalance)}
									</TableCell>
									<TableCell>
										{canUpdate ? (
											<Select
												value={account.glAccountId ?? 'none'}
												disabled={linkGl.isPending}
												onValueChange={(value: string | null) =>
													void linkGl.mutateAsync({
														id: account.id,
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
										) : account.glAccountId ? (
											<Badge variant='secondary'>{t('finance:accounts.isActive')}</Badge>
										) : (
											<Badge variant='destructive'>
												{t('finance:cashBank.glLinkRequired')}
											</Badge>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			<h2 className='pt-2 font-semibold'>{t('finance:cashBank.movements')}</h2>

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
					<Input
						className='w-36'
						placeholder={t('finance:common.amount')}
						value={movementAmount}
						onChange={(event) => setMovementAmount(event.target.value)}
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

			{isPending ? null : isError ? (
				<EmptyState icon={Landmark} title={error.message} className='border' />
			) : (movements?.rows.length ?? 0) === 0 ? (
				<EmptyState
					icon={Landmark}
					title={t('finance:cashBank.movementsEmpty')}
					className='border'
				/>
			) : (
				<div className='overflow-x-auto rounded-md border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('finance:cashBank.movementDate')}</TableHead>
								<TableHead>{t('finance:common.code')}</TableHead>
								<TableHead>{t('finance:cashBank.direction.in')} / {t('finance:cashBank.direction.out')}</TableHead>
								<TableHead className='text-right'>{t('finance:common.amount')}</TableHead>
								<TableHead className='text-right'>{t('finance:cashBank.balanceAfter')}</TableHead>
								<TableHead>{t('finance:common.description')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{movements?.rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell>{row.transactionDate}</TableCell>
									<TableCell className='font-mono text-xs'>{row.id.slice(0, 8)}</TableCell>
									<TableCell>
										<Badge
											variant={row.direction === 'in' ? 'secondary' : 'outline'}
										>
											{row.direction === 'in'
												? t('finance:cashBank.direction.in')
												: t('finance:cashBank.direction.out')}
										</Badge>
									</TableCell>
									<TableCell className='text-right'>{formatMoney(row.amount)}</TableCell>
									<TableCell className='text-right'>
										{formatMoney(row.balanceAfter)}
									</TableCell>
									<TableCell className='max-w-72 truncate'>
										{row.description ?? t('finance:common.none')}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			<PaginationControls
				page={page}
				totalPages={movements?.pagination.totalPages ?? 1}
				onPageChange={(next) =>
					void navigate({ search: (prev) => ({ ...prev, page: next }) })
				}
			/>
		</div>
	);
}
