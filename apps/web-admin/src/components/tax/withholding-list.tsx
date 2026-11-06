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
import { CircleAlert, ReceiptText, Plus } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
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

	const typeName = (id: string) =>
		types.data?.rows.find((row) => row.id === id)?.name ?? id;

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

	if (isError) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('tax:withholding.title')}
				description={error.message}
			/>
		);
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
					<Input
						className='w-56'
						placeholder={t('tax:withholding.counterparty')}
						value={counterparty}
						onChange={(event) => setCounterparty(event.target.value)}
					/>
					<Input
						className='w-40'
						placeholder={t('tax:withholding.baseAmount')}
						value={baseAmount}
						onChange={(event) => setBaseAmount(event.target.value)}
					/>
					<Input
						className='w-40'
						placeholder={t('tax:withholding.taxAmount')}
						value={taxAmount}
						onChange={(event) => setTaxAmount(event.target.value)}
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

			{isPending ? null : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={ReceiptText}
					title={t('tax:withholding.title')}
					description={t('tax:withholding.empty')}
				/>
			) : (
				<>
					<div className='overflow-hidden rounded-lg border'>
						<table className='w-full text-sm'>
							<thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
								<tr>
									<th className='px-3 py-2'>{t('tax:withholding.code')}</th>
									<th className='px-3 py-2'>{t('tax:records.taxType')}</th>
									<th className='px-3 py-2'>
										{t('tax:withholding.counterparty')}
									</th>
									<th className='px-3 py-2 text-right'>
										{t('tax:withholding.baseAmount')}
									</th>
									<th className='px-3 py-2 text-right'>
										{t('tax:withholding.taxAmount')}
									</th>
									<th className='px-3 py-2'>{t('tax:withholding.status')}</th>
									{canVerify || canUpdate ? <th className='px-3 py-2' /> : null}
								</tr>
							</thead>
							<tbody>
								{data.rows.map((row) => (
									<tr key={row.id} className='border-t'>
										<td className='px-3 py-2 font-mono text-xs'>{row.code}</td>
										<td className='px-3 py-2'>{typeName(row.taxTypeId)}</td>
										<td className='px-3 py-2'>
											{row.counterpartyType ?? '—'}
										</td>
										<td className='px-3 py-2 text-right font-mono text-xs'>
											{(row.baseAmount / 100).toLocaleString()}
										</td>
										<td className='px-3 py-2 text-right font-mono text-xs'>
											{(row.taxAmount / 100).toLocaleString()}
										</td>
										<td className='px-3 py-2'>
											<Badge variant={statusTone(asWithholdingStatus(row.status))}>
												{t(`tax:status.${asWithholdingStatus(row.status)}`)}
											</Badge>
										</td>
										{canVerify || canUpdate ? (
											<td className='px-3 py-2 text-right'>
												{canUpdate && row.status === 'recorded' ? (
													<Button
														variant='outline'
														size='sm'
														className='mr-1'
														onClick={() => setEditing(row)}
													>
														{t('common:action.edit')}
													</Button>
												) : null}
												{canVerify && row.status === 'recorded' ? (
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
														{t('tax:withholding.verify')}
													</Button>
												) : null}
												{canVerify && row.status === 'verified' ? (
													<>
														<Button
															variant='outline'
															size='sm'
															className='mr-1'
															disabled={transition.isPending}
															onClick={() =>
																void transition.mutateAsync({
																	id: row.id,
																	to: 'paid',
																})
															}
														>
															{t('tax:withholding.pay')}
														</Button>
														<Button
															variant='ghost'
															size='sm'
															disabled={transition.isPending}
															onClick={() =>
																void transition.mutateAsync({
																	id: row.id,
																	to: 'reversed',
																})
															}
														>
															{t('tax:withholding.reverse')}
														</Button>
													</>
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
