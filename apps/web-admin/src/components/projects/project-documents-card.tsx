import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { toast } from '@/components/toast';
import { formatBusinessDate } from '@/lib/format';
import { cancelBast, projectBastsQueryOptions, warrantyQueryOptions } from '@/lib/handover-api';
import type { TProjectDetail } from '@/lib/project-api';
import { usePermission } from '@/lib/use-permission';

/**
 * Hand-over documents of a project: its BASTs (several allowed, owner
 * decision 2026-11-06) and the warranty certificate, with print links.
 */
export function ProjectDocumentsCard({ project }: { project: TProjectDetail }) {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const queryClient = useQueryClient();
	const canUpdate = usePermission('project.update');
	const basts = useQuery(projectBastsQueryOptions(project.id));
	const warranty = useQuery(warrantyQueryOptions(project.id));
	const active = project.status === 'active';
	const hasIssued = (basts.data ?? []).some((bast) => bast.status === 'issued');

	return (
		<Card>
			<CardHeader className='flex flex-row items-center justify-between gap-2'>
				<CardTitle>{t('projects:documents.title')}</CardTitle>
				{active && canUpdate && (
					<Button size='sm' render={<Link to='/projects/$projectId/bast/new' params={{ projectId: project.id }} />} nativeButton={false}>
						{t('projects:bast.new')}
					</Button>
				)}
			</CardHeader>
			<CardContent className='flex flex-col gap-4 text-sm'>
				{(basts.data ?? []).length === 0 ? (
					<p className='text-muted-foreground'>{t('projects:bast.none')}</p>
				) : (
					<ul className='flex flex-col divide-y'>
						{(basts.data ?? []).map((bast) => (
							<li key={bast.id} className='flex flex-wrap items-center gap-3 py-2'>
								<div className='min-w-48 flex-1'>
									<div className='font-medium'>{bast.code}</div>
									<div className='text-xs text-muted-foreground'>
										{formatBusinessDate(bast.bastDate, i18n.language)}
										{bast.contractNumber ? ` · ${bast.contractNumber}` : ''}
									</div>
								</div>
								{bast.status === 'cancelled' && <Badge variant='outline'>{t('projects:bast.cancelled')}</Badge>}
								{bast.status === 'issued' && (
									<>
										<Link to='/projects/$projectId/bast/$bastId/print' params={{ projectId: project.id, bastId: bast.id }} className='hover:underline'>
											{t('projects:documents.print')}
										</Link>
										{active && canUpdate && (
											<>
												<Link to='/projects/$projectId/bast/$bastId' params={{ projectId: project.id, bastId: bast.id }} className='hover:underline'>
													{t('projects:detail.edit')}
												</Link>
												<Button
													variant='ghost'
													size='sm'
													onClick={async () => {
														if (!window.confirm(t('projects:bast.cancelConfirm', { code: bast.code }))) return;
														try {
															await cancelBast(project.id, bast.id);
															await queryClient.invalidateQueries({ queryKey: ['projects'] });
															toast.success(t('projects:bast.cancelledToast'));
														} catch (cause) {
															toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
														}
													}}
												>
													{t('projects:bast.cancel')}
												</Button>
											</>
										)}
									</>
								)}
							</li>
						))}
					</ul>
				)}
				<div className='flex flex-wrap items-center gap-3 border-t pt-4'>
					<div className='min-w-48 flex-1'>
						<div className='font-medium'>{t('projects:warranty.title')}</div>
						<div className='text-xs text-muted-foreground'>
							{warranty.data
								? `${warranty.data.code} · ${formatBusinessDate(warranty.data.startDate, i18n.language)} – ${formatBusinessDate(warranty.data.endDate, i18n.language)}`
								: hasIssued
									? t('projects:warranty.notYet')
									: t('projects:warranty.needsBast')}
						</div>
					</div>
					{warranty.data && (
						<Link to='/projects/$projectId/warranty/print' params={{ projectId: project.id }} className='hover:underline'>
							{t('projects:documents.print')}
						</Link>
					)}
					{project.status !== 'cancelled' && canUpdate && hasIssued && (
						<Button size='sm' variant='outline' render={<Link to='/projects/$projectId/warranty' params={{ projectId: project.id }} />} nativeButton={false}>
							{warranty.data ? t('projects:detail.edit') : t('projects:warranty.new')}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
