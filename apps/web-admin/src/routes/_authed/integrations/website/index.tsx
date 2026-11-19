import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Switch } from '@ims-erp/ui/components/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ims-erp/ui/components/tabs';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { toast } from '@/components/toast';
import { usePermission } from '@/lib/use-permission';
import {
	createWebsiteKey,
	revokeWebsiteKey,
	saveWebsiteMenu,
	saveWebsiteSite,
	SOCIAL_KEYS,
	type TCreatedWebsiteKey,
	type TMenuItem,
	type TWebMenu,
	type TWebMenuCode,
	type TWebSite,
	websiteKeysQueryOptions,
	websiteMenuQueryOptions,
	websiteSiteQueryOptions,
} from '@/lib/website-api';

/** `/integrations/website` — the public website's identity, navigation and API keys (ERP-0071 stage 1). */
export const Route = createFileRoute('/_authed/integrations/website/')({
	component: WebsiteSettingsPage,
});

const EMPTY_SITE: TWebSite = {
	brandName: '',
	legalName: null,
	tagline: null,
	address: null,
	phone: null,
	email: null,
	whatsapp: null,
	hotlineHours: null,
	supportEmail: null,
	supportWhatsapp: null,
	socialLinks: [],
	defaultSeoTitle: null,
	defaultSeoDescription: null,
};

function WebsiteSettingsPage() {
	const { t } = useTranslation(['integrations', 'common']);
	const canManageKeys = usePermission('integration.configure');

	return (
		<div className='flex flex-col gap-6 p-4 md:p-6'>
			<div>
				<h1 className='text-2xl font-semibold'>{t('website.title')}</h1>
				<p className='text-muted-foreground text-sm'>{t('website.description')}</p>
			</div>
			<Tabs defaultValue='identity'>
				<TabsList>
					<TabsTrigger value='identity'>{t('website.tab.identity')}</TabsTrigger>
					<TabsTrigger value='menus'>{t('website.tab.menus')}</TabsTrigger>
					{canManageKeys ? <TabsTrigger value='keys'>{t('website.tab.keys')}</TabsTrigger> : null}
				</TabsList>
				<TabsContent value='identity'>
					<IdentityTab />
				</TabsContent>
				<TabsContent value='menus' className='flex flex-col gap-6'>
					<MenuEditor code='main' />
					<MenuEditor code='footer' />
				</TabsContent>
				{canManageKeys ? (
					<TabsContent value='keys'>
						<KeysTab />
					</TabsContent>
				) : null}
			</Tabs>
		</div>
	);
}

/** Text input bound to a nullable string field. */
function TextField({
	id,
	label,
	value,
	onChange,
	type = 'text',
	hint,
	disabled,
	required,
}: {
	id: string;
	label: string;
	value: string | null;
	onChange: (value: string | null) => void;
	type?: 'text' | 'email' | 'tel' | 'url';
	hint?: string;
	disabled?: boolean;
	required?: boolean;
}) {
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				id={id}
				type={type}
				value={value ?? ''}
				required={required}
				disabled={disabled}
				inputMode={type === 'tel' ? 'tel' : undefined}
				onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
			/>
			{hint ? <FieldDescription>{hint}</FieldDescription> : null}
		</Field>
	);
}

function IdentityTab() {
	const { t } = useTranslation(['integrations', 'common']);
	const queryClient = useQueryClient();
	const canUpdate = usePermission('catalog.update');
	const { data, isPending, isError, error } = useQuery(websiteSiteQueryOptions());
	const [site, setSite] = useState<TWebSite>(EMPTY_SITE);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (data) setSite(data);
	}, [data]);

	if (isPending) return <p className='text-muted-foreground p-4 text-sm'>{t('common:state.loading')}</p>;
	if (isError) return <p className='text-destructive p-4 text-sm'>{error.message}</p>;

	const set = <K extends keyof TWebSite>(key: K) => (value: TWebSite[K]) => setSite((current) => ({ ...current, [key]: value }));
	const socialUrl = (key: (typeof SOCIAL_KEYS)[number]) => site.socialLinks.find((link) => link.key === key)?.url ?? null;
	const setSocial = (key: (typeof SOCIAL_KEYS)[number]) => (url: string | null) =>
		setSite((current) => ({
			...current,
			socialLinks: SOCIAL_KEYS.flatMap((socialKey) => {
				const next = socialKey === key ? url : (current.socialLinks.find((link) => link.key === socialKey)?.url ?? null);
				return next ? [{ key: socialKey, url: next }] : [];
			}),
		}));

	const save = async () => {
		setBusy(true);
		try {
			await saveWebsiteSite(site);
			await queryClient.invalidateQueries({ queryKey: ['website', 'site'] });
			toast.success(t('website.saved'));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};

	const disabled = !canUpdate || busy;
	return (
		<form
			className='flex flex-col gap-6'
			onSubmit={(event) => {
				event.preventDefault();
				void save();
			}}
		>
			<Card>
				<CardHeader>
					<CardTitle>{t('website.identity.title')}</CardTitle>
					<CardDescription>{t('website.identity.description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup className='grid gap-4 md:grid-cols-2'>
						<TextField id='brandName' label={t('website.field.brandName')} value={site.brandName} onChange={(value) => set('brandName')(value ?? '')} required disabled={disabled} />
						<TextField id='legalName' label={t('website.field.legalName')} value={site.legalName} onChange={set('legalName')} disabled={disabled} />
						<TextField id='tagline' label={t('website.field.tagline')} value={site.tagline} onChange={set('tagline')} disabled={disabled} />
						<TextField id='hotlineHours' label={t('website.field.hotlineHours')} value={site.hotlineHours} onChange={set('hotlineHours')} disabled={disabled} />
						<Field className='md:col-span-2'>
							<FieldLabel htmlFor='address'>{t('website.field.address')}</FieldLabel>
							<Textarea id='address' value={site.address ?? ''} disabled={disabled} onChange={(event) => set('address')(event.target.value || null)} />
						</Field>
						<TextField id='phone' type='tel' label={t('website.field.phone')} value={site.phone} onChange={set('phone')} disabled={disabled} />
						<TextField id='email' type='email' label={t('website.field.email')} value={site.email} onChange={set('email')} disabled={disabled} />
						<TextField id='whatsapp' type='tel' label={t('website.field.whatsapp')} value={site.whatsapp} onChange={set('whatsapp')} disabled={disabled} />
						<TextField id='supportEmail' type='email' label={t('website.field.supportEmail')} value={site.supportEmail} onChange={set('supportEmail')} disabled={disabled} />
						<TextField id='supportWhatsapp' type='tel' label={t('website.field.supportWhatsapp')} value={site.supportWhatsapp} onChange={set('supportWhatsapp')} disabled={disabled} />
					</FieldGroup>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>{t('website.social.title')}</CardTitle>
					<CardDescription>{t('website.social.description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup className='grid gap-4 md:grid-cols-2'>
						{SOCIAL_KEYS.map((key) => (
							<TextField key={key} id={`social-${key}`} type='url' label={t(`website.social.${key}`)} value={socialUrl(key)} onChange={setSocial(key)} hint='https://…' disabled={disabled} />
						))}
					</FieldGroup>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>{t('website.seo.title')}</CardTitle>
					<CardDescription>{t('website.seo.description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<TextField id='seoTitle' label={t('website.field.seoTitle')} value={site.defaultSeoTitle} onChange={set('defaultSeoTitle')} disabled={disabled} />
						<Field>
							<FieldLabel htmlFor='seoDescription'>{t('website.field.seoDescription')}</FieldLabel>
							<Textarea id='seoDescription' maxLength={320} value={site.defaultSeoDescription ?? ''} disabled={disabled} onChange={(event) => set('defaultSeoDescription')(event.target.value || null)} />
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>
			{canUpdate ? (
				<div className='flex justify-end'>
					<Button type='submit' disabled={busy || site.brandName.trim() === ''}>
						{t('website.save')}
					</Button>
				</div>
			) : null}
		</form>
	);
}

/** Rows of label + link with an active switch, reorder and remove. */
function ItemsEditor({ items, onChange, disabled }: { items: TMenuItem[]; onChange: (items: TMenuItem[]) => void; disabled: boolean }) {
	const { t } = useTranslation(['integrations', 'common']);
	const update = (index: number, patch: Partial<TMenuItem>) => onChange(items.map((item, at) => (at === index ? { ...item, ...patch } : item)));
	const move = (index: number, by: -1 | 1) => {
		const next = [...items];
		const [moved] = next.splice(index, 1);
		next.splice(index + by, 0, moved!);
		onChange(next);
	};
	return (
		<div className='flex flex-col gap-2'>
			{items.map((item, index) => (
				<div key={index} className='grid grid-cols-[1fr_1.4fr_auto] items-center gap-2'>
					<Input aria-label={t('website.menu.label')} placeholder={t('website.menu.label')} value={item.label} disabled={disabled} onChange={(event) => update(index, { label: event.target.value })} />
					<Input aria-label={t('website.menu.url')} placeholder='/products' value={item.url} disabled={disabled} onChange={(event) => update(index, { url: event.target.value })} />
					<div className='flex items-center gap-1'>
						<Switch aria-label={t('website.menu.active')} checked={item.isActive} disabled={disabled} onCheckedChange={(checked) => update(index, { isActive: checked })} />
						<Button type='button' size='icon' variant='ghost' aria-label={t('website.menu.up')} disabled={disabled || index === 0} onClick={() => move(index, -1)}>
							<ArrowUp />
						</Button>
						<Button type='button' size='icon' variant='ghost' aria-label={t('website.menu.down')} disabled={disabled || index === items.length - 1} onClick={() => move(index, 1)}>
							<ArrowDown />
						</Button>
						<Button type='button' size='icon' variant='ghost' aria-label={t('website.menu.remove')} disabled={disabled} onClick={() => onChange(items.filter((_, at) => at !== index))}>
							<Trash2 />
						</Button>
					</div>
				</div>
			))}
			<div>
				<Button type='button' size='sm' variant='outline' disabled={disabled || items.length >= 30} onClick={() => onChange([...items, { label: '', url: '/', isActive: true }])}>
					<Plus /> {t('website.menu.addItem')}
				</Button>
			</div>
		</div>
	);
}

function MenuEditor({ code }: { code: TWebMenuCode }) {
	const { t } = useTranslation(['integrations', 'common']);
	const queryClient = useQueryClient();
	const canUpdate = usePermission('catalog.update');
	const { data, isPending, isError, error } = useQuery(websiteMenuQueryOptions(code));
	const [menu, setMenu] = useState<TWebMenu | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (data) setMenu({ ...data, name: data.name || t(`website.menu.default.${code}`) });
	}, [data, code, t]);

	if (isPending || !menu) return isError ? <p className='text-destructive text-sm'>{error.message}</p> : <p className='text-muted-foreground text-sm'>{t('common:state.loading')}</p>;

	const disabled = !canUpdate || busy;
	const save = async () => {
		setBusy(true);
		try {
			await saveWebsiteMenu(code, { name: menu.name, items: menu.items, children: menu.children });
			await queryClient.invalidateQueries({ queryKey: ['website', 'menu', code] });
			toast.success(t('website.saved'));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t(`website.menu.title.${code}`)}</CardTitle>
				<CardDescription>{t(`website.menu.hint.${code}`)}</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				{code === 'main' ? (
					<ItemsEditor items={menu.items} disabled={disabled} onChange={(items) => setMenu({ ...menu, items })} />
				) : (
					<div className='flex flex-col gap-4'>
						{menu.children.map((child, index) => (
							<div key={index} className='flex flex-col gap-2 rounded-md border p-3'>
								<div className='flex items-center gap-2'>
									<Input
										aria-label={t('website.menu.columnName')}
										placeholder={t('website.menu.columnName')}
										value={child.name}
										disabled={disabled}
										onChange={(event) => setMenu({ ...menu, children: menu.children.map((c, at) => (at === index ? { ...c, name: event.target.value } : c)) })}
									/>
									<Switch
										aria-label={t('website.menu.active')}
										checked={child.isActive}
										disabled={disabled}
										onCheckedChange={(checked) => setMenu({ ...menu, children: menu.children.map((c, at) => (at === index ? { ...c, isActive: checked } : c)) })}
									/>
									<Button type='button' size='icon' variant='ghost' aria-label={t('website.menu.removeColumn')} disabled={disabled} onClick={() => setMenu({ ...menu, children: menu.children.filter((_, at) => at !== index) })}>
										<Trash2 />
									</Button>
								</div>
								<ItemsEditor
									items={child.items}
									disabled={disabled}
									onChange={(items) => setMenu({ ...menu, children: menu.children.map((c, at) => (at === index ? { ...c, items } : c)) })}
								/>
							</div>
						))}
						<div>
							<Button
								type='button'
								size='sm'
								variant='outline'
								disabled={disabled || menu.children.length >= 8}
								onClick={() => setMenu({ ...menu, children: [...menu.children, { name: '', isActive: true, items: [] }] })}
							>
								<Plus /> {t('website.menu.addColumn')}
							</Button>
						</div>
					</div>
				)}
				{canUpdate ? (
					<div className='flex justify-end'>
						<Button type='button' disabled={busy} onClick={() => void save()}>
							{t('website.save')}
						</Button>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

function KeysTab() {
	const { t } = useTranslation(['integrations', 'common']);
	const queryClient = useQueryClient();
	const { data, isPending, isError, error } = useQuery(websiteKeysQueryOptions());
	const [name, setName] = useState('');
	const [created, setCreated] = useState<TCreatedWebsiteKey | null>(null);
	const [busy, setBusy] = useState(false);

	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['website', 'keys'] });
			toast.success(done);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('website.keys.title')}</CardTitle>
				<CardDescription>{t('website.keys.description')}</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				<form
					className='flex flex-wrap items-end gap-2'
					onSubmit={(event) => {
						event.preventDefault();
						void run(async () => {
							setCreated(await createWebsiteKey(name.trim()));
							setName('');
						}, t('website.keys.created'));
					}}
				>
					<Field className='min-w-64 flex-1'>
						<FieldLabel htmlFor='keyName'>{t('website.keys.name')}</FieldLabel>
						<Input id='keyName' value={name} maxLength={80} placeholder={t('website.keys.namePlaceholder')} onChange={(event) => setName(event.target.value)} />
					</Field>
					<Button type='submit' disabled={busy || name.trim() === ''}>
						<Plus /> {t('website.keys.create')}
					</Button>
				</form>
				{isPending ? <p className='text-muted-foreground text-sm'>{t('common:state.loading')}</p> : null}
				{isError ? <p className='text-destructive text-sm'>{error.message}</p> : null}
				{data ? (
					data.length === 0 ? (
						<p className='text-muted-foreground text-sm'>{t('website.keys.empty')}</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('website.keys.name')}</TableHead>
									<TableHead>{t('website.keys.prefix')}</TableHead>
									<TableHead>{t('website.keys.createdAt')}</TableHead>
									<TableHead>{t('website.keys.lastUsed')}</TableHead>
									<TableHead>{t('website.keys.status')}</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.map((key) => (
									<TableRow key={key.id}>
										<TableCell>{key.name ?? '—'}</TableCell>
										<TableCell className='font-mono'>{key.start ? `${key.start}…` : '—'}</TableCell>
										<TableCell>{key.createdAt ? new Date(key.createdAt).toLocaleString() : '—'}</TableCell>
										<TableCell>{key.lastRequest ? new Date(key.lastRequest).toLocaleString() : t('website.keys.never')}</TableCell>
										<TableCell>
											<Badge variant={key.enabled ? 'default' : 'secondary'}>{key.enabled ? t('website.keys.active') : t('website.keys.revoked')}</Badge>
										</TableCell>
										<TableCell className='text-right'>
											{key.enabled ? (
												<Button type='button' size='sm' variant='outline' disabled={busy} onClick={() => void run(() => revokeWebsiteKey(key.id), t('website.keys.revokedToast'))}>
													{t('website.keys.revoke')}
												</Button>
											) : null}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)
				) : null}
			</CardContent>
			<Dialog open={created !== null} onOpenChange={(open) => (open ? null : setCreated(null))}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('website.keys.secretTitle')}</DialogTitle>
						<DialogDescription>{t('website.keys.secretHint')}</DialogDescription>
					</DialogHeader>
					<code className='bg-muted rounded p-3 font-mono text-sm break-all'>{created?.key}</code>
					<DialogFooter>
						<Button
							type='button'
							variant='outline'
							onClick={() => {
								if (created) void navigator.clipboard.writeText(created.key).then(() => toast.success(t('website.keys.copied')));
							}}
						>
							<Copy /> {t('website.keys.copy')}
						</Button>
						<Button type='button' onClick={() => setCreated(null)}>
							{t('website.keys.done')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
