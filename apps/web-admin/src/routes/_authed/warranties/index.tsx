import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ims-erp/ui/components/input-group';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate } from '@/lib/format';
import { warrantiesQueryOptions, type TWarrantyRow } from '@/lib/handover-api';

/** `/warranties` — warranty certificates of the visible projects (M07). */
export const Route = createFileRoute('/_authed/warranties/')({
	component: WarrantyListPage,
});

function WarrantyListPage() {
	const { t, i18n } = useTranslation(['projects', 'common', 'nav']);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		warrantiesQueryOptions({ page, search: deferredSearch || undefined }),
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TWarrantyRow, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('projects:field.code'),
				cell: ({ row }) => (
					<Link
						to='/projects/$projectId'
						params={{ projectId: row.original.projectId }}
						className='font-medium hover:underline'
					>
						{row.original.code}
					</Link>
				),
			},
			{
				id: 'project',
				header: t('projects:field.title'),
				cell: ({ row }) => (
					<>
						<div>{row.original.projectName}</div>
						<div className='text-xs text-muted-foreground'>{row.original.customerName}</div>
					</>
				),
			},
			{
				id: 'issueDate',
				header: t('projects:warranty.issueDate'),
				cell: ({ row }) => formatBusinessDate(row.original.issueDate, i18n.language),
			},
			{
				id: 'period',
				header: t('projects:warranty.months'),
				cell: ({ row }) => (
					<>
						{formatBusinessDate(row.original.startDate, i18n.language)}
						{' – '}
						{formatBusinessDate(row.original.endDate, i18n.language)}
					</>
				),
			},
			{
				id: 'active',
				header: t('projects:field.status'),
				cell: ({ row }) => {
					const today = new Date().toISOString().slice(0, 10);
					const active = today <= row.original.endDate;
					return (
						<Badge variant={active ? 'default' : 'outline'}>
							{active ? t('projects:ticket.inWarranty') : t('projects:ticket.outOfWarranty')}
						</Badge>
					);
				},
			},
		],
		[t, i18n.language],
	);

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('nav:item.warranty')}</h1>
			</div>
			<InputGroup className='max-w-sm'>
				<InputGroupAddon align='inline-start'>
					<Search aria-hidden='true' />
				</InputGroupAddon>
				<InputGroupInput
					type='search'
					aria-label={t('projects:field.code')}
					placeholder={t('projects:list.search')}
					value={search}
					onChange={(event) => {
						setSearch(event.target.value);
						setPage(1);
					}}
				/>
			</InputGroup>
			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && data.rows.length === 0 ? (
					<EmptyState title={t('projects:warranty.none')} />
				) : (
					<>
						<DataTable columns={columns} data={data?.rows ?? []} getRowId={(row) => row.id} loading={isPending} />
						{data && data.pagination.totalPages > 1 && (
							<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
						)}
					</>
				)}
			</DataTableCard>
		</div>
	);
}
