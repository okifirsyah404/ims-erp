import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ims-erp/ui/components/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate } from '@/lib/format';
import {
	PROJECT_STATUS_VARIANT,
	PROJECT_STATUSES,
	projectsQueryOptions,
	type TProject,
	type TProjectStatus,
} from '@/lib/project-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/projects` — projects visible to the caller (M07, ADR-0011 step 6a). */
export const Route = createFileRoute('/_authed/projects/')({
	component: ProjectListPage,
});

function ProjectListPage() {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const canCreate = usePermission('project.create');
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<TProjectStatus | ''>('');
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		projectsQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined }),
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TProject, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('projects:field.code'),
				cell: ({ row }) => (
					<Link
						to='/projects/$projectId'
						params={{ projectId: row.original.id }}
						className='font-medium hover:underline'
					>
						{row.original.code}
					</Link>
				),
			},
			{
				id: 'title',
				header: t('projects:field.title'),
				cell: ({ row }) => (
					<>
						<div>{row.original.title}</div>
						<div className='text-xs text-muted-foreground'>{row.original.customerName}</div>
					</>
				),
			},
			{
				id: 'pic',
				header: t('projects:field.pic'),
				cell: ({ row }) => row.original.pic?.name ?? '—',
			},
			{
				id: 'stage',
				header: t('projects:field.stage'),
				cell: ({ row }) => t(`projects:stage.${row.original.stage}`),
			},
			{
				id: 'targetEnd',
				header: t('projects:field.targetEnd'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) =>
					row.original.targetEndDate
						? formatBusinessDate(row.original.targetEndDate, i18n.language)
						: '—',
			},
			{
				id: 'status',
				header: t('projects:field.status'),
				cell: ({ row }) => (
					<Badge variant={PROJECT_STATUS_VARIANT[row.original.status]}>
						{t(`projects:status.${row.original.status}`)}
					</Badge>
				),
			},
		],
		[t, i18n.language],
	);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('projects:list.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('projects:list.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/projects/new' />} nativeButton={false}>
						{t('projects:list.new')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap gap-2'>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === null || value === 'all' ? '' : (value as TProjectStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('projects:field.status')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('projects:list.allStatuses')}</SelectItem>
						{PROJECT_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`projects:status.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<InputGroup className='max-w-sm'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('projects:list.search')}
						placeholder={t('projects:list.search')}
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
					/>
				</InputGroup>
			</div>
			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && data.rows.length === 0 ? (
				<EmptyState title={t('projects:list.empty')} bordered />
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
