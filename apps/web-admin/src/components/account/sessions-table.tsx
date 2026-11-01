import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
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

/**
 * Session management (`/account/sessions`). Lists the signed-in user's
 * active sessions via Better Auth's `listSessions`, with per-row revoke
 * and a bulk "revoke all other sessions" action.
 */
export function SessionsTable() {
	const queryClient = useQueryClient();
	const sessionsQuery = useQuery({
		queryKey: ['auth', 'sessions'] as const,
		queryFn: async () => {
			const { data, error } = await authClient.listSessions();
			if (error) throw new Error(error.message ?? 'Failed to load sessions');
			return data;
		},
	});
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });

	const revokeMutation = useMutation({
		mutationFn: async (token: string) => {
			const { error } = await authClient.revokeSession({ token });
			if (error) throw new Error(error.message ?? 'Revoke failed');
		},
		onSuccess: () => {
			toast.success('Session revoked');
			void invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const revokeOthersMutation = useMutation({
		mutationFn: async () => {
			const { error } = await authClient.revokeOtherSessions();
			if (error) throw new Error(error.message ?? 'Revoke failed');
		},
		onSuccess: () => {
			toast.success('Other sessions revoked');
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
		<Card>
			<CardHeader>
				<CardTitle>Active sessions</CardTitle>
				<CardDescription>
					Devices currently signed in to your account
				</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				<div className='overflow-x-auto'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Device</TableHead>
								<TableHead>Signed in</TableHead>
								<TableHead>Expires</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className='text-right'>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sessions.map((session) => (
								<TableRow key={session.token}>
									<TableCell>
										{session.userAgent ?? 'Unknown device'}
									</TableCell>
									<TableCell>
										{new Date(session.createdAt).toLocaleString()}
									</TableCell>
									<TableCell>
										{new Date(session.expiresAt).toLocaleString()}
									</TableCell>
									<TableCell>
										{session.token === currentToken ? (
											<Badge>Current</Badge>
										) : (
											<Badge variant='outline'>Other</Badge>
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
												Revoke
											</Button>
										)}
									</TableCell>
								</TableRow>
							))}
							{sessions.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={5}
										className='text-muted-foreground py-8 text-center'
									>
										No active sessions
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
				{othersCount > 0 && (
					<div>
						<Button
							variant='outline'
							disabled={revokeOthersMutation.isPending}
							onClick={() => revokeOthersMutation.mutate()}
						>
							Log out all other devices ({othersCount})
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
