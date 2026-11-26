import { MoneyInput } from '@/components/money-input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
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
import { BookText, CheckCheck, Plus, Send, Trash2, Undo2, X } from 'lucide-react';
import { RowActions } from '@/components/data-table/row-actions';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import { FieldLabel } from '@/components/form/field-label';
import {
	accountsQueryOptions,
	approveJournalEntry,
	costCentersQueryOptions,
	createJournalDraft,
	JOURNAL_STATUSES,
	journalQueryOptions,
	rejectJournalEntry,
	reverseJournalEntry,
	submitJournalEntry,
	toMinor,
	type TJournalEntry,
	type TJournalStatus,
	voidJournalEntry,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';
import { ReasonDialog } from './reason-dialog';

/** The route API for `/finance/journal` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/journal/');

const PAGE_SIZE = 20;
const NONE = 'none';
const ALL = 'all';

type TDraftLine = { accountId: string; costCenterId: string; debit: string; credit: string };

const emptyLine = (): TDraftLine => ({ accountId: '', costCenterId: '', debit: '', credit: '' });
const today = () => new Date().toISOString().slice(0, 10);

const STATUS_VARIANT: Record<TJournalStatus, 'secondary' | 'outline' | 'destructive' | 'default'> = {
	draft: 'outline',
	submitted: 'default',
	approved: 'secondary',
	posted: 'secondary',
	reversed: 'outline',
	void: 'destructive',
};

/**
 * Journal: entry list and the manual-journal lifecycle (ERP-0129): draft ->
 * submit -> approve/post (maker-checker, enforced server-side) or reject /
 * discard; posted entries are corrected only by a reversal with a reason.
 */
export function JournalPage() {
	const { t } = useTranslation(['finance', 'common']);
	const confirm = useConfirm();
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const canRead = usePermission('journal.read');
	const canCreate = usePermission('journal.create');
	const canSubmit = usePermission('journal.submit');
	const canApprove = usePermission('journal.approve');
	const canUpdate = usePermission('journal.update');
	const canReverse = usePermission('journal.reverse');
	const canReadCostCenters = usePermission('cost_center.read');

	const [showForm, setShowForm] = useState(false);
	const [entryDate, setEntryDate] = useState(today());
	const [description, setDescription] = useState('');
	const [isAdjusting, setIsAdjusting] = useState(false);
	const [lines, setLines] = useState<TDraftLine[]>([emptyLine(), emptyLine()]);
	const [reasonFor, setReasonFor] = useState<{ kind: 'reject' | 'reverse'; entry: TJournalEntry } | null>(null);

	const page = search.page ?? 1;
	const status = search.status;
	const { data, isPending, isError, error } = useQuery({
		...journalQueryOptions({ page, limit: PAGE_SIZE, status }),
		placeholderData: (previous) => previous,
		enabled: canRead,
	});

	const { data: accounts } = useQuery({
		...accountsQueryOptions({ page: 1, limit: 100 }),
		enabled: canCreate,
	});
	const { data: costCenters } = useQuery({
		...costCentersQueryOptions({ page: 1, limit: 100, isActive: true }),
		enabled: canCreate && canReadCostCenters,
	});

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ['journal'] });
	};
	const onError = (mutationError: Error) => toast.error(mutationError.message);

	const saveDraft = useMutation({
		mutationFn: () =>
			createJournalDraft({
				entryDate,
				description: description || null,
				isAdjusting,
				lines: lines
					.filter((line) => line.accountId)
					.map((line) => ({
						accountId: line.accountId,
						costCenterId: line.costCenterId || null,
						debit: toMinor(line.debit),
						credit: toMinor(line.credit),
					})),
			}),
		onSuccess: () => {
			toast.success(t('finance:journal.drafted'));
			setShowForm(false);
			setDescription('');
			setIsAdjusting(false);
			setLines([emptyLine(), emptyLine()]);
			invalidate();
		},
		onError,
	});

	const transition = useMutation({
		mutationFn: async (input: { kind: 'submit' | 'approve' | 'void'; id: string }) => {
			if (input.kind === 'submit') return submitJournalEntry(input.id);
			if (input.kind === 'approve') return approveJournalEntry(input.id);
			return voidJournalEntry(input.id);
		},
		onSuccess: (_entry, input) => {
			toast.success(
				input.kind === 'submit'
					? t('finance:journal.submitted')
					: input.kind === 'approve'
						? t('finance:journal.approved')
						: t('finance:journal.voided'),
			);
			invalidate();
		},
		onError,
	});

	const withReason = useMutation({
		mutationFn: async (input: { kind: 'reject' | 'reverse'; id: string; reason: string }) =>
			input.kind === 'reject'
				? rejectJournalEntry(input.id, input.reason)
				: reverseJournalEntry(input.id, { reason: input.reason }),
		onSuccess: (_entry, input) => {
			toast.success(input.kind === 'reject' ? t('finance:journal.rejected') : t('finance:journal.reversed'));
			setReasonFor(null);
			invalidate();
		},
		onError,
	});

	const totalDebit = lines.reduce((sum, line) => sum + toMinor(line.debit), 0);
	const totalCredit = lines.reduce((sum, line) => sum + toMinor(line.credit), 0);
	const balanced = totalDebit === totalCredit && totalDebit > 0;
	const busy = transition.isPending || withReason.isPending;

	const columns = useMemo<ColumnDef<DataTableFeatures, TJournalEntry, CellData>[]>(() => {
		const base: ColumnDef<DataTableFeatures, TJournalEntry, CellData>[] = [
			{
				id: 'code',
				header: t('finance:common.code'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => row.original.code ?? t('finance:journal.unnumbered'),
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
				cell: ({ row }) => row.original.description ?? t('finance:common.none'),
			},
			{
				id: 'amount',
				header: t('finance:common.amount'),
				meta: { align: 'right' },
				cell: ({ row }) => (row.original.totalDebit / 100).toLocaleString(),
			},
			{
				id: 'status',
				header: t('finance:common.status'),
				cell: ({ row }) => (
					<div className='flex items-center gap-1'>
						<Badge variant={STATUS_VARIANT[row.original.status]}>
							{t(`finance:journal.status.${row.original.status}`)}
						</Badge>
						{row.original.isAdjusting ? (
							<Badge variant='outline'>{t('finance:journal.adjusting')}</Badge>
						) : null}
					</div>
				),
			},
		];
		if (!(canSubmit || canApprove || canUpdate || canReverse)) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('finance:common.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => {
					const entry = row.original;
					return (
						<RowActions
							label={t('finance:common.actions')}
							disabled={busy}
							actions={[
								{
									key: 'submit',
									label: t('finance:journal.submit'),
									icon: Send,
									hidden: !(canSubmit && entry.status === 'draft'),
									onSelect: () => void transition.mutateAsync({ kind: 'submit', id: entry.id }),
								},
								{
									key: 'approve',
									label: t('finance:journal.approve'),
									icon: CheckCheck,
									hidden: !(canApprove && entry.status === 'submitted'),
									onSelect: async () => {
										if (await confirm({ title: t('finance:journal.approveConfirm') })) {
											void transition.mutateAsync({ kind: 'approve', id: entry.id });
										}
									},
								},
								{
									key: 'reject',
									label: t('finance:journal.reject'),
									icon: X,
									hidden: !(canApprove && entry.status === 'submitted'),
									onSelect: () => setReasonFor({ kind: 'reject', entry }),
								},
								{
									key: 'void',
									label: t('finance:journal.void'),
									icon: Trash2,
									destructive: true,
									hidden: !(canUpdate && (entry.status === 'draft' || entry.status === 'submitted')),
									onSelect: async () => {
										if (await confirm({ title: t('finance:journal.voidConfirm'), destructive: true })) {
											void transition.mutateAsync({ kind: 'void', id: entry.id });
										}
									},
								},
								{
									key: 'reverse',
									label: t('finance:journal.reverse'),
									icon: Undo2,
									destructive: true,
									hidden: !(canReverse && entry.status === 'posted' && !entry.reversedByEntryId),
									onSelect: () => setReasonFor({ kind: 'reverse', entry }),
								},
							]}
						/>
					);
				},
			},
		];
	}, [busy, canApprove, canReverse, canSubmit, canUpdate, confirm, t, transition]);

	if (!canRead) {
		return <EmptyState icon={BookText} title={t('finance:journal.title')} bordered />;
	}

	const setLine = (index: number, patch: Partial<TDraftLine>) =>
		setLines((previous) => previous.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));

	return (
		<div className='space-y-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-xl font-semibold'>{t('finance:journal.title')}</h1>
					<p className='text-muted-foreground text-sm'>{t('finance:journal.description')}</p>
				</div>
				{canCreate ? (
					<Button size='sm' onClick={() => setShowForm((value) => !value)}>
						<Plus className='size-4' data-icon='inline-start' />
						{t('finance:journal.newEntry')}
					</Button>
				) : null}
			</div>

			{canCreate && showForm ? (
				<div className='space-y-3 rounded-md border p-4'>
					<p className='text-muted-foreground text-xs'>{t('finance:journal.makerChecker')}</p>
					<div className='flex flex-wrap items-center gap-3'>
						<DatePicker className='w-44' value={entryDate} onChange={setEntryDate} />
						<Input
							className='w-72'
							placeholder={t('finance:common.description')}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
						/>
						<div className='flex items-center gap-2'>
							<Checkbox
								id='journal-adjusting'
								checked={isAdjusting}
								onCheckedChange={(checked) => setIsAdjusting(checked === true)}
							/>
							<FieldLabel htmlFor='journal-adjusting'>{t('finance:journal.adjusting')}</FieldLabel>
						</div>
					</div>
					{isAdjusting ? (
						<p className='text-muted-foreground text-xs'>{t('finance:journal.adjustingHint')}</p>
					) : null}
					<div className='space-y-2'>
						{lines.map((line, index) => (
							<div key={index} className='flex flex-wrap items-center gap-2'>
								<Select
									value={line.accountId === '' ? NONE : line.accountId}
									onValueChange={(value: string | null) =>
										setLine(index, { accountId: value == null || value === NONE ? '' : value })
									}
								>
									<SelectTrigger className='w-72'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NONE}>{t('finance:journal.line.account')}</SelectItem>
										{accounts?.rows
											.filter((account) => account.isActive && account.isPostable)
											.map((account) => (
												<SelectItem key={account.id} value={account.id}>
													{account.code} — {account.name}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
								{canReadCostCenters ? (
									<Select
										value={line.costCenterId === '' ? NONE : line.costCenterId}
										onValueChange={(value: string | null) =>
											setLine(index, { costCenterId: value == null || value === NONE ? '' : value })
										}
									>
										<SelectTrigger className='w-48'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE}>{t('finance:journal.line.costCenter')}</SelectItem>
											{costCenters?.rows.map((center) => (
												<SelectItem key={center.id} value={center.id}>
													{center.code} — {center.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : null}
								<MoneyInput
									className='w-36'
									placeholder={t('finance:journal.debit')}
									value={line.debit}
									onValueChange={(value) => setLine(index, { debit: value, credit: '' })}
								/>
								<MoneyInput
									className='w-36'
									placeholder={t('finance:journal.credit')}
									value={line.credit}
									onValueChange={(value) => setLine(index, { credit: value, debit: '' })}
								/>
								<Button
									variant='ghost'
									size='sm'
									disabled={lines.length <= 2}
									onClick={() => setLines((previous) => previous.filter((_, rowIndex) => rowIndex !== index))}
								>
									<Trash2 className='size-4' />
								</Button>
							</div>
						))}
					</div>
					<div className='flex flex-wrap items-center gap-3 text-sm'>
						<Button variant='outline' size='sm' onClick={() => setLines((previous) => [...previous, emptyLine()])}>
							<Plus className='size-4' data-icon='inline-start' />
							{t('finance:journal.line.add')}
						</Button>
						<span>
							{t('finance:journal.totalDebit')}: {(totalDebit / 100).toLocaleString()}
						</span>
						<span>
							{t('finance:journal.totalCredit')}: {(totalCredit / 100).toLocaleString()}
						</span>
						<Badge variant={balanced ? 'secondary' : 'destructive'}>
							{balanced ? t('finance:journal.balance') : t('finance:journal.mustBalance')}
						</Badge>
						<Button size='sm' disabled={!balanced || saveDraft.isPending} onClick={() => void saveDraft.mutateAsync()}>
							{saveDraft.isPending ? t('finance:journal.saving') : t('finance:journal.saveDraft')}
						</Button>
					</div>
					<p className='text-muted-foreground text-xs'>{t('finance:journal.line.oneSideOnly')}</p>
				</div>
			) : null}

			<div className='flex items-center gap-2'>
				<Select
					value={status ?? ALL}
					onValueChange={(value: string | null) =>
						void navigate({
							search: (prev) => ({
								...prev,
								page: undefined,
								status: value == null || value === ALL ? undefined : (value as TJournalStatus),
							}),
						})
					}
				>
					<SelectTrigger className='w-56'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>{t('finance:journal.allStatuses')}</SelectItem>
						{JOURNAL_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`finance:journal.status.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && (data?.rows.length ?? 0) === 0 ? (
					<EmptyState icon={BookText} title={t('finance:journal.empty')} />
				) : (
					<DataTable columns={columns} data={data?.rows ?? []} loading={isPending} getRowId={(row) => row.id} />
				)}

				<PaginationControls
					page={page}
					totalPages={data?.pagination.totalPages ?? 1}
					onPageChange={(next) => void navigate({ search: (prev) => ({ ...prev, page: next }) })}
				/>
			</DataTableCard>

			{reasonFor ? (
				<ReasonDialog
					title={reasonFor.kind === 'reject' ? t('finance:journal.rejectTitle') : t('finance:journal.reverseTitle')}
					description={reasonFor.kind === 'reverse' ? t('finance:journal.reverseHint') : undefined}
					confirmLabel={reasonFor.kind === 'reject' ? t('finance:journal.reject') : t('finance:journal.reverse')}
					submitting={withReason.isPending}
					onClose={() => setReasonFor(null)}
					onConfirm={(reason) =>
						void withReason.mutateAsync({ kind: reasonFor.kind, id: reasonFor.entry.id, reason })
					}
				/>
			) : null}
		</div>
	);
}
