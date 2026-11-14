import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
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
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	addReconciliationItems,
	cashBankAccountsQueryOptions,
	closeReconciliation,
	createReconciliation,
	matchReconciliationItem,
	cashBankTransactionsQueryOptions,
	reconcileReconciliation,
	reconciliationItemsQueryOptions,
	reconciliationsQueryOptions,
	toMinor,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

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

	const { data: items } = useQuery({
		...reconciliationItemsQueryOptions(selectedId ?? ''),
		enabled: canRead && selectedId != null,
	});

	const reconciliation = page?.rows.find((row) => row.id === selectedId) ?? null;

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
			<EmptyState icon={Landmark} title={t('finance:reconciliation.title')} className='border' />
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
					<Input
						type='date'
						className='w-40'
						value={reconciliationDate}
						onChange={(event) => setReconciliationDate(event.target.value)}
					/>
					<Input
						className='w-40'
						placeholder={t('finance:reconciliation.statementBalance')}
						value={statementBalance}
						onChange={(event) => setStatementBalance(event.target.value)}
					/>
					<Button
						size='sm'
						disabled={create.isPending || accountId === 'none' || !statementBalance}
						onClick={() => void create.mutateAsync()}
					>
						<Plus className='mr-1 size-4' />
						{t('finance:reconciliation.create')}
					</Button>
				</div>
			) : null}

			{isPending ? null : isError ? (
				<EmptyState icon={Landmark} title={error.message} className='border' />
			) : (page?.rows.length ?? 0) === 0 ? (
				<EmptyState icon={Landmark} title={t('finance:reconciliation.empty')} className='border' />
			) : (
				<div className='overflow-x-auto rounded-md border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('finance:common.code')}</TableHead>
								<TableHead>{t('finance:common.date')}</TableHead>
								<TableHead className='text-right'>{t('finance:reconciliation.statementBalance')}</TableHead>
								<TableHead className='text-right'>{t('finance:reconciliation.bookBalance')}</TableHead>
								<TableHead className='text-right'>{t('finance:reconciliation.difference')}</TableHead>
								<TableHead>{t('finance:common.status')}</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{page?.rows.map((row) => (
								<TableRow
									key={row.id}
									className={selectedId === row.id ? 'bg-muted/50' : undefined}
								>
									<TableCell className='font-mono text-xs'>{row.code}</TableCell>
									<TableCell>{row.reconciliationDate}</TableCell>
									<TableCell className='text-right'>{formatMoney(row.statementBalance)}</TableCell>
									<TableCell className='text-right'>{formatMoney(row.bookBalance)}</TableCell>
									<TableCell className='text-right'>{formatMoney(row.difference)}</TableCell>
									<TableCell>
										<Badge
											variant={
												row.status === 'closed'
													? 'outline'
													: row.status === 'reconciled'
														? 'secondary'
														: 'destructive'
											}
										>
											{t(`finance:${statusKey(row.status)}` as never)}
										</Badge>
									</TableCell>
									<TableCell className='text-right'>
										<Button size='sm' variant='outline' onClick={() => setSelectedId(row.id)}>
											{t('finance:reconciliation.items')}
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			{selectedId != null && reconciliation ? (
				<div className='space-y-3 rounded-md border p-4'>
					<h2 className='font-semibold'>
						{t('finance:reconciliation.items')} — {reconciliation.code}
					</h2>

					{canReconcile && reconciliation.status !== 'closed' ? (
						<div className='flex flex-wrap items-center gap-2'>
							<Input
								className='w-56'
								placeholder={t('finance:reconciliation.statementReference')}
								value={statementReference}
								onChange={(event) => setStatementReference(event.target.value)}
							/>
							<Input
								className='w-40'
								placeholder={t('finance:reconciliation.statementAmount')}
								value={statementAmount}
								onChange={(event) => setStatementAmount(event.target.value)}
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
										<span className='font-mono text-xs'>
											{item.statementReference ?? item.id.slice(0, 8)}
										</span>{' '}
										{item.statementAmount != null
											? formatMoney(item.statementAmount)
											: ''}
									</span>
									<span className='flex items-center gap-2'>
										<Badge variant={item.matchedAt ? 'secondary' : 'outline'}>
											{item.matchedAt
												? t('finance:reconciliation.matched')
												: t('finance:reconciliation.unmatched')}
										</Badge>
										{canReconcile && !item.matchedAt && reconciliation.status !== 'closed' ? (
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
												<SelectTrigger className='w-64 text-xs'>
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
