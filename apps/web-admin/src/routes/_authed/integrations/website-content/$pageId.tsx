import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Archive, Eye, EyeOff, Save, Trash2 } from 'lucide-react';
import { z } from 'zod';

import { type TContentField, WEBSITE_CONTENT_TYPES, type TWebsiteContentTypeKey, websiteContentSchema } from '@ims-erp/common';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { toast } from '@/components/toast';
import { ContentFields } from '@/components/website/content-form';
import { cleanContent, useFieldLabel } from '@/lib/website-content-form';
import { usePermission } from '@/lib/use-permission';
import {
	createWebPage,
	deleteWebPage,
	setWebPageStatus,
	STATUS_VARIANT,
	type TWebPage,
	type TWebPageBody,
	type TWebPageStatus,
	updateWebPage,
	webPageQueryOptions,
} from '@/lib/website-content-api';

const TYPE_KEYS = WEBSITE_CONTENT_TYPES.map((type) => type.key) as [TWebsiteContentTypeKey, ...TWebsiteContentTypeKey[]];

/** The slug of single-page types (home, about, careers, warranty, installation). */
const SINGLETON_SLUG = 'home';

/** `/integrations/website-content/:pageId` — edit one entry; `new` creates one of `?type=`. */
export const Route = createFileRoute('/_authed/integrations/website-content/$pageId')({
	validateSearch: z.object({ type: z.enum(TYPE_KEYS).catch('home') }),
	component: WebsiteContentEditorPage,
});

type TDraft = Omit<TWebPageBody, 'pageType' | 'version'>;

const slugify = (value: string) =>
	value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 128);

function WebsiteContentEditorPage() {
	const { pageId } = Route.useParams();
	const { type } = Route.useSearch();
	const isNew = pageId === 'new';
	const { t } = useTranslation(['integrations', 'common']);
	const { data, isPending, isError, error } = useQuery({ ...webPageQueryOptions(pageId), enabled: !isNew });

	if (!isNew && isPending) return <p className='text-muted-foreground p-6 text-sm'>{t('common:state.loading')}</p>;
	if (!isNew && isError) return <p className='text-destructive p-6 text-sm'>{error.message}</p>;
	return <Editor key={data ? `${data.id}-${data.version}` : 'new'} page={data ?? null} pageType={data?.pageType ?? type} />;
}

function Editor({ page, pageType }: { page: TWebPage | null; pageType: TWebsiteContentTypeKey }) {
	const { t } = useTranslation(['integrations', 'common']);
	const label = useFieldLabel();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const definition = WEBSITE_CONTENT_TYPES.find((entry) => entry.key === pageType)!;
	const canSave = usePermission(page ? 'catalog.update' : 'catalog.create');
	const canPublish = usePermission('catalog.publish');
	const canArchive = usePermission('catalog.archive');

	const initial: TDraft = page
		? { slug: page.slug, title: page.title, position: page.position, seoTitle: page.seoTitle, seoDescription: page.seoDescription, content: page.content }
		: {
				slug: definition.singleton ? SINGLETON_SLUG : '',
				title: definition.singleton ? t(`website.content.type.${pageType}` as never) : '',
				position: 0,
				seoTitle: null,
				seoDescription: null,
				content: {},
			};
	const [draft, setDraft] = useState<TDraft>(initial);
	const [slugTouched, setSlugTouched] = useState(Boolean(page) || definition.singleton);
	const [issues, setIssues] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

	useEffect(() => setIssues([]), [draft]);

	const invalidate = () => queryClient.invalidateQueries({ queryKey: ['website'] });

	/** Readable path of a validation issue, e.g. "Hero section › Title". */
	const issuePath = (path: PropertyKey[]) => {
		let fields: readonly TContentField[] = definition.fields;
		const parts: string[] = [];
		for (const segment of path) {
			if (typeof segment === 'number') {
				parts.push(`#${segment + 1}`);
				continue;
			}
			const field = fields.find((entry) => entry.key === segment);
			parts.push(field ? label(field.key) : String(segment));
			fields = field?.fields ?? [];
		}
		return parts.join(' › ');
	};

	const run = async (action: () => Promise<void>) => {
		setBusy(true);
		try {
			await action();
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};

	const save = () => {
		const content = (cleanContent(draft.content) as Record<string, unknown> | undefined) ?? {};
		const parsed = websiteContentSchema(definition).safeParse(content);
		if (!parsed.success) {
			setIssues(parsed.error.issues.map((issue) => issuePath(issue.path)));
			toast.error(t('website.content.invalid', { count: parsed.error.issues.length }));
			return;
		}
		const body: TWebPageBody = { ...draft, pageType, content: parsed.data, ...(page ? { version: page.version } : {}) };
		void run(async () => {
			if (page) {
				await updateWebPage(page.id, body);
				await invalidate();
				toast.success(t('website.content.saved'));
			} else {
				const created = await createWebPage(body);
				await invalidate();
				toast.success(t('website.content.created'));
				await navigate({ to: '/integrations/website-content/$pageId', params: { pageId: created.id }, search: { type: pageType } });
			}
		});
	};

	const changeStatus = (status: TWebPageStatus) =>
		run(async () => {
			await setWebPageStatus(page!.id, status);
			await invalidate();
			toast.success(t('website.content.statusChanged'));
		});

	const remove = () => {
		if (!window.confirm(t('website.content.deleteConfirm'))) return;
		void run(async () => {
			await deleteWebPage(page!.id);
			await invalidate();
			toast.success(t('website.content.deleted'));
			await navigate({ to: '/integrations/website-content', search: { type: pageType } });
		});
	};

	const disabled = !canSave || busy;
	return (
		<form
			className='flex flex-col gap-6 p-4 md:p-6'
			onSubmit={(event) => {
				event.preventDefault();
				save();
			}}
		>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div className='flex flex-col gap-1'>
					<Button
						variant='ghost'
						size='sm'
						className='w-fit'
						nativeButton={false}
						render={<Link to='/integrations/website-content' search={{ type: pageType }} />}
					>
						<ArrowLeft /> {t('website.content.back')}
					</Button>
					<h1 className='flex items-center gap-3 text-2xl font-semibold'>
						{draft.title || t(`website.content.type.${pageType}` as never)}
						{page ? <Badge variant={STATUS_VARIANT[page.status]}>{t(`website.content.status.${page.status}`)}</Badge> : null}
					</h1>
					<p className='text-muted-foreground text-sm'>{t(`website.content.type.${pageType}` as never)}</p>
				</div>
				<div className='flex flex-wrap gap-2'>
					{page && canPublish ? (
						page.status === 'published' ? (
							<Button type='button' variant='outline' disabled={busy} onClick={() => void changeStatus('draft')}>
								<EyeOff /> {t('website.content.unpublish')}
							</Button>
						) : (
							<Button type='button' variant='outline' disabled={busy || dirty} title={dirty ? t('website.content.unsaved') : undefined} onClick={() => void changeStatus('published')}>
								<Eye /> {t('website.content.publish')}
							</Button>
						)
					) : null}
					{page && canPublish && page.status !== 'archived' ? (
						<Button type='button' variant='outline' disabled={busy} onClick={() => void changeStatus('archived')}>
							<Archive /> {t('website.content.archive')}
						</Button>
					) : null}
					{page && canArchive ? (
						<Button type='button' variant='destructive' disabled={busy} onClick={remove}>
							<Trash2 /> {t('website.content.delete')}
						</Button>
					) : null}
					{canSave ? (
						<Button type='submit' disabled={busy || (page !== null && !dirty)}>
							<Save /> {t('website.content.save')}
						</Button>
					) : null}
				</div>
			</div>

			{issues.length > 0 ? (
				<div role='alert' className='border-destructive/50 text-destructive rounded-lg border p-4 text-sm'>
					<p className='font-medium'>{t('website.content.invalid', { count: issues.length })}</p>
					<ul className='mt-2 list-disc pl-5'>
						{issues.slice(0, 10).map((issue, index) => (
							<li key={index}>{issue}</li>
						))}
					</ul>
				</div>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle>{t('website.content.meta.title')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-4 md:grid-cols-2'>
					<Field>
						<FieldLabel htmlFor='title'>{t('website.content.col.title')} *</FieldLabel>
						<Input
							id='title'
							value={draft.title}
							required
							maxLength={200}
							disabled={disabled}
							onChange={(event) => {
								const title = event.target.value;
								setDraft((current) => ({ ...current, title, slug: slugTouched ? current.slug : slugify(title) }));
							}}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor='slug'>{t('website.content.meta.slug')} *</FieldLabel>
						<Input
							id='slug'
							value={draft.slug}
							required
							pattern='[a-z0-9]+(-[a-z0-9]+)*'
							maxLength={128}
							disabled={disabled || definition.singleton}
							onChange={(event) => {
								setSlugTouched(true);
								setDraft((current) => ({ ...current, slug: event.target.value }));
							}}
						/>
						<FieldDescription>{pageType === 'legal' ? t('website.content.meta.legalHint') : t('website.content.meta.slugHint')}</FieldDescription>
					</Field>
					{definition.singleton ? null : (
						<Field>
							<FieldLabel htmlFor='position'>{t('website.content.col.position')}</FieldLabel>
							<Input
								id='position'
								type='number'
								inputMode='numeric'
								min={0}
								step={1}
								value={draft.position}
								disabled={disabled}
								onChange={(event) => setDraft((current) => ({ ...current, position: Math.max(0, Math.trunc(Number(event.target.value) || 0)) }))}
							/>
						</Field>
					)}
					<Field className='md:col-span-2'>
						<FieldLabel htmlFor='seoTitle'>{t('website.content.meta.seoTitle')}</FieldLabel>
						<Input
							id='seoTitle'
							value={draft.seoTitle ?? ''}
							maxLength={200}
							disabled={disabled}
							onChange={(event) => setDraft((current) => ({ ...current, seoTitle: event.target.value || null }))}
						/>
					</Field>
					<Field className='md:col-span-2'>
						<FieldLabel htmlFor='seoDescription'>{t('website.content.meta.seoDescription')}</FieldLabel>
						<Textarea
							id='seoDescription'
							value={draft.seoDescription ?? ''}
							maxLength={500}
							disabled={disabled}
							onChange={(event) => setDraft((current) => ({ ...current, seoDescription: event.target.value || null }))}
						/>
					</Field>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('website.content.fields.title')}</CardTitle>
				</CardHeader>
				<CardContent>
					<ContentFields fields={definition.fields} value={draft.content} disabled={disabled} idPrefix='content' onChange={(content) => setDraft((current) => ({ ...current, content }))} />
				</CardContent>
			</Card>
		</form>
	);
}
