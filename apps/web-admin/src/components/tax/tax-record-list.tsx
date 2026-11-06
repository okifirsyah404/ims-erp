import {
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import { CircleAlert, FileText, Plus } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	createTaxRecord,
	previewTax,
	taxRecordsQueryOptions,
	taxTypesQueryOptions,
	transitionTaxRecord,
	updateTaxRecord,
} from '@/lib/tax-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/finance/tax/records` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/tax/records/');

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
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const canUpdate = usePermission('tax.update');
	const canVerify = usePermission('tax.verify');

	const [taxTypeId, setTaxTypeId] = useState('');
	const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
	const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
	const [taxableBase, setTaxableBase] = useState('');
	const [preview, setPreview] = useState<string | null>(null);

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

	const typeName = (id: string) =>
		types.data?.rows.find((row) => row.id === id)?.name ?? id;

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

	const editDraft = useMutation({
		mutationFn: (row: { id: string; taxableBase: number }) =>
			updateTaxRecord(row.id, { taxableBase: row.taxableBase }),
		onSuccess: async () => {
			toast.success(t('tax:records.updated'));
			await invalidate();
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

	if (isError) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('tax:records.title')}
				description={error.message}
			/>
		);
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
						<select
							className='h-9 rounded-md border bg-transparent px-3 text-sm'
							value={taxTypeId}
							onChange={(event) => setTaxTypeId(event.target.value)}
							aria-label={t('tax:records.taxType')}
						>
							<option value=''>{t('tax:records.taxType')}</option>
							{(types.data?.rows ?? [])
								.filter((row) => row.isActive)
								.map((row) => (
									<option key={row.id} value={row.id}>
										{row.code} — {row.name}
									</option>
								))}
						</select>
						<input
							type='number'
							className='h-9 w-24 rounded-md border bg-transparent px-3 text-sm'
							value={periodYear}
							min={2000}
							max={2100}
							onChange={(event) => setPeriodYear(Number(event.target.value))}
							aria-label={t('tax:recap.year')}
						/>
						<select
							className='h-9 rounded-md border bg-transparent px-3 text-sm'
							value={periodMonth}
							onChange={(event) => setPeriodMonth(Number(event.target.value))}
							aria-label={t('tax:recap.month')}
						>
							{Array.from({ length: 12 }, (_, index) => index + 1).map(
								(value) => (
									<option key={value} value={value}>
										{value}
									</option>
								),
							)}
						</select>
						<Input
							className='w-44'
							placeholder={t('tax:records.taxableBase')}
							value={taxableBase}
							onChange={(event) => setTaxableBase(event.target.value)}
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

			{isPending ? null : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={FileText}
					title={t('tax:records.title')}
					description={t('tax:records.empty')}
				/>
			) : (
				<>
					<div className='overflow-hidden rounded-lg border'>
						<table className='w-full text-sm'>
							<thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
								<tr>
									<th className='px-3 py-2'>{t('tax:records.code')}</th>
									<th className='px-3 py-2'>{t('tax:records.taxType')}</th>
									<th className='px-3 py-2'>{t('tax:records.period')}</th>
									<th className='px-3 py-2 text-right'>
										{t('tax:records.taxableBase')}
									</th>
									<th className='px-3 py-2 text-right'>
										{t('tax:records.taxAmount')}
									</th>
									<th className='px-3 py-2'>{t('tax:records.status')}</th>
									{canVerify || canUpdate ? <th className='px-3 py-2' /> : null}
								</tr>
							</thead>
							<tbody>
								{data.rows.map((row) => (
									<tr key={row.id} className='border-t'>
										<td className='px-3 py-2 font-mono text-xs'>{row.code}</td>
										<td className='px-3 py-2'>{typeName(row.taxTypeId)}</td>
										<td className='px-3 py-2 text-xs'>
											{row.periodYear}-{String(row.periodMonth).padStart(2, '0')}
										</td>
										<td className='px-3 py-2 text-right font-mono text-xs'>
											{(row.taxableBase / 100).toLocaleString()}
										</td>
										<td className='px-3 py-2 text-right font-mono text-xs'>
											{(row.taxAmount / 100).toLocaleString()}
										</td>
										<td className='px-3 py-2'>
											<Badge variant={statusTone(asFilingStatus(row.filingStatus))}>
												{t(`tax:status.${asFilingStatus(row.filingStatus)}`)}
											</Badge>
										</td>
										{canVerify || canUpdate ? (
											<td className='px-3 py-2 text-right'>
												{canUpdate && row.filingStatus === 'draft' ? (
													<Button
														variant='outline'
														size='sm'
														className='mr-1'
														disabled={editDraft.isPending}
														onClick={() => {
															const next = window.prompt(
																t('tax:records.taxableBase'),
																String(row.taxableBase / 100),
															);
															if (next === null) return;
															const value = Number(next);
															if (!Number.isFinite(value) || value < 0) return;
															void editDraft.mutateAsync({
																id: row.id,
																taxableBase: Math.round(value * 100),
															});
														}}
													>
														{t('common:action.edit')}
													</Button>
												) : null}
												{canVerify && row.filingStatus === 'draft' ? (
													<Button
														variant='outline'
														size='sm'
														className='mr-1'
														disabled={transition.isPending}
														onClick={() =>
															void transition.mutateAsync({
																id: row.id,
																to: 'verified',
															})
														}
													>
														{t('tax:records.verify')}
													</Button>
												) : null}
												{canVerify && row.filingStatus === 'verified' ? (
													<Button
														variant='outline'
														size='sm'
														disabled={transition.isPending}
														onClick={() =>
															void transition.mutateAsync({
																id: row.id,
																to: 'filed',
															})
														}
													>
														{t('tax:records.file')}
													</Button>
												) : null}
											</td>
										) : null}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<PaginationControls
						page={page}
						totalPages={data.pagination.totalPages}
						onPageChange={(next) =>
							void navigate({ search: (prev) => ({ ...prev, page: next }) })
						}
					/>
				</>
			)}
		</div>
	);
}
