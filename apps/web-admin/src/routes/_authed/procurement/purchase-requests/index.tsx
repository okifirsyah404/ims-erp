import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState } from '@/components/empty-state';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import {
	PR_STATUS_VARIANT,
	PURCHASE_REQUEST_STATUSES,
	purchaseRequestsQueryOptions,
	type TPurchaseRequest,
	type TPurchaseRequestStatus,
} from '@/lib/procurement-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/procurement/purchase-requests` — purchase requests, company-wide (M05). */
export const Route = createFileRoute('/_authed/procurement/purchase-requests/')({
	component: PurchaseRequestListPage,
});

function PurchaseRequestListPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const canCreate = usePermission('purchase_request.create');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TPurchaseRequestStatus | ''>('');
	const [mine, setMine] = useState(false);
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		purchaseRequestsQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined, mine }),
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TPurchaseRequest, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('procurement:pr.code'),
				cell: ({ row }) => (
					<>
						<Link
							to='/procurement/purchase-requests/$purchaseRequestId'
							params={{ purchaseRequestId: row.original.id }}
							className='font-medium hover:underline'
						>
							{row.original.code ?? t('procurement:pr.noNumber')}
						</Link>
						<div className='text-xs text-muted-foreground'>{row.original.subject}</div>
					</>
				),
			},
			{
				id: 'requestedBy',
				header: t('procurement:pr.requestedBy'),
				cell: ({ row }) => row.original.requestedByName ?? '—',
			},
			{
				id: 'neededBy',
				header: t('procurement:pr.neededBy'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => formatBusinessDate(row.original.neededBy, i18n.language),
			},
			{
				id: 'status',
				header: t('procurement:po.status'),
				cell: ({ row }) => (
					<Badge variant={PR_STATUS_VARIANT[row.original.status]}>
						{t(`procurement:prStatus.${row.original.status}`)}
					</Badge>
				),
			},
			{
				id: 'estimatedTotal',
				header: t('procurement:pr.estimatedTotal'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.estimatedTotal),
			},
		],
		[t, i18n.language],
	);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('procurement:prs.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('procurement:prs.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/procurement/purchase-requests/new' />} nativeButton={false}>
						{t('procurement:prs.new')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap items-center gap-2'>
				<Input
					type='search'
					className='max-w-sm'
					aria-label={t('procurement:prs.search')}
					placeholder={t('procurement:prs.search')}
					value={search}
					onChange={(event) => {
						setSearch(event.target.value);
						setPage(1);
					}}
				/>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === 'all' || value == null ? '' : (value as TPurchaseRequestStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('procurement:po.status')} className='w-48'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('procurement:pos.allStatuses')}</SelectItem>
						{PURCHASE_REQUEST_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`procurement:prStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Field orientation='horizontal' className='w-auto'>
					<Checkbox
						id='pr-mine'
						checked={mine}
						onCheckedChange={(checked) => {
							setMine(checked === true);
							setPage(1);
						}}
					/>
					<FieldLabel htmlFor='pr-mine'>{t('procurement:prs.mine')}</FieldLabel>
				</Field>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<EmptyState title={t('procurement:prs.empty')} bordered />
			) : (
				<>
					<DataTable columns={columns} data={data.rows} getRowId={(row) => row.id} bordered />
					{data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
		</div>
	);
}
