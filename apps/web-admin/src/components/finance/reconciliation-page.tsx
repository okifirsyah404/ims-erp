import { MoneyInput } from '@/components/money-input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	addReconciliationItems,
	cashBankAccountsQueryOptions,
	closeReconciliation,
	createReconciliation,
	matchReconciliationItem,
	cashBankTransactionsQueryOptions,
	reconcileReconciliation,
	reconciliationQueryOptions,
	reconciliationsQueryOptions,
	accountsQueryOptions,
	createStatementTransaction,
	type TBankReconciliation,
	type TBankReconciliationItem,
	toMinor,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';
import { StatementImportPanel } from './statement-import-panel';

const today = () => new Date().toISOString().slice(0, 10);

const formatMoney = (minor: number) => (minor / 100).toLocaleString();

const statusKey = (status: string) =>
	`finance:reconciliation.status.${status}` as const;

/** Bank reconciliation: statement items, matching, reconcile gate (F6). */
export function ReconciliationPage() {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const canRead = usePermission('cash_bank.read');
	const canReconcile = usePermission('cash_bank.reconcile');

	const [selectedId, setSelectedId] = useState<string | null>(null);

	/* create form */
	const [accountId, setAccountId] = useState('none');
	const [reconciliationDate, setReconciliationDate] = useState(today());
	const [statementBalance, setStatementBalance] = useState('');

	/* item form */
	const [statementReference, setStatementReference] = useState('');
	const [statementAmount, setStatementAmount] = useState('');

	const { data: page, isPending, isError, error } = useQuery({
		...reconciliationsQueryOptions({ page: 1, limit: 20 }),
		enabled: canRead,
	});

	const { data: accounts } = useQuery({
		...cashBankAccountsQueryOptions(),
		enabled: canReconcile,
	});

	// ERP-0143: the detail read carries the statement lines.
	const { data: detail } = useQuery({
		...reconciliationQueryOptions(selectedId ?? ''),
		enabled: canRead && selectedId != null,
	});
	const items: TBankReconciliationItem[] | undefined = detail?.items;
	const { data: postable } = useQuery({
		...accountsQueryOptions({ page: 1, limit: 200, isActive: true, isPostable: true }),
		enabled: canReconcile && selectedId != null,
	});

	const reconciliation = page?.rows.find((row) => row.id === selectedId) ?? null;

	const columns = useMemo<ColumnDef<DataTableFeatures, TBankReconciliation, CellData>[]>(
		() => [
			{
				accessorKey: 'code',
				header: t('finance:common.code'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{ accessorKey: 'reconciliationDate', header: t('finance:common.date') },
			{
				accessorKey: 'statementBalance',
				header: t('finance:reconciliation.statementBalance'),
				meta: { align: 'right' },
				cell: ({ row }) => formatMoney(row.original.statementBalance),
			},
			{
				accessorKey: 'bookBalance',
				header: t('finance:reconciliation.bookBalance'),
				meta: { align: 'right' },
				cell: ({ row }) => formatMoney(row.original.bookBalance),
			},
			{
				accessorKey: 'difference',
				header: t('finance:reconciliation.difference'),
				meta: { align: 'right' },
				cell: ({ row }) => formatMoney(row.original.difference),
			},
			{
				accessorKey: 'status',
				header: t('finance:common.status'),
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.status === 'closed'
								? 'outline'
								: row.original.status === 'reconciled'
									? 'secondary'
									: 'destructive'
						}
					>
						{t(`finance:${statusKey(row.original.status)}` as never)}
					</Badge>
				),
			},
			{
				id: 'items',
				header: () => <span className='sr-only'>{t('finance:reconciliation.items')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<Button
						size='sm'
						variant='outline'
						onClick={() => setSelectedId(row.original.id)}
					>
						{t('finance:reconciliation.items')}
					</Button>
				),
			},
		],
		[t],
	);

	const { data: movements } = useQuery({
		...cashBankTransactionsQueryOptions({
			page: 1,
			limit: 100,
			cashBankAccountId: reconciliation?.cashBankAccountId,
		}),
		enabled: canReconcile && reconciliation != null,
	});

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
	};

	const create = useMutation({
		mutationFn: () =>
			createReconciliation({
				cashBankAccountId: accountId,
				reconciliationDate,
				statementBalance: toMinor(statementBalance),
			}),
		onSuccess: async () => {
			toast.success(t('finance:reconciliation.created'));
			setStatementBalance('');
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const addItems = useMutation({
		mutationFn: () =>
			addReconciliationItems(selectedId ?? '', [
				{
					statementReference: statementReference || null,
					statementAmount: statementAmount ? toMinor(statementAmount) : null,
				},
			]),
		onSuccess: async () => {
			toast.success(t('finance:reconciliation.itemsAdded'));
			setStatementReference('');
			setStatementAmount('');
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const match = useMutation({
		mutationFn: (input: { itemId: string; cashBankTransactionId: string | null }) =>
			matchReconciliationItem(
				selectedId ?? '',
				input.itemId,
				input.cashBankTransactionId,
			),
		onSuccess: async () => {
			toast.success(t('finance:reconciliation.matchedDone'));
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const book = useMutation({
		mutationFn: (input: { itemId: string; accountId: string }) =>
			createStatementTransaction(selectedId ?? '', input.itemId, input.accountId),
		onSuccess: async () => {
			toast.success(t('finance:statement.booked'));
			invalidate();
			void queryClient.invalidateQueries({ queryKey: ['cash-bank-transactions'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const reconcile = useMutation({
		mutationFn: () => reconcileReconciliation(selectedId ?? ''),
		onSuccess: async () => {
			toast.success(t('finance:reconciliation.reconciled'));
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const close = useMutation({
		mutationFn: () => closeReconciliation(selectedId ?? ''),
		onSuccess: async () => {
			toast.success(t('finance:reconciliation.closed'));
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	if (!canRead) {
		return (
			<EmptyState icon={Landmark} title={t('finance:reconciliation.title')} bordered />
		);
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('finance:reconciliation.title')}</h1>
				<p className='text-muted-foreground text-sm'>
					{t('finance:reconciliation.description')}
				</p>
			</div>

			{canReconcile ? (
				<div className='flex flex-wrap items-center gap-2 rounded-md border p-4'>
					<Select value={accountId} onValueChange={(value: string | null) => setAccountId(value ?? 'none')}>
						<SelectTrigger className='w-56'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='none'>{t('finance:reconciliation.cashAccount')}</SelectItem>
							{accounts?.map((account) => (
								<SelectItem key={account.id} value={account.id}>
									{account.code} — {account.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<DatePicker
						className='w-40'
						value={reconciliationDate}
						onChange={setReconciliationDate}
					/>
					<MoneyInput
						className='w-40'
						placeholder={t('finance:reconciliation.statementBalance')}
						value={statementBalance}
						onValueChange={setStatementBalance}
					/>
					<Button
						size='sm'
						disabled={create.isPending || accountId === 'none' || !statementBalance}
						onClick={() => void create.mutateAsync()}
					>
						<Plus className='size-4' data-icon='inline-start' />
						{t('finance:reconciliation.create')}
					</Button>
				</div>
			) : null}

			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && (page?.rows.length ?? 0) === 0 ? (
					<EmptyState icon={Landmark} title={t('finance:reconciliation.empty')} />
				) : (
					<DataTable
						columns={columns}
						data={page?.rows ?? []}
						loading={isPending}
						getRowId={(row) => row.id}
						rowClassName={(row) =>
							selectedId === row.id ? 'bg-muted/50' : undefined
						}
					/>
				)}
			</DataTableCard>

			{selectedId != null && reconciliation ? (
				<div className='space-y-3 rounded-md border p-4'>
					<h2 className='font-semibold'>
						{t('finance:reconciliation.items')} — {reconciliation.code}
					</h2>

					{canReconcile && (reconciliation.status === 'draft' || reconciliation.status === 'in_progress') ? (
						<StatementImportPanel
							reconciliationId={reconciliation.id}
							cashBankAccountId={reconciliation.cashBankAccountId}
							mapping={accounts?.find((account) => account.id === reconciliation.cashBankAccountId)?.statementMapping ?? null}
						/>
					) : null}

					{canReconcile && reconciliation.status !== 'closed' ? (
						<div className='flex flex-wrap items-center gap-2'>
							<Input
								className='w-56'
								placeholder={t('finance:reconciliation.statementReference')}
								value={statementReference}
								onChange={(event) => setStatementReference(event.target.value)}
							/>
							<MoneyInput
								className='w-40'
								placeholder={t('finance:reconciliation.statementAmount')}
								value={statementAmount}
								onValueChange={setStatementAmount}
							/>
							<Button
								size='sm'
								variant='outline'
								disabled={addItems.isPending || !statementAmount}
								onClick={() => void addItems.mutateAsync()}
							>
								{t('finance:reconciliation.addItems')}
							</Button>
						</div>
					) : null}

					{(items?.length ?? 0) === 0 ? (
						<p className='text-muted-foreground text-sm'>{t('finance:common.empty')}</p>
					) : (
						<div className='space-y-1'>
							{items?.map((item) => (
								<div
									key={item.id}
									className='flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm'
								>
									<span>
										{item.statementDate ? <span className='text-muted-foreground mr-2 text-xs'>{item.statementDate}</span> : null}
										<span className='font-mono text-xs'>
											{item.statementReference ?? (item.description ? '' : item.id.slice(0, 8))}
										</span>{' '}
										{item.description ? <span className='mr-2'>{item.description}</span> : null}
										{item.direction === 'out' ? '−' : item.direction === 'in' ? '+' : ''}
										{item.statementAmount != null
											? formatMoney(item.statementAmount)
											: ''}
										{item.matchMethod ? (
											<span className='text-muted-foreground ml-2 text-xs'>
												{t(`finance:statement.method.${item.matchMethod}`)}
											</span>
										) : null}
									</span>
									<span className='flex items-center gap-2'>
										<Badge variant={item.isMatched ? 'secondary' : 'outline'}>
											{item.isMatched
												? t('finance:reconciliation.matched')
												: t('finance:reconciliation.unmatched')}
										</Badge>
										{canReconcile && !item.isMatched && reconciliation.status !== 'closed' ? (
											<Select
												value='none'
												disabled={match.isPending}
												onValueChange={(value: string | null) =>
													void match.mutateAsync({
														itemId: item.id,
														cashBankTransactionId: value == null || value === 'none' ? null : value,
													})
												}
											>
												<SelectTrigger className='w-56 text-xs'>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value='none'>
														{t('finance:reconciliation.match')}
													</SelectItem>
													{movements?.rows.map((movement) => (
														<SelectItem key={movement.id} value={movement.id}>
															{movement.transactionDate}{' '}
															{movement.direction === 'in' ? '+' : '−'}
															{formatMoney(movement.amount)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										) : null}
										{canReconcile && !item.isMatched && item.direction && reconciliation.status !== 'closed' ? (
											<Select
												value='none'
												disabled={book.isPending}
												onValueChange={(value: string | null) => {
													if (value && value !== 'none') void book.mutateAsync({ itemId: item.id, accountId: value });
												}}
											>
												<SelectTrigger className='w-56 text-xs'>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value='none'>{t('finance:statement.bookAs')}</SelectItem>
													{postable?.rows.map((account) => (
														<SelectItem key={account.id} value={account.id}>
															{account.code} — {account.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										) : null}
									</span>
								</div>
							))}
						</div>
					)}

					{canReconcile ? (
						<div className='flex gap-2'>
							{reconciliation.status === 'draft' ||
							reconciliation.status === 'in_progress' ? (
								<Button
									size='sm'
									disabled={reconcile.isPending}
									onClick={() => void reconcile.mutateAsync()}
								>
									{t('finance:reconciliation.reconcile')}
								</Button>
							) : null}
							{reconciliation.status === 'reconciled' ? (
								<Button
									size='sm'
									variant='outline'
									disabled={close.isPending}
									onClick={() => void close.mutateAsync()}
								>
									{t('finance:reconciliation.close')}
								</Button>
							) : null}
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}
