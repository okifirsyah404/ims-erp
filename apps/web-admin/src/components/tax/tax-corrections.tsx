import { MoneyInput } from '@/components/money-input';
import {
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { PenLine } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	addCorrection,
	correctionsQueryOptions,
	taxRecordsQueryOptions,
	type TTaxCorrection,
} from '@/lib/tax-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/finance/tax/corrections` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/tax/corrections/');

/**
 * Corrections & evidence (ERP-0016, D15): signed amounts against a verified
 * or filed record. The recorded `taxAmount` is never edited; the recap reads
 * record + Σ corrections.
 */
export function TaxCorrections() {
	const { t } = useTranslation(['tax', 'common']);
	const navigate = routeApi.useNavigate();
	const search = routeApi.useSearch();
	const queryClient = useQueryClient();
	const canUpdate = usePermission('tax.update');

	const recordId = search.recordId ?? '';
	const [amount, setAmount] = useState('');
	const [reason, setReason] = useState('');
	const [evidence, setEvidence] = useState('');

	const records = useQuery(
		taxRecordsQueryOptions({ page: 1, limit: 100 }),
	);
	const corrections = useQuery({
		...correctionsQueryOptions(recordId),
		// The query is meaningless without a record selected.
		enabled: recordId !== '',
	});

	const add = useMutation({
		mutationFn: () =>
			addCorrection(recordId, {
				amount: Math.round(Number(amount) * 100),
				reason,
				evidenceDocumentId: evidence || null,
			}),
		onSuccess: async () => {
			toast.success(t('tax:corrections.added'));
			setAmount('');
			setReason('');
			setEvidence('');
			await queryClient.invalidateQueries({
				queryKey: ['tax-corrections', recordId],
			});
			await queryClient.invalidateQueries({ queryKey: ['tax-recap'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TTaxCorrection, CellData>[]
	>(
		() => [
			{
				id: 'amount',
				header: t('tax:corrections.amount'),
				meta: { align: 'right', cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => (
					<span
						className={row.original.amount < 0 ? 'text-red-600' : 'text-green-700'}
					>
						{(row.original.amount / 100).toLocaleString()}
					</span>
				),
			},
			{ accessorKey: 'reason', header: t('tax:corrections.reason') },
			{
				id: 'evidence',
				header: t('tax:corrections.evidence'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => row.original.evidenceDocumentId ?? '—',
			},
			{
				accessorKey: 'createdBy',
				header: t('tax:corrections.createdBy'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
		],
		[t],
	);

	if (records.isError) {
		return <ErrorState error={records.error} bordered />;
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('tax:corrections.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('tax:corrections.description')}
				</p>
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<Select
					value={recordId === '' ? 'none' : recordId}
					onValueChange={(value: string | null) =>
						void navigate({ search: { recordId: value == null || value === 'none' ? undefined : value } })
					}
				>
					<SelectTrigger className='max-w-72' aria-label={t('tax:records.title')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='none'>{t('tax:records.title')}</SelectItem>
						{(records.data?.rows ?? []).map((row) => (
							<SelectItem key={row.id} value={row.id}>
								{row.code} — {row.periodYear}-
								{String(row.periodMonth).padStart(2, '0')} ({row.filingStatus})
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<DataTableCard>
				{recordId === '' ? (
					<EmptyState
						icon={PenLine}
						title={t('tax:corrections.title')}
						description={t('tax:records.empty')}
					/>
				) : (
					<>
						{canUpdate ? (
							<div className='flex flex-wrap items-center gap-2'>
								<MoneyInput
									className='w-40'
									placeholder={t('tax:corrections.amount')}
									value={amount}
									onValueChange={setAmount}
								/>
								<Input
									className='w-64'
									placeholder={t('tax:corrections.reason')}
									value={reason}
									onChange={(event) => setReason(event.target.value)}
								/>
								<Input
									className='w-64'
									placeholder={t('tax:corrections.evidence')}
									value={evidence}
									onChange={(event) => setEvidence(event.target.value)}
								/>
								<Button
									disabled={
										!amount || !reason || Number(amount) === 0 || add.isPending
									}
									onClick={() => void add.mutateAsync()}
								>
									{add.isPending
										? t('tax:corrections.adding')
										: t('tax:corrections.add')}
								</Button>
							</div>
						) : null}

						{!corrections.isPending &&
						(!corrections.data || corrections.data.length === 0) ? (
							<EmptyState
								icon={PenLine}
								title={t('tax:corrections.title')}
								description={t('tax:corrections.empty')}
							/>
						) : (
							<DataTable
								columns={columns}
								data={corrections.data ?? []}
								loading={corrections.isPending}
								getRowId={(row) => row.id}
								sortable
							/>
						)}
					</>
				)}
			</DataTableCard>
		</div>
	);
}
