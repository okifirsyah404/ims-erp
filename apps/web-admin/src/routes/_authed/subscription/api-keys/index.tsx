import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { toast } from '@/components/toast';
import { formatDateTime } from '@/lib/format';
import {
	apiKeysQueryOptions,
	applicationsQueryOptions,
	issueApiKey,
	revokeApiKey,
	type TLicensableApplication,
} from '@/lib/license-api';
import { usePermission } from '@/lib/use-permission';

/** `/subscription/api-keys` — machine keys of the own applications (M03 stage 2). */
export const Route = createFileRoute('/_authed/subscription/api-keys/')({
	component: ApiKeysPage,
});

function ApiKeysPage() {
	const { t } = useTranslation(['licensing', 'common']);
	const canManage = usePermission('license.manage_api');
	const applications = useQuery(applicationsQueryOptions(false));
	const own = (applications.data ?? []).filter((app) => app.source === 'own');

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('licensing:apiKeys.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('licensing:apiKeys.description')}</p>
			</div>
			{!canManage ? (
				<p className='text-sm text-muted-foreground'>{t('licensing:apiKeys.noAccess')}</p>
			) : applications.isPending ? null : own.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('licensing:apiKeys.noOwnApplication')}</CardContent>
				</Card>
			) : (
				own.map((app) => <ApplicationKeys key={app.id} application={app} />)
			)}
		</div>
	);
}

function ApplicationKeys({ application }: { application: TLicensableApplication }) {
	const { t, i18n } = useTranslation(['licensing', 'common']);
	const queryClient = useQueryClient();
	const { data } = useQuery(apiKeysQueryOptions(application.id));
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState('');
	const [secret, setSecret] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const refresh = () => queryClient.invalidateQueries({ queryKey: ['licenses', 'api-keys', application.id] });
	const create = async () => {
		setBusy(true);
		try {
			const issued = await issueApiKey(application.id, name.trim());
			setSecret(issued.secret);
			await refresh();
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};
	const revoke = async (id: string) => {
		setBusy(true);
		try {
			await revokeApiKey(application.id, id);
			await refresh();
			toast.success(t('licensing:apiKeys.revoked'));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};
	const close = () => {
		setCreating(false);
		setSecret(null);
		setName('');
	};

	return (
		<Card>
			<CardHeader className='flex flex-row items-center justify-between gap-2'>
				<CardTitle>
					{application.code} — {application.name}
				</CardTitle>
				<Button size='sm' onClick={() => setCreating(true)}>
					{t('licensing:apiKeys.new')}
				</Button>
			</CardHeader>
			<CardContent className='p-0'>
				{!data || data.length === 0 ? (
					<p className='px-6 pb-6 text-sm text-muted-foreground'>{t('licensing:apiKeys.empty')}</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('licensing:field.name')}</TableHead>
								<TableHead>{t('licensing:apiKeys.start')}</TableHead>
								<TableHead>{t('licensing:apiKeys.created')}</TableHead>
								<TableHead>{t('licensing:apiKeys.issuedBy')}</TableHead>
								<TableHead>{t('licensing:apiKeys.lastUsed')}</TableHead>
								<TableHead>{t('licensing:field.status')}</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.map((key) => (
								<TableRow key={key.id}>
									<TableCell className='font-medium'>{key.name}</TableCell>
									<TableCell>
										<code className='font-mono text-xs'>{key.keyStart ? `${key.keyStart}…` : '—'}</code>
									</TableCell>
									<TableCell>{formatDateTime(key.createdAt, i18n.language)}</TableCell>
									<TableCell>
										{key.createdByName ?? '—'}
										{key.status === 'revoked' && key.revokedByName && (
											<div className='text-xs text-muted-foreground'>
												{t('licensing:apiKeys.revokedBy', { name: key.revokedByName })}
											</div>
										)}
									</TableCell>
									<TableCell>{key.lastUsedAt ? formatDateTime(key.lastUsedAt, i18n.language) : '—'}</TableCell>
									<TableCell>
										<Badge variant={key.status === 'active' ? 'default' : 'outline'}>{t(`licensing:keys.status.${key.status}`)}</Badge>
									</TableCell>
									<TableCell className='text-right'>
										{key.status === 'active' && (
											<Button size='sm' variant='ghost' disabled={busy} onClick={() => void revoke(key.id)}>
												{t('licensing:action.revoke')}
											</Button>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>

			<Dialog open={creating} onOpenChange={(next) => !next && close()}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('licensing:apiKeys.new')}</DialogTitle>
					</DialogHeader>
					{secret ? (
						<div className='flex flex-col gap-3 py-2'>
							<p className='text-sm'>{t('licensing:apiKeys.copyNow')}</p>
							<code className='rounded-md border bg-muted p-3 font-mono text-sm break-all'>{secret}</code>
							<DialogFooter>
								<Button
									variant='outline'
									onClick={() => {
										void navigator.clipboard.writeText(secret);
										toast.success(t('licensing:done.copied'));
									}}
								>
									{t('licensing:action.copy')}
								</Button>
								<Button onClick={close}>{t('licensing:apiKeys.done')}</Button>
							</DialogFooter>
						</div>
					) : (
						<form
							onSubmit={(event) => {
								event.preventDefault();
								void create();
							}}
						>
							<FieldGroup className='py-4'>
								<Field>
									<FieldLabel htmlFor={`api-key-name-${application.id}`}>{t('licensing:field.name')}</FieldLabel>
									<Input
										id={`api-key-name-${application.id}`}
										required
										maxLength={100}
										value={name}
										onChange={(event) => setName(event.target.value)}
									/>
									<FieldDescription>{t('licensing:apiKeys.nameHint')}</FieldDescription>
								</Field>
							</FieldGroup>
							<DialogFooter>
								<Button type='button' variant='outline' onClick={close}>
									{t('common:action.cancel')}
								</Button>
								<Button type='submit' disabled={busy || !name.trim()}>
									{t('licensing:apiKeys.issue')}
								</Button>
							</DialogFooter>
						</form>
					)}
				</DialogContent>
			</Dialog>
		</Card>
	);
}
