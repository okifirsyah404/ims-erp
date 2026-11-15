import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Scale, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	accountsQueryOptions,
	addOpeningBalanceRow,
	openingBalancesQueryOptions,
	postOpeningBalances,
	removeOpeningBalanceRow,
	toMinor,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

const today = () => new Date().toISOString().slice(0, 10);

const formatMoney = (minor: number) => (minor / 100).toLocaleString();

/** Opening balances: draft batch + one-shot post as ONE journal entry (F3). */
export function OpeningBalancePage() {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const canRead = usePermission('journal.read');
	const canEdit = usePermission('journal.update');
	const canPost = usePermission('journal.post');

	const [accountId, setAccountId] = useState('none');
	const [asOfDate, setAsOfDate] = useState(today());
	const [debit, setDebit] = useState('');
	const [credit, setCredit] = useState('');

	const { data: rows, isPending, isError, error } = useQuery({
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
	const totalCredit = draftRows.reduce((sum, row) => sum + row.creditBalance, 0);
	const balanced = totalDebit === totalCredit && totalDebit > 0;
	const hasPosted = rows?.some((row) => row.postedAt != null) ?? false;

	if (!canRead) {
		return (
			<EmptyState icon={Scale} title={t('finance:opening.title')} className='border' />
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
					<Select value={accountId} onValueChange={(value: string | null) => setAccountId(value ?? 'none')}>
						<SelectTrigger className='w-72'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='none'>{t('finance:opening.account')}</SelectItem>
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
					<Input
						className='w-40'
						placeholder={t('finance:opening.debit')}
						value={debit}
						onChange={(event) => setDebit(event.target.value)}
					/>
					<Input
						className='w-40'
						placeholder={t('finance:opening.credit')}
						value={credit}
						onChange={(event) => setCredit(event.target.value)}
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

			{isPending ? null : isError ? (
				<EmptyState icon={Scale} title={error.message} className='border' />
			) : (rows?.length ?? 0) === 0 ? (
				<EmptyState icon={Scale} title={t('finance:opening.empty')} className='border' />
			) : (
				<div className='overflow-x-auto rounded-md border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('finance:opening.account')}</TableHead>
								<TableHead>{t('finance:opening.asOf')}</TableHead>
								<TableHead className='text-right'>{t('finance:opening.debit')}</TableHead>
								<TableHead className='text-right'>{t('finance:opening.credit')}</TableHead>
								<TableHead>{t('finance:common.status')}</TableHead>
								{canEdit && !hasPosted ? (
									<TableHead className='text-right'>
										{t('finance:common.actions')}
									</TableHead>
								) : null}
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows?.map((row) => {
								const account = accounts?.rows.find(
									(item) => item.id === row.accountId,
								);
								return (
									<TableRow key={row.id}>
										<TableCell>
											{account ? `${account.code} — ${account.name}` : row.accountId}
										</TableCell>
										<TableCell>{row.asOfDate}</TableCell>
										<TableCell className='text-right'>
											{formatMoney(row.debitBalance)}
										</TableCell>
										<TableCell className='text-right'>
											{formatMoney(row.creditBalance)}
										</TableCell>
										<TableCell>
											<Badge variant={row.postedAt ? 'secondary' : 'outline'}>
												{row.postedAt ? t('finance:opening.posted') : t('payments.status.draft')}
											</Badge>
										</TableCell>
										{canEdit && !hasPosted && row.postedAt == null ? (
											<TableCell className='text-right'>
												<Button
													variant='ghost'
													size='sm'
													className='mr-1'
													disabled={removeRow.isPending}
													onClick={() => {
														if (window.confirm(t('finance:opening.removeConfirm'))) {
															void removeRow.mutateAsync(row.id);
														}
													}}
												>
													<Trash2 className='size-4' />
												</Button>
											</TableCell>
										) : null}
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}

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
						onClick={() => {
							if (window.confirm(t('finance:opening.postBatch') + '?')) {
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
