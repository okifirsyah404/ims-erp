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
import {
	invitePortalAccount,
	PORTAL_ROLES,
	portalAccountsQueryOptions,
	resendPortalInvite,
	revokePortalAccount,
	type TPortalAccount,
	type TPortalRole,
} from '@/lib/portal-account-api';
import { usePermission } from '@/lib/use-permission';

const select = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm';

/**
 * The customer's portal logins (ERP-0022, owner decision D2): one per person,
 * each with a role. Staff invite people (they set the password from the
 * emailed link), resend the link or revoke. UX only — the API checks
 * `portal_account:*`.
 */
export function PortalAccountCard({ customerId, defaultName, defaultEmail }: { customerId: string; defaultName: string; defaultEmail: string | null }) {
	const { t, i18n } = useTranslation(['crm', 'common']);
	const queryClient = useQueryClient();
	const canRead = usePermission('portal_account.read');
	const canInvite = usePermission('portal_account.invite');
	const canRevoke = usePermission('portal_account.revoke');
	const { data: accounts = [], isPending } = useQuery(portalAccountsQueryOptions(customerId, canRead));
	const [name, setName] = useState(defaultName);
	const [email, setEmail] = useState(defaultEmail ?? '');
	const [role, setRole] = useState<TPortalRole>('owner');
	const [busy, setBusy] = useState(false);
	const [revoking, setRevoking] = useState<TPortalAccount | null>(null);

	if (!canRead) return null;

	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['crm', 'portal-account', customerId] });
			toast.success(done);
			return true;
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
			return false;
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('crm:portal.title')}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-4 text-sm'>
				{!isPending && accounts.length === 0 && <p className='text-muted-foreground'>{t('crm:portal.none')}</p>}
				{accounts.map((account) => (
					<div key={account.id} className='flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-b-0'>
						<div className='flex flex-col gap-1'>
							<div className='flex flex-wrap items-center gap-2'>
								<span className='font-medium'>{account.user.name}</span>
								<span className='text-muted-foreground'>{account.user.email}</span>
								<Badge variant='outline'>{t(`crm:portal.role.${account.role}`)}</Badge>
								<Badge variant={account.passwordSet ? 'default' : 'secondary'}>
									{account.passwordSet ? t('crm:portal.active') : t('crm:portal.waiting')}
								</Badge>
							</div>
							<span className='text-muted-foreground'>
								{account.lastLoginAt
									? t('crm:portal.lastLogin', { date: formatDateTime(account.lastLoginAt, i18n.language) })
									: t('crm:portal.neverLoggedIn')}
							</span>
						</div>
						<div className='flex flex-wrap gap-2'>
							{canInvite && (
								<Button size='sm' variant='outline' disabled={busy} onClick={() => void run(() => resendPortalInvite(account.id), t('crm:portal.resent'))}>
									{t('crm:portal.resend')}
								</Button>
							)}
							{canRevoke && (
								<Button size='sm' variant='outline' disabled={busy} onClick={() => setRevoking(account)}>
									{t('crm:portal.revoke')}
								</Button>
							)}
						</div>
					</div>
				))}
				{canInvite && (
					<form
						className='grid gap-3 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end'
						onSubmit={(event) => {
							event.preventDefault();
							void run(() => invitePortalAccount({ customerId, name: name.trim(), email: email.trim(), role }), t('crm:portal.invited')).then((ok) => {
								if (ok && accounts.length > 0) {
									setName('');
									setEmail('');
								}
							});
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
						<Field>
							<FieldLabel htmlFor='portal-role'>{t('crm:portal.roleLabel')}</FieldLabel>
							<select id='portal-role' className={select} value={role} onChange={(event) => setRole(event.target.value as TPortalRole)}>
								{PORTAL_ROLES.map((value) => (
									<option key={value} value={value}>
										{t(`crm:portal.role.${value}`)}
									</option>
								))}
							</select>
						</Field>
						<Button type='submit' disabled={busy}>
							{t('crm:portal.invite')}
						</Button>
						<p className='text-muted-foreground sm:col-span-4'>{t('crm:portal.inviteHint')}</p>
					</form>
				)}
			</CardContent>
			<AlertDialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('crm:portal.revoke')}</AlertDialogTitle>
						<AlertDialogDescription>{t('crm:portal.revokeConfirm', { name: revoking?.user.name ?? '' })}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => revoking && void run(() => revokePortalAccount(revoking.id), t('crm:portal.revoked')).then(() => setRevoking(null))}
						>
							{t('crm:portal.revoke')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}
