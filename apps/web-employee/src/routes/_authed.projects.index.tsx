import { useState } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge } from '@ims-erp/ui/components/badge';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { myProjectsQueryOptions } from '@/lib/project-api';

/** `/projects` — projects the caller is the PIC of or has a live task in. */
export function ProjectsPage() {
	const { t } = useTranslation('employee');
	const [search, setSearch] = useState('');
	const { data, isPending, isError, error } = useQuery(
		myProjectsQueryOptions({ search: search.trim() || undefined }),
	);

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='space-y-1'>
				<h1 className='text-xl font-semibold md:text-2xl'>{t('projects.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('projects.subtitle')}</p>
			</header>

			<Input
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				placeholder={t('projects.search')}
				className='max-w-sm'
			/>

			{isPending ? (
				<PageSkeleton cards={2} />
			) : isError ? (
				<ErrorState error={error} />
			) : (data ?? []).length === 0 ? (
				<EmptyState title={t('projects.empty')} bordered />
			) : (
				<ul className='grid gap-2 md:grid-cols-2'>
					{(data ?? []).map((project) => (
						<li key={project.id}>
							<Link to='/projects/$projectId' params={{ projectId: project.id }}>
								<Card className='transition-colors hover:bg-muted/50'>
									<CardContent className='space-y-2 p-4'>
										<div className='flex items-start justify-between gap-2'>
											<div>
												<p className='text-xs text-muted-foreground'>{project.code}</p>
												<p className='font-medium'>{project.title}</p>
											</div>
											<div className='flex shrink-0 items-center gap-1'>
												{project.isPic ? <Badge>{t('projects.picBadge')}</Badge> : null}
												<Badge variant='secondary'>
													{t(`projects.status.${project.status}` as const)}
												</Badge>
											</div>
										</div>
										<p className='text-sm text-muted-foreground'>{project.customerName}</p>
										<div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
											<Badge variant='outline'>{t(`projects.stage.${project.stage}` as const)}</Badge>
											{project.siteName ? <span>{project.siteName}</span> : null}
										</div>
									</CardContent>
								</Card>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export const Route = createFileRoute('/_authed/projects/')({
	component: ProjectsPage,
});
