import {
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import { CircleAlert, PenLine } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	addCorrection,
	correctionsQueryOptions,
	taxRecordsQueryOptions,
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

	if (records.isError) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('tax:corrections.title')}
				description={records.error.message}
			/>
		);
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
				<select
					className='h-9 max-w-72 rounded-md border bg-transparent px-3 text-sm'
					value={recordId}
					onChange={(event) =>
						void navigate({ search: { recordId: event.target.value || undefined } })
					}
					aria-label={t('tax:records.title')}
				>
					<option value=''>{t('tax:records.title')}</option>
					{(records.data?.rows ?? []).map((row) => (
						<option key={row.id} value={row.id}>
							{row.code} — {row.periodYear}-
							{String(row.periodMonth).padStart(2, '0')} ({row.filingStatus})
						</option>
					))}
				</select>
			</div>

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
							<Input
								className='w-40'
								placeholder={t('tax:corrections.amount')}
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
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

					{corrections.isPending ? null : !corrections.data ||
						corrections.data.length === 0 ? (
						<EmptyState
							icon={PenLine}
							title={t('tax:corrections.title')}
							description={t('tax:corrections.empty')}
						/>
					) : (
						<div className='overflow-hidden rounded-lg border'>
							<table className='w-full text-sm'>
								<thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
									<tr>
										<th className='px-3 py-2 text-right'>
											{t('tax:corrections.amount')}
										</th>
										<th className='px-3 py-2'>{t('tax:corrections.reason')}</th>
										<th className='px-3 py-2'>{t('tax:corrections.evidence')}</th>
										<th className='px-3 py-2'>{t('tax:corrections.createdBy')}</th>
									</tr>
								</thead>
								<tbody>
									{corrections.data.map((row) => (
										<tr key={row.id} className='border-t'>
											<td
												className={`px-3 py-2 text-right font-mono text-xs ${
													row.amount < 0 ? 'text-red-600' : 'text-green-700'
												}`}
											>
												{(row.amount / 100).toLocaleString()}
											</td>
											<td className='px-3 py-2'>{row.reason}</td>
											<td className='px-3 py-2 font-mono text-xs'>
												{row.evidenceDocumentId ?? '—'}
											</td>
											<td className='px-3 py-2 font-mono text-xs'>
												{row.createdBy}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</>
			)}
		</div>
	);
}
