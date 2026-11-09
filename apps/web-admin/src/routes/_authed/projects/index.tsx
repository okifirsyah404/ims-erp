import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate } from '@/lib/format';
import { PROJECT_STATUS_VARIANT, PROJECT_STATUSES, projectsQueryOptions, type TProjectStatus } from '@/lib/project-api';
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
				<select
					aria-label={t('projects:field.status')}
					className='h-9 rounded-md border bg-transparent px-3 text-sm'
					value={status}
					onChange={(event) => {
						setStatus(event.target.value as TProjectStatus | '');
						setPage(1);
					}}
				>
					<option value=''>{t('projects:list.allStatuses')}</option>
					{PROJECT_STATUSES.map((value) => (
						<option key={value} value={value}>
							{t(`projects:status.${value}`)}
						</option>
					))}
				</select>
				<Input
					type='search'
					className='max-w-sm'
					aria-label={t('projects:list.search')}
					placeholder={t('projects:list.search')}
					value={search}
					onChange={(event) => {
						setSearch(event.target.value);
						setPage(1);
					}}
				/>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('projects:list.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('projects:field.code')}</TableHead>
										<TableHead>{t('projects:field.title')}</TableHead>
										<TableHead>{t('projects:field.pic')}</TableHead>
										<TableHead>{t('projects:field.stage')}</TableHead>
										<TableHead>{t('projects:field.targetEnd')}</TableHead>
										<TableHead>{t('projects:field.status')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((project) => (
										<TableRow key={project.id}>
											<TableCell>
												<Link to='/projects/$projectId' params={{ projectId: project.id }} className='font-medium hover:underline'>
													{project.code}
												</Link>
											</TableCell>
											<TableCell>
												<div>{project.title}</div>
												<div className='text-xs text-muted-foreground'>{project.customerName}</div>
											</TableCell>
											<TableCell>{project.pic?.name ?? '—'}</TableCell>
											<TableCell>{t(`projects:stage.${project.stage}`)}</TableCell>
											<TableCell className='text-muted-foreground'>
												{project.targetEndDate ? formatBusinessDate(project.targetEndDate, i18n.language) : '—'}
											</TableCell>
											<TableCell>
												<Badge variant={PROJECT_STATUS_VARIANT[project.status]}>{t(`projects:status.${project.status}`)}</Badge>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
					{data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
		</div>
	);
}
