import {
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import { RowActions } from '@/components/data-table/row-actions';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { Check, FileText, Pencil, Plus, Send } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	taxRecordsQueryOptions,
	taxTypesQueryOptions,
	transitionTaxRecord,
	type TTaxRecord,
} from '@/lib/tax-api';
import { usePermission } from '@/lib/use-permission';
import { TaxRecordCreateDialog } from '@/components/tax/tax-record-create-dialog';
import { TaxRecordEditDialog } from '@/components/tax/tax-record-edit-dialog';

const PAGE_SIZE = 20;

/** Known filing statuses, mirroring the backend state machine. */
const FILING_STATUSES = ['draft', 'verified', 'filed', 'corrected'] as const;
type TFilingStatus = (typeof FILING_STATUSES)[number];

const asFilingStatus = (status: string): TFilingStatus =>
	(FILING_STATUSES as readonly string[]).includes(status)
		? (status as TFilingStatus)
		: 'draft';

const statusTone = (status: TFilingStatus) =>
	status === 'filed' ? 'default' : status === 'draft' ? 'outline' : 'secondary';

/**
 * Period working papers (ERP-0016): create drafts (with a rate preview),
 * edit drafts, and move them draft → verified → filed.
 */
export function TaxRecordList() {
	const { t } = useTranslation(['tax', 'common']);
	const queryClient = useQueryClient();
	const canUpdate = usePermission('tax.update');
	const canVerify = usePermission('tax.verify');

	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<TTaxRecord | null>(null);

	const [page, setPage] = useState(1);
	const { data, isPending, isError, error } = useQuery({
		...taxRecordsQueryOptions({ page, limit: PAGE_SIZE }),
		placeholderData: (previous) => previous,
	});
	const types = useQuery(taxTypesQueryOptions({ page: 1, limit: 100 }));

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['tax-records'] });

	const transition = useMutation({
		mutationFn: (row: { id: string; to: string }) =>
			transitionTaxRecord(row.id, row.to),
		onSuccess: async () => {
			toast.success(t('tax:records.transitioned'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const typeRows = types.data?.rows;
	const columns = useMemo<ColumnDef<DataTableFeatures, TTaxRecord, CellData>[]>(() => {
		const nameOf = (id: string) => typeRows?.find((row) => row.id === id)?.name ?? id;
		const base: ColumnDef<DataTableFeatures, TTaxRecord, CellData>[] = [
			{
				accessorKey: 'code',
				header: t('tax:records.code'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				id: 'taxType',
				header: t('tax:records.taxType'),
				cell: ({ row }) => nameOf(row.original.taxTypeId),
			},
			{
				id: 'period',
				header: t('tax:records.period'),
				meta: { cellClassName: 'text-xs' },
				cell: ({ row }) =>
					`${row.original.periodYear}-${String(row.original.periodMonth).padStart(2, '0')}`,
			},
			{
				id: 'taxableBase',
				header: t('tax:records.taxableBase'),
				meta: { align: 'right', cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => (row.original.taxableBase / 100).toLocaleString(),
			},
			{
				id: 'taxAmount',
				header: t('tax:records.taxAmount'),
				meta: { align: 'right', cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => (row.original.taxAmount / 100).toLocaleString(),
			},
			{
				id: 'status',
				header: t('tax:records.status'),
				cell: ({ row }) => (
					<Badge variant={statusTone(asFilingStatus(row.original.filingStatus))}>
						{t(`tax:status.${asFilingStatus(row.original.filingStatus)}`)}
					</Badge>
				),
			},
		];
		if (!(canVerify || canUpdate)) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.edit')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('common:action.edit')}
						actions={[
							{
								key: 'edit',
								label: t('common:action.edit'),
								icon: Pencil,
								hidden: !(canUpdate && row.original.filingStatus === 'draft'),
								onSelect: () => setEditing(row.original),
							},
							{
								key: 'verify',
								label: t('tax:records.verify'),
								icon: Check,
								hidden: !(canVerify && row.original.filingStatus === 'draft'),
								disabled: transition.isPending,
								onSelect: () =>
									void transition.mutateAsync({
										id: row.original.id,
										to: 'verified',
									}),
							},
							{
								key: 'file',
								label: t('tax:records.file'),
								icon: Send,
								hidden: !(canVerify && row.original.filingStatus === 'verified'),
								disabled: transition.isPending,
								onSelect: () =>
									void transition.mutateAsync({
										id: row.original.id,
										to: 'filed',
									}),
							},
						]}
					/>
				),
			},
		];
	}, [canUpdate, canVerify, t, transition, typeRows]);

	if (isError) {
		return <ErrorState error={error} bordered />;
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('tax:records.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('tax:records.description')}
				</p>
			</div>

			<DataTableCard
				title={t('tax:records.title')}
				action={
					canUpdate ? (
						<Button size='sm' onClick={() => setCreating(true)}>
							<Plus className='size-4' data-icon='inline-start' />
							{t('tax:records.create')}
						</Button>
					) : null
				}
			>
				{!isPending && (!data || data.rows.length === 0) ? (
					<EmptyState
						icon={FileText}
						title={t('tax:records.title')}
						description={t('tax:records.empty')}
					/>
				) : (
					<>
						<DataTable
							columns={columns}
							data={data?.rows ?? []}
							loading={isPending}
							getRowId={(row) => row.id}
						/>
						{data ? (
							<PaginationControls
								page={page}
								totalPages={data.pagination.totalPages}
								onPageChange={setPage}
							/>
						) : null}
					</>
				)}
			</DataTableCard>

			{creating ? (
				<TaxRecordCreateDialog
					types={types.data?.rows ?? []}
					onClose={() => setCreating(false)}
				/>
			) : null}

			{editing ? (
				<TaxRecordEditDialog
					key={editing.id}
					record={editing}
					open
					onOpenChange={(open) => {
						if (!open) setEditing(null);
					}}
				/>
			) : null}
		</div>
	);
}
