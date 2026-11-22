import { MoneyInput } from '@/components/money-input';
import {
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import { RowActions } from '@/components/data-table/row-actions';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Check, FileText, Pencil, Plus, Send } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	createTaxRecord,
	previewTax,
	taxRecordsQueryOptions,
	taxTypesQueryOptions,
	transitionTaxRecord,
	type TTaxRecord,
} from '@/lib/tax-api';
import { usePermission } from '@/lib/use-permission';
import { TaxRecordEditDialog } from '@/components/tax/tax-record-edit-dialog';

/** The route API for `/finance/tax/records` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/tax/records/');

const PAGE_SIZE = 20;

/** Default period = current month, computed once at module load. */
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

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
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const canUpdate = usePermission('tax.update');
	const canVerify = usePermission('tax.verify');

	const [taxTypeId, setTaxTypeId] = useState('');
	const [periodYear, setPeriodYear] = useState(CURRENT_YEAR);
	const [periodMonth, setPeriodMonth] = useState(CURRENT_MONTH);
	const [taxableBase, setTaxableBase] = useState('');
	const [preview, setPreview] = useState<string | null>(null);
	const [editing, setEditing] = useState<TTaxRecord | null>(null);

	const page = search.page ?? 1;
	const year = search.year;
	const month = search.month;
	const { data, isPending, isError, error } = useQuery({
		...taxRecordsQueryOptions({ page, limit: PAGE_SIZE, year, month }),
		placeholderData: (previous) => previous,
	});
	const types = useQuery(taxTypesQueryOptions({ page: 1, limit: 100 }));

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['tax-records'] });

	const create = useMutation({
		mutationFn: () =>
			createTaxRecord({
				taxTypeId,
				periodYear,
				periodMonth,
				taxableBase: Math.round(Number(taxableBase) * 100),
			}),
		onSuccess: async () => {
			toast.success(t('tax:records.created'));
			setTaxTypeId('');
			setTaxableBase('');
			setPreview(null);
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const runPreview = useMutation({
		mutationFn: () =>
			previewTax({
				taxTypeId,
				taxableBase: Math.round(Number(taxableBase) * 100),
				date: `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`,
			}),
		onSuccess: (result) => {
			setPreview(
				t('tax:records.previewResult', {
					amount: (result.taxAmount / 100).toLocaleString(),
					rate: result.rate,
					date: result.effectiveFrom,
				}),
			);
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

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

			{canUpdate ? (
				<div className='space-y-2'>
					<div className='flex flex-wrap items-center gap-2'>
						<Select
							value={taxTypeId === '' ? 'none' : taxTypeId}
							onValueChange={(value: string | null) => setTaxTypeId(value == null || value === 'none' ? '' : value)}
						>
							<SelectTrigger aria-label={t('tax:records.taxType')}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='none'>{t('tax:records.taxType')}</SelectItem>
								{(types.data?.rows ?? [])
									.filter((row) => row.isActive)
									.map((row) => (
										<SelectItem key={row.id} value={row.id}>
											{row.code} — {row.name}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
						<Input
							type='number'
							className='w-24'
							value={periodYear}
							min={2000}
							max={2100}
							onChange={(event) => setPeriodYear(Number(event.target.value))}
							aria-label={t('tax:recap.year')}
						/>
						<Select
							value={String(periodMonth)}
							onValueChange={(value: string | null) => setPeriodMonth(Number(value ?? 1))}
						>
							<SelectTrigger aria-label={t('tax:recap.month')}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Array.from({ length: 12 }, (_, index) => index + 1).map(
									(value) => (
										<SelectItem key={value} value={String(value)}>
											{value}
										</SelectItem>
									),
								)}
							</SelectContent>
						</Select>
						<MoneyInput
							className='w-44'
							placeholder={t('tax:records.taxableBase')}
							value={taxableBase}
							onValueChange={setTaxableBase}
						/>
						<Button
							variant='outline'
							disabled={!taxTypeId || !taxableBase || runPreview.isPending}
							onClick={() => void runPreview.mutateAsync()}
						>
							{t('tax:records.preview')}
						</Button>
						<Button
							disabled={
								!taxTypeId || !taxableBase || Number(taxableBase) < 0 || create.isPending
							}
							onClick={() => void create.mutateAsync()}
						>
							<Plus className='size-4' data-icon='inline-start' />
							{create.isPending ? t('tax:records.creating') : t('tax:records.create')}
						</Button>
					</div>
					{preview ? (
						<p className='text-sm text-muted-foreground'>{preview}</p>
					) : null}
				</div>
			) : null}

			<DataTableCard>
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
								onPageChange={(next) =>
									void navigate({ search: (prev) => ({ ...prev, page: next }) })
								}
							/>
						) : null}
					</>
				)}
			</DataTableCard>

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
