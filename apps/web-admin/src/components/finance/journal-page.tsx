import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
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
import {
	approveJournalEntry,
	JOURNAL_STATUSES,
	journalQueryOptions,
	rejectJournalEntry,
	reverseJournalEntry,
	submitJournalEntry,
	type TJournalEntry,
	type TJournalStatus,
	voidJournalEntry,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';
import { JournalEntryDialog } from './journal-entry-dialog';
import { ReasonDialog } from './reason-dialog';

const PAGE_SIZE = 20;
const ALL = 'all';

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
	const queryClient = useQueryClient();
	const canRead = usePermission('journal.read');
	const canCreate = usePermission('journal.create');
	const canSubmit = usePermission('journal.submit');
	const canApprove = usePermission('journal.approve');
	const canUpdate = usePermission('journal.update');
	const canReverse = usePermission('journal.reverse');

	const [creating, setCreating] = useState(false);
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<TJournalStatus | undefined>(undefined);
	const [reasonFor, setReasonFor] = useState<{ kind: 'reject' | 'reverse'; entry: TJournalEntry } | null>(null);
	const { data, isPending, isError, error } = useQuery({
		...journalQueryOptions({ page, limit: PAGE_SIZE, status }),
		placeholderData: (previous) => previous,
		enabled: canRead,
	});

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ['journal'] });
	};
	const onError = (mutationError: Error) => toast.error(mutationError.message);

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

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('finance:journal.title')}</h1>
				<p className='text-muted-foreground text-sm'>{t('finance:journal.description')}</p>
			</div>

			<div className='flex items-center gap-2'>
				<Select
					value={status ?? ALL}
					onValueChange={(value: string | null) => {
						setStatus(value == null || value === ALL ? undefined : (value as TJournalStatus));
						setPage(1);
					}}
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

			<DataTableCard
				title={t('finance:journal.title')}
				action={
					canCreate ? (
						<Button size='sm' onClick={() => setCreating(true)}>
							<Plus className='size-4' data-icon='inline-start' />
							{t('finance:journal.newEntry')}
						</Button>
					) : null
				}
			>
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
					onPageChange={setPage}
				/>
			</DataTableCard>

			{creating ? <JournalEntryDialog onClose={() => setCreating(false)} /> : null}

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
