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
import { BookText, Plus, Trash2 } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import {
	accountsQueryOptions,
	journalQueryOptions,
	postJournalEntry,
	reverseJournalEntry,
	toMinor,
	type TJournalEntry,
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
	const confirm = useConfirm();
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
	const totalCredit = lines.reduce(
		(sum, line) => sum + toMinor(line.credit),
		0,
	);
	const balanced = totalDebit === totalCredit && totalDebit > 0;

	const columns = useMemo<ColumnDef<DataTableFeatures, TJournalEntry, CellData>[]>(
		() => {
			const base: ColumnDef<DataTableFeatures, TJournalEntry, CellData>[] = [
				{
					accessorKey: 'code',
					header: t('finance:common.code'),
					meta: { cellClassName: 'font-mono text-xs' },
				},
				{ accessorKey: 'entryDate', header: t('finance:journal.entryDate') },
				{
					id: 'source',
					header: t('finance:journal.source'),
					meta: { cellClassName: 'font-mono text-xs' },
					cell: ({ row }) =>
						`${row.original.sourceModule}${row.original.sourceType ? ` / ${row.original.sourceType}` : ''}`,
				},
				{
					id: 'description',
					header: t('finance:common.description'),
					meta: { cellClassName: 'max-w-72 truncate' },
					cell: ({ row }) =>
						row.original.description ?? t('finance:common.none'),
				},
				{
					id: 'status',
					header: t('finance:common.status'),
					cell: ({ row }) => (
						<Badge
							variant={row.original.status === 'posted' ? 'secondary' : 'outline'}
						>
							{row.original.status}
						</Badge>
					),
				},
			];
			if (!canPost) return base;
			return [
				...base,
				{
					id: 'actions',
					header: t('finance:common.actions'),
					meta: { align: 'right' },
					cell: ({ row }) =>
						row.original.status === 'posted' && !row.original.reversedByEntryId ? (
							<Button
								variant='ghost'
								size='sm'
								disabled={reverse.isPending}
								onClick={async () => {
									if (
										await confirm({
											title: t('finance:journal.reverseConfirm'),
											destructive: true,
										})
									) {
										void reverse.mutateAsync(row.original.id);
									}
								}}
							>
								{t('finance:journal.reverse')}
							</Button>
						) : null,
				},
			];
		},
		[canPost, confirm, reverse, reverse.isPending, t],
	);

	if (!canRead) {
		return (
			<EmptyState
				icon={BookText}
				title={t('finance:journal.title')}
				bordered
			/>
		);
	}

	return (
		<div className='space-y-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-xl font-semibold'>
						{t('finance:journal.title')}
					</h1>
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
													? {
															...row,
															accountId:
																value == null || value === 'none' ? '' : value,
														}
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
											.filter(
												(account) => account.isActive && account.isPostable,
											)
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
				<EmptyState icon={BookText} title={error.message} bordered />
			) : (data?.rows.length ?? 0) === 0 ? (
				<EmptyState
					icon={BookText}
					title={t('finance:journal.empty')}
					bordered
				/>
			) : (
				<DataTable
					columns={columns}
					data={data?.rows ?? []}
					getRowId={(row) => row.id}
					bordered
				/>
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
