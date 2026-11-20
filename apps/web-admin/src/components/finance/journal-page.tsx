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
import { BookText, Plus, Trash2 } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	accountsQueryOptions,
	journalQueryOptions,
	postJournalEntry,
	reverseJournalEntry,
	toMinor,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/finance/journal` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/journal/');

const PAGE_SIZE = 20;

type TDraftLine = { accountId: string; debit: string; credit: string };

const today = () => new Date().toISOString().slice(0, 10);

/** Journal: entry list, manual posting, append-only reversal (F2). */
export function JournalPage() {
	const { t } = useTranslation(['finance', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const canRead = usePermission('journal.read');
	const canPost = usePermission('journal.post');

	const [showForm, setShowForm] = useState(false);
	const [entryDate, setEntryDate] = useState(today());
	const [description, setDescription] = useState('');
	const [lines, setLines] = useState<TDraftLine[]>([
		{ accountId: '', debit: '', credit: '' },
		{ accountId: '', debit: '', credit: '' },
	]);

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...journalQueryOptions({ page, limit: PAGE_SIZE }),
		placeholderData: (previous) => previous,
		enabled: canRead,
	});

	const { data: accounts } = useQuery({
		...accountsQueryOptions({ page: 1, limit: 100 }),
		enabled: canPost,
	});

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ['journal'] });
	};

	const post = useMutation({
		mutationFn: () =>
			postJournalEntry({
				entryDate,
				description: description || null,
				lines: lines
					.filter((line) => line.accountId)
					.map((line) => ({
						accountId: line.accountId,
						debit: toMinor(line.debit),
						credit: toMinor(line.credit),
					})),
			}),
		onSuccess: async () => {
			toast.success(t('finance:journal.posted'));
			setShowForm(false);
			setDescription('');
			setLines([
				{ accountId: '', debit: '', credit: '' },
				{ accountId: '', debit: '', credit: '' },
			]);
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const reverse = useMutation({
		mutationFn: (id: string) => reverseJournalEntry(id),
		onSuccess: async () => {
			toast.success(t('finance:journal.reversed'));
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const totalDebit = lines.reduce((sum, line) => sum + toMinor(line.debit), 0);
	const totalCredit = lines.reduce((sum, line) => sum + toMinor(line.credit), 0);
	const balanced = totalDebit === totalCredit && totalDebit > 0;

	if (!canRead) {
		return (
			<EmptyState icon={BookText} title={t('finance:journal.title')} className='border' />
		);
	}

	return (
		<div className='space-y-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-xl font-semibold'>{t('finance:journal.title')}</h1>
					<p className='text-muted-foreground text-sm'>
						{t('finance:journal.description')}
					</p>
				</div>
				{canPost ? (
					<Button size='sm' onClick={() => setShowForm((value) => !value)}>
						<Plus className='mr-1 size-4' />
						{t('finance:journal.newEntry')}
					</Button>
				) : null}
			</div>

			{canPost && showForm ? (
				<div className='space-y-3 rounded-md border p-4'>
					<div className='flex flex-wrap items-center gap-2'>
						<DatePicker
							className='w-44'
							value={entryDate}
							onChange={setEntryDate}
						/>
						<Input
							className='w-72'
							placeholder={t('finance:common.description')}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
						/>
					</div>
					<div className='space-y-2'>
						{lines.map((line, index) => (
							<div key={index} className='flex items-center gap-2'>
								<Select
									value={line.accountId === '' ? 'none' : line.accountId}
									onValueChange={(value: string | null) =>
										setLines((previous) =>
											previous.map((row, rowIndex) =>
												rowIndex === index
													? { ...row, accountId: value == null || value === 'none' ? '' : value }
													: row,
											),
										)
									}
								>
									<SelectTrigger className='w-72'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='none'>
											{t('finance:journal.line.account')}
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
								<Input
									className='w-36'
									placeholder={t('finance:journal.debit')}
									value={line.debit}
									onChange={(event) =>
										setLines((previous) =>
											previous.map((row, rowIndex) =>
												rowIndex === index
													? { ...row, debit: event.target.value, credit: '' }
													: row,
											),
										)
									}
								/>
								<Input
									className='w-36'
									placeholder={t('finance:journal.credit')}
									value={line.credit}
									onChange={(event) =>
										setLines((previous) =>
											previous.map((row, rowIndex) =>
												rowIndex === index
													? { ...row, credit: event.target.value, debit: '' }
													: row,
											),
										)
									}
								/>
								<Button
									variant='ghost'
									size='sm'
									disabled={lines.length <= 2}
									onClick={() =>
										setLines((previous) =>
											previous.filter((_, rowIndex) => rowIndex !== index),
										)
									}
								>
									<Trash2 className='size-4' />
								</Button>
							</div>
						))}
					</div>
					<div className='flex flex-wrap items-center gap-3 text-sm'>
						<Button
							variant='outline'
							size='sm'
							onClick={() =>
								setLines((previous) => [
									...previous,
									{ accountId: '', debit: '', credit: '' },
								])
							}
						>
							<Plus className='mr-1 size-4' />
							{t('finance:journal.line.add')}
						</Button>
						<span>
							{t('finance:journal.totalDebit')}: {totalDebit.toLocaleString()}
						</span>
						<span>
							{t('finance:journal.totalCredit')}: {totalCredit.toLocaleString()}
						</span>
						<Badge variant={balanced ? 'secondary' : 'destructive'}>
							{balanced
								? t('finance:journal.balance')
								: t('finance:journal.mustBalance')}
						</Badge>
						<Button
							size='sm'
							disabled={!balanced || post.isPending}
							onClick={() => void post.mutateAsync()}
						>
							{post.isPending
								? t('finance:journal.posting')
								: t('finance:journal.post')}
						</Button>
					</div>
					<p className='text-muted-foreground text-xs'>
						{t('finance:journal.line.oneSideOnly')}
					</p>
				</div>
			) : null}

			{isPending ? null : isError ? (
				<EmptyState icon={BookText} title={error.message} className='border' />
			) : (data?.rows.length ?? 0) === 0 ? (
				<EmptyState icon={BookText} title={t('finance:journal.empty')} className='border' />
			) : (
				<div className='overflow-x-auto rounded-md border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('finance:common.code')}</TableHead>
								<TableHead>{t('finance:journal.entryDate')}</TableHead>
								<TableHead>{t('finance:journal.source')}</TableHead>
								<TableHead>{t('finance:common.description')}</TableHead>
								<TableHead>{t('finance:common.status')}</TableHead>
								{canPost ? (
									<TableHead className='text-right'>
										{t('finance:common.actions')}
									</TableHead>
								) : null}
							</TableRow>
						</TableHeader>
						<TableBody>
							{data?.rows.map((entry) => (
								<TableRow key={entry.id}>
									<TableCell className='font-mono text-xs'>{entry.code}</TableCell>
									<TableCell>{entry.entryDate}</TableCell>
									<TableCell className='font-mono text-xs'>
										{entry.sourceModule}
										{entry.sourceType ? ` / ${entry.sourceType}` : ''}
									</TableCell>
									<TableCell className='max-w-72 truncate'>
										{entry.description ?? t('finance:common.none')}
									</TableCell>
									<TableCell>
										<Badge
											variant={
												entry.status === 'posted' ? 'secondary' : 'outline'
											}
										>
											{entry.status}
										</Badge>
									</TableCell>
									{canPost ? (
										<TableCell className='text-right'>
											{entry.status === 'posted' && !entry.reversedByEntryId ? (
												<Button
													variant='ghost'
													size='sm'
													disabled={reverse.isPending}
													onClick={() => {
														if (
															window.confirm(t('finance:journal.reverseConfirm'))
														) {
															void reverse.mutateAsync(entry.id);
														}
													}}
												>
													{t('finance:journal.reverse')}
												</Button>
											) : null}
										</TableCell>
									) : null}
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			<PaginationControls
				page={page}
				totalPages={data?.pagination.totalPages ?? 1}
				onPageChange={(next) =>
					void navigate({ search: (prev) => ({ ...prev, page: next }) })
				}
			/>
		</div>
	);
}
