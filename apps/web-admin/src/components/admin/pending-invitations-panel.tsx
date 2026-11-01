import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
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
			toast.success('Invitation resent (old link invalidated)');
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const cancel = useMutation({
		mutationFn: (invitationId: string) =>
			cancelInvitation(organizationId, invitationId),
		onSuccess: async () => {
			toast.success('Invitation cancelled');
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const remove = useMutation({
		mutationFn: (invitationId: string) =>
			deleteInvitation(organizationId, invitationId),
		onSuccess: async () => {
			toast.success('Invitation deleted');
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
					Pending invitations
				</CardTitle>
				<CardDescription>
					Single-use links, valid for 3 days. Resending issues a new token and
					invalidates the old one.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{isPending && (
					<p className='text-sm text-muted-foreground'>Loading…</p>
				)}
				{!isPending && rows.length === 0 && (
					<p className='text-sm text-muted-foreground'>
						No pending invitations.
					</p>
				)}
				{rows.length > 0 && (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Email</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Expires</TableHead>
								<TableHead className='text-right'>Actions</TableHead>
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
					{expired ? 'expired' : 'pending'}
				</Badge>
			</TableCell>
			<TableCell className='text-xs text-muted-foreground'>
				{expiresAt.toLocaleString()}
				{!expired && daysLeft > 0 && (
					<span className='ml-1'>({daysLeft}d left)</span>
				)}
			</TableCell>
			<TableCell className='text-right'>
				<div className='flex justify-end gap-2'>
					{canCreate && (
						<Button variant='outline' size='sm' disabled={busy} onClick={onResend}>
							Resend
						</Button>
					)}
					{canCreate && (
						<Button variant='ghost' size='sm' disabled={busy} onClick={onCancel}>
							Cancel
						</Button>
					)}
					{canDelete && (
						<Button variant='ghost' size='sm' disabled={busy} onClick={onDelete}>
							Delete
						</Button>
					)}
				</div>
			</TableCell>
		</TableRow>
	);
}
