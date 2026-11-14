import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@ims-erp/ui/components/alert-dialog';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { toast } from '@/components/toast';
import { formatDateTime } from '@/lib/format';
import { invitePortalAccount, portalAccountQueryOptions, resendPortalInvite, revokePortalAccount } from '@/lib/portal-account-api';
import { usePermission } from '@/lib/use-permission';

/**
 * The customer's portal login (ERP-0022): one per customer. Staff invite it
 * (the customer sets the password from the emailed link), resend the link,
 * or revoke it. UX only — the API checks `portal_account:*`.
 */
export function PortalAccountCard({ customerId, defaultName, defaultEmail }: { customerId: string; defaultName: string; defaultEmail: string | null }) {
	const { t, i18n } = useTranslation(['crm', 'common']);
	const queryClient = useQueryClient();
	const canRead = usePermission('portal_account.read');
	const canInvite = usePermission('portal_account.invite');
	const canRevoke = usePermission('portal_account.revoke');
	const { data: account, isPending } = useQuery(portalAccountQueryOptions(customerId, canRead));
	const [name, setName] = useState(defaultName);
	const [email, setEmail] = useState(defaultEmail ?? '');
	const [busy, setBusy] = useState(false);
	const [revoking, setRevoking] = useState(false);

	if (!canRead) return null;

	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['crm', 'portal-account', customerId] });
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
				<CardTitle>{t('crm:portal.title')}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-3 text-sm'>
				{isPending ? null : account ? (
					<>
						<div className='flex flex-wrap items-center gap-2'>
							<span className='font-medium'>{account.user.name}</span>
							<span className='text-muted-foreground'>{account.user.email}</span>
							<Badge variant={account.passwordSet ? 'default' : 'secondary'}>
								{account.passwordSet ? t('crm:portal.active') : t('crm:portal.waiting')}
							</Badge>
						</div>
						<p className='text-muted-foreground'>
							{account.lastLoginAt
								? t('crm:portal.lastLogin', { date: formatDateTime(account.lastLoginAt, i18n.language) })
								: t('crm:portal.neverLoggedIn')}
						</p>
						<div className='flex flex-wrap gap-2'>
							{canInvite && (
								<Button variant='outline' disabled={busy} onClick={() => void run(() => resendPortalInvite(account.id), t('crm:portal.resent'))}>
									{t('crm:portal.resend')}
								</Button>
							)}
							{canRevoke && (
								<Button variant='outline' disabled={busy} onClick={() => setRevoking(true)}>
									{t('crm:portal.revoke')}
								</Button>
							)}
						</div>
					</>
				) : canInvite ? (
					<form
						className='grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end'
						onSubmit={(event) => {
							event.preventDefault();
							void run(() => invitePortalAccount({ customerId, name: name.trim(), email: email.trim() }), t('crm:portal.invited'));
						}}
					>
						<Field>
							<FieldLabel htmlFor='portal-name'>{t('crm:portal.name')}</FieldLabel>
							<Input id='portal-name' required maxLength={200} autoComplete='off' value={name} onChange={(event) => setName(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='portal-email'>{t('crm:portal.email')}</FieldLabel>
							<Input id='portal-email' type='email' required maxLength={254} autoComplete='off' value={email} onChange={(event) => setEmail(event.target.value)} />
						</Field>
						<Button type='submit' disabled={busy}>
							{t('crm:portal.invite')}
						</Button>
						<p className='text-muted-foreground sm:col-span-3'>{t('crm:portal.inviteHint')}</p>
					</form>
				) : (
					<p className='text-muted-foreground'>{t('crm:portal.none')}</p>
				)}
			</CardContent>
			<AlertDialog open={revoking} onOpenChange={setRevoking}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('crm:portal.revoke')}</AlertDialogTitle>
						<AlertDialogDescription>{t('crm:portal.revokeConfirm')}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => account && void run(() => revokePortalAccount(account.id), t('crm:portal.revoked')).then(() => setRevoking(false))}
						>
							{t('crm:portal.revoke')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}
