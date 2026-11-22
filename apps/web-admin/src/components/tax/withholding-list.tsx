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
import { Ban, Check, CircleCheck, Pencil, ReceiptText, Plus } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	createWithholding,
	taxTypesQueryOptions,
	transitionWithholding,
	withholdingQueryOptions,
	type TWithholdingRecord,
} from '@/lib/tax-api';
import { usePermission } from '@/lib/use-permission';
import { WithholdingEditDialog } from '@/components/tax/withholding-edit-dialog';

/** The route API for `/finance/tax/withholding` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/tax/withholding/');

const PAGE_SIZE = 20;

/** Known withholding statuses, mirroring the backend state machine. */
const WITHHOLDING_STATUSES = ['recorded', 'verified', 'paid', 'reversed'] as const;
type TWithholdingStatus = (typeof WITHHOLDING_STATUSES)[number];

const asWithholdingStatus = (status: string): TWithholdingStatus =>
	(WITHHOLDING_STATUSES as readonly string[]).includes(status)
		? (status as TWithholdingStatus)
		: 'recorded';

const statusTone = (status: TWithholdingStatus) =>
	status === 'paid' ? 'default' : status === 'reversed' ? 'outline' : 'secondary';

/**
 * Withholding records (ERP-0016, D11): counterparty is plain text — no
 * cross-module validation. Rows are editable only while `recorded`.
 */
export function WithholdingList() {
	const { t } = useTranslation(['tax', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const canUpdate = usePermission('tax.update');
	const canVerify = usePermission('tax.verify');

	const [code, setCode] = useState('');
	const [taxTypeId, setTaxTypeId] = useState('');
	const [counterparty, setCounterparty] = useState('');
	const [baseAmount, setBaseAmount] = useState('');
	const [taxAmount, setTaxAmount] = useState('');
	const [editing, setEditing] = useState<TWithholdingRecord | null>(null);

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...withholdingQueryOptions({ page, limit: PAGE_SIZE }),
		placeholderData: (previous) => previous,
	});
	const types = useQuery(taxTypesQueryOptions({ page: 1, limit: 100 }));

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['tax-withholding'] });

	const create = useMutation({
		mutationFn: () =>
			createWithholding({
				code,
				taxTypeId,
				counterpartyType: counterparty || null,
				baseAmount: Math.round(Number(baseAmount) * 100),
				taxAmount: Math.round(Number(taxAmount) * 100),
			}),
		onSuccess: async () => {
			toast.success(t('tax:withholding.created'));
			setCode('');
			setCounterparty('');
			setBaseAmount('');
			setTaxAmount('');
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const transition = useMutation({
		mutationFn: (row: { id: string; to: string }) =>
			transitionWithholding(row.id, row.to),
		onSuccess: async () => {
			toast.success(t('tax:withholding.transitioned'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const typeRows = types.data?.rows;
	const columns = useMemo<
		ColumnDef<DataTableFeatures, TWithholdingRecord, CellData>[]
	>(() => {
		const nameOf = (id: string) => typeRows?.find((row) => row.id === id)?.name ?? id;
		const base: ColumnDef<DataTableFeatures, TWithholdingRecord, CellData>[] = [
			{
				accessorKey: 'code',
				header: t('tax:withholding.code'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				id: 'taxType',
				header: t('tax:records.taxType'),
				cell: ({ row }) => nameOf(row.original.taxTypeId),
			},
			{
				id: 'counterparty',
				header: t('tax:withholding.counterparty'),
				cell: ({ row }) => row.original.counterpartyType ?? '—',
			},
			{
				id: 'baseAmount',
				header: t('tax:withholding.baseAmount'),
				meta: { align: 'right', cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => (row.original.baseAmount / 100).toLocaleString(),
			},
			{
				id: 'taxAmount',
				header: t('tax:withholding.taxAmount'),
				meta: { align: 'right', cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => (row.original.taxAmount / 100).toLocaleString(),
			},
			{
				id: 'status',
				header: t('tax:withholding.status'),
				cell: ({ row }) => (
					<Badge variant={statusTone(asWithholdingStatus(row.original.status))}>
						{t(`tax:status.${asWithholdingStatus(row.original.status)}`)}
					</Badge>
				),
			},
		];
		if (!(canVerify || canUpdate)) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => {
					const { id, status } = row.original;
					const move = (to: string) => void transition.mutateAsync({ id, to });
					return (
						<RowActions
							label={t('common:action.actions')}
							actions={[
								{
									key: 'edit',
									label: t('common:action.edit'),
									icon: Pencil,
									hidden: !(canUpdate && status === 'recorded'),
									onSelect: () => setEditing(row.original),
								},
								{
									key: 'verify',
									label: t('tax:withholding.verify'),
									icon: Check,
									disabled: transition.isPending,
									hidden: !(canVerify && status === 'recorded'),
									onSelect: () => move('verified'),
								},
								{
									key: 'pay',
									label: t('tax:withholding.pay'),
									icon: CircleCheck,
									disabled: transition.isPending,
									hidden: !(canVerify && status === 'verified'),
									onSelect: () => move('paid'),
								},
								{
									key: 'reverse',
									label: t('tax:withholding.reverse'),
									icon: Ban,
									destructive: true,
									disabled: transition.isPending,
									hidden: !(canVerify && status === 'verified'),
									onSelect: () => move('reversed'),
								},
							]}
						/>
					);
				},
			},
		];
	}, [canUpdate, canVerify, t, transition, typeRows]);

	if (isError) {
		return <ErrorState error={error} bordered />;
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('tax:withholding.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('tax:withholding.description')}
				</p>
			</div>

			{canUpdate ? (
				<div className='flex flex-wrap items-center gap-2'>
					<Input
						className='w-36'
						placeholder={t('tax:withholding.code')}
						value={code}
						onChange={(event) => setCode(event.target.value)}
					/>
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
						className='w-56'
						placeholder={t('tax:withholding.counterparty')}
						value={counterparty}
						onChange={(event) => setCounterparty(event.target.value)}
					/>
					<MoneyInput
						className='w-40'
						placeholder={t('tax:withholding.baseAmount')}
						value={baseAmount}
						onValueChange={setBaseAmount}
					/>
					<MoneyInput
						className='w-40'
						placeholder={t('tax:withholding.taxAmount')}
						value={taxAmount}
						onValueChange={setTaxAmount}
					/>
					<Button
						disabled={
							!code ||
							!taxTypeId ||
							!baseAmount ||
							!taxAmount ||
							create.isPending
						}
						onClick={() => void create.mutateAsync()}
					>
						<Plus className='size-4' data-icon='inline-start' />
						{create.isPending
							? t('tax:withholding.creating')
							: t('tax:withholding.create')}
					</Button>
				</div>
			) : null}

			<DataTableCard>
				{!isPending && (!data || data.rows.length === 0) ? (
					<EmptyState
						icon={ReceiptText}
						title={t('tax:withholding.title')}
						description={t('tax:withholding.empty')}
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
				<WithholdingEditDialog
					key={editing.id}
					withholding={editing}
					open
					onOpenChange={(open) => {
						if (!open) setEditing(null);
					}}
				/>
			) : null}
		</div>
	);
}
