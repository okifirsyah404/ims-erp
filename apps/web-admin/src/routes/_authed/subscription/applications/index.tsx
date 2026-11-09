import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { toast } from '@/components/toast';
import {
	APPLICATION_SOURCES,
	applicationsQueryOptions,
	createApplication,
	restoreApplication,
	retireApplication,
	type TApplicationSource,
	type TLicensableApplication,
	updateApplication,
} from '@/lib/license-api';
import { usePermission } from '@/lib/use-permission';

/** `/subscription/applications` — the applications licenses are sold for. */
export const Route = createFileRoute('/_authed/subscription/applications/')({
	component: ApplicationsPage,
});

const select = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm';

function ApplicationsPage() {
	const { t } = useTranslation(['licensing', 'common']);
	const queryClient = useQueryClient();
	const canManage = usePermission('license.create');
	const [showRetired, setShowRetired] = useState(false);
	const { data, isPending, isError, error } = useQuery(applicationsQueryOptions(showRetired));
	const [editing, setEditing] = useState<TLicensableApplication | 'new' | null>(null);
	const [code, setCode] = useState('');
	const [name, setName] = useState('');
	const [vendor, setVendor] = useState('');
	const [source, setSource] = useState<TApplicationSource>('third_party');
	const [description, setDescription] = useState('');
	const [busy, setBusy] = useState(false);

	const open = (app: TLicensableApplication | 'new') => {
		const current = app === 'new' ? null : app;
		setCode(current?.code ?? '');
		setName(current?.name ?? '');
		setVendor(current?.vendor ?? '');
		setSource(current?.source ?? 'third_party');
		setDescription(current?.description ?? '');
		setEditing(app);
	};
	const run = async (work: () => Promise<unknown>) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['licenses', 'applications'] });
			toast.success(t('licensing:applications.saved'));
			setEditing(null);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('licensing:applications.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('licensing:applications.description')}</p>
				</div>
				{canManage && <Button onClick={() => open('new')}>{t('licensing:applications.new')}</Button>}
			</div>
			<label className='flex items-center gap-2 text-sm'>
				<input type='checkbox' className='size-4' checked={showRetired} onChange={(event) => setShowRetired(event.target.checked)} />
				{t('licensing:applications.showRetired')}
			</label>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('licensing:applications.empty')}</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className='p-0'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('licensing:field.code')}</TableHead>
									<TableHead>{t('licensing:field.name')}</TableHead>
									<TableHead>{t('licensing:field.vendor')}</TableHead>
									<TableHead>{t('licensing:field.source')}</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.map((app) => (
									<TableRow key={app.id}>
										<TableCell className='font-medium'>{app.code}</TableCell>
										<TableCell>
											{app.name}
											{app.status === 'retired' && (
												<Badge variant='outline' className='ml-2'>
													{t('licensing:applications.retired')}
												</Badge>
											)}
											{app.description && <div className='max-w-96 truncate text-xs text-muted-foreground'>{app.description}</div>}
										</TableCell>
										<TableCell>{app.vendor ?? '—'}</TableCell>
										<TableCell>{t(`licensing:source.${app.source}`)}</TableCell>
										<TableCell className='text-right whitespace-nowrap'>
											{canManage && (
												<>
													<Button size='sm' variant='ghost' onClick={() => open(app)}>
														{t('licensing:action.edit')}
													</Button>
													{app.status === 'active' ? (
														<Button size='sm' variant='ghost' disabled={busy} onClick={() => void run(() => retireApplication(app.id))}>
															{t('licensing:applications.retire')}
														</Button>
													) : (
														<Button size='sm' variant='ghost' disabled={busy} onClick={() => void run(() => restoreApplication(app.id))}>
															{t('licensing:applications.restore')}
														</Button>
													)}
												</>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			<Dialog open={editing !== null} onOpenChange={(next) => !next && setEditing(null)}>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							const input = {
								code: code.trim(),
								name: name.trim(),
								vendor: vendor.trim() || null,
								source,
								description: description.trim() || null,
							};
							void run(() => (editing === 'new' || editing === null ? createApplication(input) : updateApplication(editing.id, input)));
						}}
					>
						<DialogHeader>
							<DialogTitle>{editing === 'new' ? t('licensing:applications.new') : t('licensing:applications.edit')}</DialogTitle>
						</DialogHeader>
						<FieldGroup className='py-4'>
							<Field>
								<FieldLabel htmlFor='app-code'>{t('licensing:field.code')}</FieldLabel>
								<Input
									id='app-code'
									required
									maxLength={32}
									pattern='[A-Za-z0-9._\-]+'
									value={code}
									onChange={(event) => setCode(event.target.value)}
								/>
								<FieldDescription>{t('licensing:applications.codeHint')}</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor='app-name'>{t('licensing:field.name')}</FieldLabel>
								<Input id='app-name' required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='app-vendor'>{t('licensing:field.vendor')}</FieldLabel>
								<Input id='app-vendor' maxLength={200} value={vendor} onChange={(event) => setVendor(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='app-source'>{t('licensing:field.source')}</FieldLabel>
								<select id='app-source' className={select} value={source} onChange={(event) => setSource(event.target.value as TApplicationSource)}>
									{APPLICATION_SOURCES.map((value) => (
										<option key={value} value={value}>
											{t(`licensing:source.${value}`)}
										</option>
									))}
								</select>
							</Field>
							<Field>
								<FieldLabel htmlFor='app-description'>{t('licensing:field.description')}</FieldLabel>
								<Textarea id='app-description' rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setEditing(null)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || !code.trim() || !name.trim()}>
								{t('common:action.save')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
