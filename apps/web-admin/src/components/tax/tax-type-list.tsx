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
import { CircleAlert, Plus, Scale } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	createTaxType,
	deleteTaxType,
	taxTypesQueryOptions,
	updateTaxType,
} from '@/lib/tax-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/finance/tax/types` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/tax/types/');

const PAGE_SIZE = 20;

/**
 * Tax types & rates (ERP-0016): effective-dated rate rows with soft delete.
 * Overlap rejection happens server-side; the error surfaces as a toast.
 */
export function TaxTypeList() {
	const { t } = useTranslation(['tax', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const canUpdate = usePermission('tax.update');

	const [code, setCode] = useState('');
	const [name, setName] = useState('');
	const [rate, setRate] = useState('');
	const [effectiveFrom, setEffectiveFrom] = useState('');

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...taxTypesQueryOptions({ page, limit: PAGE_SIZE }),
		placeholderData: (previous) => previous,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['tax-types'] });

	const create = useMutation({
		mutationFn: () =>
			createTaxType({
				code,
				name,
				taxType: 'vat',
				rate,
				effectiveFrom,
			}),
		onSuccess: async () => {
			toast.success(t('tax:types.created'));
			setCode('');
			setName('');
			setRate('');
			setEffectiveFrom('');
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const toggleActive = useMutation({
		mutationFn: (row: { id: string; isActive: boolean }) =>
			updateTaxType(row.id, { isActive: !row.isActive }),
		onSuccess: async () => {
			toast.success(t('tax:types.updated'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const remove = useMutation({
		mutationFn: (id: string) => deleteTaxType(id),
		onSuccess: async () => {
			toast.success(t('tax:types.deleted'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	if (isError) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('tax:types.title')}
				description={error.message}
			/>
		);
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('tax:types.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('tax:types.description')}
				</p>
			</div>

			{canUpdate ? (
				<div className='flex flex-wrap items-center gap-2'>
					<Input
						className='w-36'
						placeholder={t('tax:types.code')}
						value={code}
						onChange={(event) => setCode(event.target.value)}
					/>
					<Input
						className='w-56'
						placeholder={t('tax:types.name')}
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
					<Input
						className='w-28'
						placeholder={t('tax:types.rate')}
						value={rate}
						onChange={(event) => setRate(event.target.value)}
					/>
					<input
						type='date'
						className='h-9 rounded-md border bg-transparent px-3 text-sm'
						value={effectiveFrom}
						onChange={(event) => setEffectiveFrom(event.target.value)}
						aria-label={t('tax:types.effectiveFrom')}
					/>
					<Button
						disabled={
							!code || !name || !rate || !effectiveFrom || create.isPending
						}
						onClick={() => void create.mutateAsync()}
					>
						<Plus className='size-4' data-icon='inline-start' />
						{create.isPending
							? t('tax:types.creating')
							: t('tax:types.create')}
					</Button>
				</div>
			) : null}

			{isPending ? null : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={Scale}
					title={t('tax:types.title')}
					description={t('tax:types.empty')}
				/>
			) : (
				<div className='overflow-hidden rounded-lg border'>
					<table className='w-full text-sm'>
						<thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
							<tr>
								<th className='px-3 py-2'>{t('tax:types.code')}</th>
								<th className='px-3 py-2'>{t('tax:types.name')}</th>
								<th className='px-3 py-2'>{t('tax:types.rate')}</th>
								<th className='px-3 py-2'>{t('tax:types.effectiveFrom')}</th>
								<th className='px-3 py-2'>{t('tax:types.effectiveTo')}</th>
								<th className='px-3 py-2'>{t('tax:types.active')}</th>
								{canUpdate ? <th className='px-3 py-2' /> : null}
							</tr>
						</thead>
						<tbody>
							{data.rows.map((row) => (
								<tr key={row.id} className='border-t'>
									<td className='px-3 py-2 font-mono text-xs'>{row.code}</td>
									<td className='px-3 py-2'>{row.name}</td>
									<td className='px-3 py-2 font-mono text-xs'>{row.rate}</td>
									<td className='px-3 py-2 text-xs'>{row.effectiveFrom}</td>
									<td className='px-3 py-2 text-xs'>
										{row.effectiveTo ?? '—'}
									</td>
									<td className='px-3 py-2'>
										{row.isActive ? (
											<Badge>{t('tax:types.active')}</Badge>
										) : (
											<Badge variant='outline'>
												{t('tax:types.inactive')}
											</Badge>
										)}
									</td>
									{canUpdate ? (
										<td className='px-3 py-2 text-right'>
											<Button
												variant='outline'
												size='sm'
												className='mr-1'
												onClick={() => void toggleActive.mutateAsync(row)}
											>
												{row.isActive
													? t('tax:types.inactive')
													: t('tax:types.active')}
											</Button>
											<Button
												variant='ghost'
												size='sm'
												onClick={() => {
													if (window.confirm(t('tax:types.deleteConfirm'))) {
														void remove.mutateAsync(row.id);
													}
												}}
											>
												{t('common:action.delete')}
											</Button>
										</td>
									) : null}
								</tr>
							))}
						</tbody>
					</table>
				</div>
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
