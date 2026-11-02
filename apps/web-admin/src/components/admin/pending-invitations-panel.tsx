import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/toast';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import {
	ADMIN_PERMISSIONS,
	cancelInvitation,
	deleteInvitation,
	invitationsQueryOptions,
	resendInvitation,
	type TInvitation,
} from '@/lib/admin-api';
import { usePermission } from '@/lib/use-permission';

/**
 * Pending invitations panel: who is still outstanding, when their token
 * expires, and the resend/cancel/delete actions.
 *
 * @remarks
 * Invitation tokens never leave the backend (only their hash is stored), so
 * this panel can show expiry and status but never the invite link itself.
 * "Expired" is derived from `expiresAt` client-side for display; the backend
 * re-checks the real token on claim.
 */
export function PendingInvitationsPanel({
	organizationId,
}: {
	organizationId: string;
}) {
	const queryClient = useQueryClient();
	const canCreate = usePermission(ADMIN_PERMISSIONS.createMembers);
	const canDelete = usePermission(ADMIN_PERMISSIONS.deleteMembers);
	const { t } = useTranslation(['admin', 'common']);

	const { data, isPending } = useQuery({
		...invitationsQueryOptions(organizationId, 'pending'),
	});

	async function refresh() {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ['admin-invitations'] }),
			queryClient.invalidateQueries({ queryKey: ['admin-audit'] }),
		]);
	}

	const resend = useMutation({
		mutationFn: (invitationId: string) =>
			resendInvitation(organizationId, invitationId),
		onSuccess: async () => {
			toast.success(t('invitations.resent'));
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const cancel = useMutation({
		mutationFn: (invitationId: string) =>
			cancelInvitation(organizationId, invitationId),
		onSuccess: async () => {
			toast.success(t('invitations.cancelled'));
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const remove = useMutation({
		mutationFn: (invitationId: string) =>
			deleteInvitation(organizationId, invitationId),
		onSuccess: async () => {
			toast.success(t('invitations.deleted'));
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const rows = data?.rows ?? [];
	const busy = resend.isPending || cancel.isPending || remove.isPending;

	return (
		<Card>
			<CardHeader>
				<CardTitle className='flex items-center gap-2'>
					<Mail className='size-4' />
					{t('invitations.title')}
				</CardTitle>
				<CardDescription>{t('invitations.description')}</CardDescription>
			</CardHeader>
			<CardContent>
				{isPending && (
					<p className='text-sm text-muted-foreground'>{t('common:state.loading')}</p>
				)}
				{!isPending && rows.length === 0 && (
					<p className='text-sm text-muted-foreground'>
						{t('invitations.empty')}
					</p>
				)}
				{rows.length > 0 && (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('invitations.email')}</TableHead>
								<TableHead>{t('invitations.status')}</TableHead>
								<TableHead>{t('invitations.expires')}</TableHead>
								<TableHead className='text-right'>
									{t('invitations.actions')}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((invitation) => (
								<InvitationRow
									key={invitation.id}
									invitation={invitation}
									busy={busy}
									canCreate={canCreate}
									canDelete={canDelete}
									onResend={() => resend.mutate(invitation.id)}
									onCancel={() => cancel.mutate(invitation.id)}
									onDelete={() => remove.mutate(invitation.id)}
								/>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}

function InvitationRow({
	invitation,
	busy,
	canCreate,
	canDelete,
	onResend,
	onCancel,
	onDelete,
}: {
	invitation: TInvitation;
	busy: boolean;
	canCreate: boolean;
	canDelete: boolean;
	onResend: () => void;
	onCancel: () => void;
	onDelete: () => void;
}) {
	// `Date.now()` is impure during render (React Compiler rejects it), so
	// "now" is read once inside the query fn and cached for the query's
	// freshness window. The value only affects the badge/label; the backend
	// re-checks the real token on claim, so a stale minute is harmless.
	const now =
		useQuery({
			queryKey: ['admin-invitations-now'],
			queryFn: () => Date.now(),
			staleTime: 60 * 1000,
		}).data ?? 0;
	const expiresAt = new Date(invitation.expiresAt);
	const expired = expiresAt.getTime() <= now;
	const daysLeft = Math.ceil(
		(expiresAt.getTime() - now) / (24 * 60 * 60 * 1000),
	);
	const { t } = useTranslation(['admin', 'common']);

	return (
		<TableRow>
			<TableCell>
				<div className='flex flex-col'>
					<span className='font-medium'>{invitation.email}</span>
					{invitation.name && (
						<span className='text-xs text-muted-foreground'>
							{invitation.name}
						</span>
					)}
				</div>
			</TableCell>
			<TableCell>
				<Badge variant={expired ? 'destructive' : 'secondary'}>
					{expired ? t('invitations.expired') : t('invitations.pending')}
				</Badge>
			</TableCell>
			<TableCell className='text-xs text-muted-foreground'>
				{expiresAt.toLocaleString()}
				{!expired && daysLeft > 0 && (
					<span className='ml-1'>
						{t('invitations.daysLeft', { count: daysLeft })}
					</span>
				)}
			</TableCell>
			<TableCell className='text-right'>
				<div className='flex justify-end gap-2'>
					{canCreate && (
						<Button variant='outline' size='sm' disabled={busy} onClick={onResend}>
							{t('invitations.resend')}
						</Button>
					)}
					{canCreate && (
						<Button variant='ghost' size='sm' disabled={busy} onClick={onCancel}>
							{t('common:action.cancel')}
						</Button>
					)}
					{canDelete && (
						<Button variant='ghost' size='sm' disabled={busy} onClick={onDelete}>
							{t('common:action.delete')}
						</Button>
					)}
				</div>
			</TableCell>
		</TableRow>
	);
}
