import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ims-erp/ui/components/input-group';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate } from '@/lib/format';
import { allBastsQueryOptions, type TBastRow } from '@/lib/handover-api';

/** `/projects/bast` — BASTs of the projects visible to the caller. */
export const Route = createFileRoute('/_authed/projects/bast/')({
	component: BastListPage,
});

function BastListPage() {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(allBastsQueryOptions({ page, search: deferredSearch || undefined }));

	const columns = useMemo<ColumnDef<DataTableFeatures, TBastRow, CellData>[]>(
		() => [
			{
				id: 'number',
				header: t('projects:bast.number'),
				cell: ({ row }) => (
					<Link
						to='/projects/$projectId/bast/$bastId/print'
						params={{ projectId: row.original.projectId, bastId: row.original.id }}
						className='font-medium hover:underline'
					>
						{row.original.code}
					</Link>
				),
			},
			{
				id: 'project',
				header: t('projects:field.code'),
				cell: ({ row }) => (
					<Link
						to='/projects/$projectId'
						params={{ projectId: row.original.projectId }}
						className='hover:underline'
					>
						{row.original.projectCode}
					</Link>
				),
			},
			{
				id: 'firstParty',
				header: t('projects:bast.firstParty'),
				cell: ({ row }) => (
					<>
						<div>{row.original.firstPartyCompany}</div>
						<div className='text-xs text-muted-foreground'>{row.original.workTitle}</div>
					</>
				),
			},
			{
				id: 'date',
				header: t('projects:bast.date'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => formatBusinessDate(row.original.bastDate, i18n.language),
			},
			{
				id: 'status',
				header: '',
				cell: ({ row }) =>
					row.original.status === 'cancelled' ? (
						<Badge variant='outline'>{t('projects:bast.cancelled')}</Badge>
					) : null,
			},
		],
		[t, i18n.language],
	);

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('projects:bastList.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('projects:bastList.description')}</p>
			</div>
			<InputGroup className='max-w-sm'>
				<InputGroupAddon align='inline-start'>
					<Search aria-hidden='true' />
				</InputGroupAddon>
				<InputGroupInput
					type='search'
					aria-label={t('projects:bastList.search')}
					placeholder={t('projects:bastList.search')}
					value={search}
					onChange={(event) => {
						setSearch(event.target.value);
						setPage(1);
					}}
				/>
			</InputGroup>
			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && data.rows.length === 0 ? (
				<EmptyState title={t('projects:bast.none')} bordered />
			) : (
				<>
					<DataTable columns={columns} data={data?.rows ?? []} getRowId={(row) => row.id} loading={isPending} bordered />
					{data && data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
		</div>
	);
}
