import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus } from 'lucide-react';
import { z } from 'zod';

import { WEBSITE_CONTENT_TYPES, type TWebsiteContentTypeKey } from '@ims-erp/common';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { usePermission } from '@/lib/use-permission';
import { STATUS_VARIANT, webPagesQueryOptions } from '@/lib/website-content-api';

const TYPE_KEYS = WEBSITE_CONTENT_TYPES.map((type) => type.key) as [TWebsiteContentTypeKey, ...TWebsiteContentTypeKey[]];

const searchSchema = z.object({ type: z.enum(TYPE_KEYS).catch('home') });

/** `/integrations/website-content` — website pages and collections (ERP-0071 stages 2-4). */
export const Route = createFileRoute('/_authed/integrations/website-content/')({
	validateSearch: searchSchema,
	component: WebsiteContentPage,
});


function WebsiteContentPage() {
	const { t } = useTranslation(['integrations', 'common']);
	const { type } = Route.useSearch();
	const definition = WEBSITE_CONTENT_TYPES.find((entry) => entry.key === type)!;
	const canCreate = usePermission('catalog.create');
	const { data, isPending, isError, error } = useQuery(webPagesQueryOptions(type));

	return (
		<div className='flex flex-col gap-6 p-4 md:p-6'>
			<div>
				<h1 className='text-2xl font-semibold'>{t('website.content.title')}</h1>
				<p className='text-muted-foreground text-sm'>{t('website.content.description')}</p>
			</div>
			<div className='grid gap-6 lg:grid-cols-[16rem_1fr]'>
				<nav aria-label={t('website.content.typeLabel')} className='flex flex-col gap-4'>
					{([2, 3, 4] as const).map((stage) => (
						<div key={stage} className='flex flex-col gap-1'>
							<span className='text-muted-foreground px-2 text-xs font-medium uppercase'>{t('website.content.stage', { stage })}</span>
							{WEBSITE_CONTENT_TYPES.filter((entry) => entry.stage === stage).map((entry) => (
								<Link
									key={entry.key}
									to='/integrations/website-content'
									search={{ type: entry.key }}
									className={`hover:bg-muted rounded-md px-2 py-1.5 text-sm ${entry.key === type ? 'bg-muted font-medium' : ''}`}
								>
									{t(`website.content.type.${entry.key}` as never)}
								</Link>
							))}
						</div>
					))}
				</nav>
				<Card>
					<CardHeader className='flex flex-row items-start justify-between gap-4'>
						<div>
							<CardTitle>{t(`website.content.type.${type}` as never)}</CardTitle>
							{data && data.length === 0 ? <CardDescription>{definition.singleton ? t('website.content.notCreated') : t('website.content.empty')}</CardDescription> : null}
						</div>
						{canCreate && (!definition.singleton || (data && data.length === 0)) ? (
							<Button size='sm' nativeButton={false} render={<Link to='/integrations/website-content/$pageId' params={{ pageId: 'new' }} search={{ type }} />}>
								<Plus /> {definition.singleton ? t('website.content.createPage') : t('website.content.new')}
							</Button>
						) : null}
					</CardHeader>
					<CardContent>
						{isPending ? (
							<p className='text-muted-foreground text-sm'>{t('common:state.loading')}</p>
						) : isError ? (
							<p className='text-destructive text-sm'>{error.message}</p>
						) : data.length === 0 ? null : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className='w-16'>{t('website.content.col.position')}</TableHead>
										<TableHead>{t('website.content.col.title')}</TableHead>
										<TableHead>{t('website.content.col.slug')}</TableHead>
										<TableHead>{t('website.content.col.status')}</TableHead>
										<TableHead>{t('website.content.col.updated')}</TableHead>
										<TableHead className='w-16' />
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.map((page) => (
										<TableRow key={page.id}>
											<TableCell>{page.position}</TableCell>
											<TableCell className='font-medium'>{page.title}</TableCell>
											<TableCell className='text-muted-foreground font-mono text-xs'>{page.slug}</TableCell>
											<TableCell>
												<Badge variant={STATUS_VARIANT[page.status]}>{t(`website.content.status.${page.status}`)}</Badge>
											</TableCell>
											<TableCell className='text-muted-foreground text-xs'>{new Date(page.updatedAt).toLocaleString()}</TableCell>
											<TableCell>
												<Button
													size='icon'
													variant='ghost'
													aria-label={t('website.content.edit')}
													nativeButton={false}
													render={<Link to='/integrations/website-content/$pageId' params={{ pageId: page.id }} search={{ type }} />}
												>
													<Pencil />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
