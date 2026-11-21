import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { authClient } from '@/lib/auth-client';
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
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';

/** Placeholder rows shown while sessions load. */
const SESSION_SKELETON_ROW_COUNT = 4;

/** Per-column placeholder widths, matching the sessions table's shape. */
const SESSION_SKELETON_CELLS = [
	{ key: 'device', className: 'h-4 w-48' },
	{ key: 'created', className: 'h-4 w-32' },
	{ key: 'expires', className: 'h-4 w-32' },
	{ key: 'status', className: 'h-5 w-16 rounded-full' },
	{ key: 'actions', className: 'ml-auto h-8 w-16' },
] as const;

/**
 * Session management card on `/accounts`. Lists the signed-in user's
 * active sessions via Better Auth's `listSessions`, with per-row revoke
 * and a bulk "revoke all other sessions" action in the card header.
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
				<div className='overflow-x-auto'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('sessions.device')}</TableHead>
								<TableHead>{t('sessions.created')}</TableHead>
								<TableHead>{t('sessions.expires')}</TableHead>
								<TableHead>{t('sessions.status')}</TableHead>
								<TableHead className='text-right'>
									{t('sessions.actions')}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sessionsQuery.isPending &&
								Array.from({ length: SESSION_SKELETON_ROW_COUNT }, (_, index) => (
									<TableRow key={index} aria-hidden='true'>
										{SESSION_SKELETON_CELLS.map((cell) => (
											<TableCell key={cell.key}>
												<Skeleton
													className={`${cell.className} motion-reduce:animate-none`}
												/>
											</TableCell>
										))}
									</TableRow>
								))}
							{sessionsQuery.isError && (
								<TableRow>
									<TableCell colSpan={5}>
										<ErrorState error={sessionsQuery.error} size='sm' />
									</TableCell>
								</TableRow>
							)}
							{sessions.map((session) => (
								<TableRow key={session.token}>
									<TableCell
										className='max-w-56 truncate'
										title={session.userAgent ?? undefined}
									>
										{session.userAgent ?? t('sessions.unknownDevice')}
									</TableCell>
									<TableCell>
										{new Date(session.createdAt).toLocaleString()}
									</TableCell>
									<TableCell>
										{new Date(session.expiresAt).toLocaleString()}
									</TableCell>
									<TableCell>
										{session.token === currentToken ? (
											<Badge>{t('sessions.current')}</Badge>
										) : (
											<Badge variant='outline'>{t('sessions.other')}</Badge>
										)}
									</TableCell>
									<TableCell className='text-right'>
										{session.token !== currentToken && (
											<Button
												variant='ghost'
												size='sm'
												disabled={revokeMutation.isPending}
												onClick={() => revokeMutation.mutate(session.token)}
											>
												{t('sessions.revoke')}
											</Button>
										)}
									</TableCell>
								</TableRow>
							))}
							{!sessionsQuery.isPending &&
								!sessionsQuery.isError &&
								sessions.length === 0 && (
									<TableRow>
										<TableCell colSpan={5}>
											<EmptyState title={t('sessions.empty')} size='sm' />
										</TableCell>
									</TableRow>
								)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}
