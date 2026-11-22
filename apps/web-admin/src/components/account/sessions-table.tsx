import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { authClient } from '@/lib/auth-client';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Ban, MonitorOff } from 'lucide-react';

/** One row of Better Auth's `listSessions`. */
type TSession = NonNullable<
	Awaited<ReturnType<typeof authClient.listSessions>>['data']
>[number];

/**
 * Session management card on `/accounts` (ERP-0109). Lists the signed-in
 * user's active sessions via Better Auth's `listSessions`, with per-row
 * revoke and a bulk "revoke all other sessions" action in the card header.
 */
export function SessionsTable({ id }: { id?: string }) {
	const queryClient = useQueryClient();
	const { t } = useTranslation('account');
	const sessionsQuery = useQuery({
		queryKey: ['auth', 'sessions'] as const,
		queryFn: async () => {
			const { data, error } = await authClient.listSessions();
			if (error) throw new Error(error.message ?? t('sessions.loadFailed'));
			return data;
		},
	});
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });

	const revokeMutation = useMutation({
		mutationFn: async (token: string) => {
			const { error } = await authClient.revokeSession({ token });
			if (error) throw new Error(error.message ?? t('sessions.revokeFailed'));
		},
		onSuccess: () => {
			toast.success(t('sessions.revoked'));
			void invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const revokeOthersMutation = useMutation({
		mutationFn: async () => {
			const { error } = await authClient.revokeOtherSessions();
			if (error) throw new Error(error.message ?? t('sessions.revokeFailed'));
		},
		onSuccess: () => {
			toast.success(t('sessions.revokedOthers'));
			void invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const sessions = sessionsQuery.data ?? [];
	// This Better Auth version's listSessions rows carry no `isCurrent`
	// flag; compare against the current session atom's token instead.
	const { data: currentSession } = authClient.useSession();
	const currentToken = currentSession?.session?.token;
	const othersCount = sessions.filter(
		(session) => session.token !== currentToken,
	).length;

	const columns = useMemo<ColumnDef<DataTableFeatures, TSession, CellData>[]>(
		() => [
			{
				id: 'device',
				accessorFn: (session) => session.userAgent ?? '',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('sessions.device')} />
				),
				cell: ({ row }) => (
					<span
						className='block max-w-56 truncate'
						title={row.original.userAgent ?? undefined}
					>
						{row.original.userAgent ?? t('sessions.unknownDevice')}
					</span>
				),
			},
			{
				id: 'createdAt',
				accessorFn: (session) => new Date(session.createdAt).getTime(),
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('sessions.created')} />
				),
				cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
			},
			{
				id: 'expiresAt',
				accessorFn: (session) => new Date(session.expiresAt).getTime(),
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('sessions.expires')} />
				),
				cell: ({ row }) => new Date(row.original.expiresAt).toLocaleString(),
			},
			{
				id: 'status',
				accessorFn: (session) => session.token === currentToken,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('sessions.status')} />
				),
				cell: ({ row }) =>
					row.original.token === currentToken ? (
						<Badge>{t('sessions.current')}</Badge>
					) : (
						<Badge variant='outline'>{t('sessions.other')}</Badge>
					),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('sessions.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('sessions.actions')}
						disabled={revokeMutation.isPending}
						actions={[
							{
								key: 'revoke',
								label: t('sessions.revoke'),
								icon: Ban,
								destructive: true,
								hidden: row.original.token === currentToken,
								onSelect: () => revokeMutation.mutate(row.original.token),
							},
						]}
					/>
				),
			},
		],
		[currentToken, revokeMutation, t],
	);

	return (
		<Card id={id} size='sm' className='scroll-mt-4'>
			<CardHeader>
				<CardTitle>{t('sessions.title')}</CardTitle>
				<CardDescription>{t('sessions.description')}</CardDescription>
				{othersCount > 0 && (
					<CardAction>
						<Button
							variant='outline'
							size='sm'
							disabled={revokeOthersMutation.isPending}
							onClick={() => revokeOthersMutation.mutate()}
						>
							{t('sessions.revokeAll', { count: othersCount })}
						</Button>
					</CardAction>
				)}
			</CardHeader>
			<CardContent>
				{sessionsQuery.isError ? (
					<ErrorState error={sessionsQuery.error} size='sm' />
				) : !sessionsQuery.isPending && sessions.length === 0 ? (
					<EmptyState
						icon={MonitorOff}
						title={t('sessions.empty')}
						size='sm'
					/>
				) : (
					<DataTable
						columns={columns}
						data={sessions}
						getRowId={(session) => session.token}
						loading={sessionsQuery.isPending}
					/>
				)}
			</CardContent>
		</Card>
	);
}
