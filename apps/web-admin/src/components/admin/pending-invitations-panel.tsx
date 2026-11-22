import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Ban, Mail, Send, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';

import { Badge } from '@ims-erp/ui/components/badge';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { ADMIN_PERMISSIONS, type TInvitation } from '@/lib/admin-api';
import { usePermission } from '@/lib/use-permission';

/**
 * Where the panel reads and mutates invitations.
 *
 * @remarks
 * The same panel serves the application-admin users page (`/admin/invitations`)
 * and an organization's members tab (`/organizations/:id/invitations`). The
 * two differ only in endpoint and cache key, so they are injected rather than
 * duplicated.
 */
export type TInvitationSource = {
	/** Query for the pending rows (list only `status: 'pending'`). */
	queryOptions: {
		queryKey: readonly unknown[];
		queryFn: () => Promise<{ rows: TInvitation[] }>;
		staleTime?: number;
	};
	resend: (invitationId: string) => Promise<void>;
	cancel: (invitationId: string) => Promise<void>;
	remove: (invitationId: string) => Promise<void>;
	/** Query keys to invalidate after an action (list, audit, members…). */
	invalidate: readonly (readonly unknown[])[];
};

/**
 * Pending invitations panel: who is still outstanding, when their token
 * expires, and the resend/cancel/delete actions.
 *
 * @remarks
 * Invitation tokens never leave the backend (only their hash is stored), so
 * this panel can show expiry and status but never the invite link itself.
 * "Expired" is derived from `expiresAt` client-side for display; the backend
 * re-checks the real token on claim. Actions are permission-gated in the UI
 * and re-authorized by the backend.
 */
export function PendingInvitationsPanel({
	source,
}: {
	source: TInvitationSource;
}) {
	const queryClient = useQueryClient();
	const canCreate = usePermission(ADMIN_PERMISSIONS.createInvitations);
	const canDelete = usePermission(ADMIN_PERMISSIONS.cancelInvitations);
	const { t } = useTranslation(['admin', 'common']);

	const { data, isPending, isError, error } = useQuery(source.queryOptions);

	async function refresh() {
		await Promise.all(
			source.invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
		);
	}

	const resend = useMutation({
		mutationFn: (invitationId: string) => source.resend(invitationId),
		onSuccess: async () => {
			toast.success(t('invitations.resent'));
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const cancel = useMutation({
		mutationFn: (invitationId: string) => source.cancel(invitationId),
		onSuccess: async () => {
			toast.success(t('invitations.cancelled'));
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const remove = useMutation({
		mutationFn: (invitationId: string) => source.remove(invitationId),
		onSuccess: async () => {
			toast.success(t('invitations.deleted'));
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const rows = data?.rows ?? [];
	const busy = resend.isPending || cancel.isPending || remove.isPending;

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

	const columns = useMemo<ColumnDef<DataTableFeatures, TInvitation, CellData>[]>(
		() => [
			{
				accessorKey: 'email',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('invitations.email')} />
				),
				cell: ({ row }) => (
					<div className='flex flex-col'>
						<span className='font-medium'>{row.original.email}</span>
						{row.original.name && (
							<span className='text-xs text-muted-foreground'>{row.original.name}</span>
						)}
					</div>
				),
			},
			{
				id: 'status',
				accessorFn: (row) => new Date(row.expiresAt).getTime() <= now,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('invitations.status')} />
				),
				cell: ({ row }) => {
					const expired = new Date(row.original.expiresAt).getTime() <= now;
					return (
						<Badge variant={expired ? 'destructive' : 'secondary'}>
							{expired ? t('invitations.expired') : t('invitations.pending')}
						</Badge>
					);
				},
			},
			{
				id: 'expiresAt',
				accessorFn: (row) => new Date(row.expiresAt).getTime(),
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('invitations.expires')} />
				),
				meta: { cellClassName: 'text-xs text-muted-foreground' },
				cell: ({ row }) => {
					const expiresAt = new Date(row.original.expiresAt);
					const daysLeft = Math.ceil((expiresAt.getTime() - now) / (24 * 60 * 60 * 1000));
					return (
						<>
							{expiresAt.toLocaleString()}
							{expiresAt.getTime() > now && daysLeft > 0 && (
								<span className='ml-1'>{t('invitations.daysLeft', { count: daysLeft })}</span>
							)}
						</>
					);
				},
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('invitations.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('invitations.actions')}
						disabled={busy}
						actions={[
							{
								key: 'resend',
								label: t('invitations.resend'),
								icon: Send,
								hidden: !canCreate,
								onSelect: () => resend.mutate(row.original.id),
							},
							{
								key: 'cancel',
								label: t('common:action.cancel'),
								icon: Ban,
								destructive: true,
								hidden: !canDelete,
								onSelect: () => cancel.mutate(row.original.id),
							},
							{
								key: 'delete',
								label: t('common:action.delete'),
								icon: Trash2,
								destructive: true,
								hidden: !canDelete,
								onSelect: () => remove.mutate(row.original.id),
							},
						]}
					/>
				),
			},
		],
		[busy, canCreate, canDelete, cancel, now, remove, resend, t],
	);

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
				{isPending && <SectionSkeleton />}
				{isError && <ErrorState error={error} size='sm' />}
				{!isPending && !isError && rows.length === 0 && (
					<EmptyState title={t('invitations.empty')} size='sm' />
				)}
				{rows.length > 0 && (
					<DataTable columns={columns} data={rows} getRowId={(row) => row.id} />
				)}
			</CardContent>
		</Card>
	);
}
