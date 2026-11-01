import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { UserPlus, Users as UsersIcon } from 'lucide-react';
import { useState } from 'react';
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
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@ims-erp/ui/components/alert-dialog';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
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
	deleteUser,
	deactivateUser,
	restoreUser,
	usersQueryOptions,
	type TAdminUser,
	type TUserListParams,
	type TUserStatus,
} from '@/lib/admin-api';
import { InviteDialog } from '@/components/admin/invite-dialog';
import { PendingInvitationsPanel } from '@/components/admin/pending-invitations-panel';
import { useActiveOrganizationId } from '@/lib/use-active-organization';
import { usePermission } from '@/lib/use-permission';

/** Search params for the users table (URL-backed filters). */
type TUsersSearch = {
	page?: number;
	status?: TUserStatus;
	search?: string;
	includeDeleted?: boolean;
};

export const Route = createFileRoute('/_authed/users/')({
	validateSearch: (search: Record<string, unknown>): TUsersSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		status: (search.status as TUserStatus | undefined) || undefined,
		search: typeof search.search === 'string' ? search.search : undefined,
		includeDeleted: search.includeDeleted === true || search.includeDeleted === 'true',
	}),
	component: UsersPage,
});

/** Status → badge variant. `deactivated` reads as destructive, not failed. */
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> =
	{
		active: 'default',
		pending: 'secondary',
		deactivated: 'destructive',
	};

function UsersPage() {
	const organizationId = useActiveOrganizationId();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();

	const canUpdate = usePermission(ADMIN_PERMISSIONS.updateMembers);
	const canDelete = usePermission(ADMIN_PERMISSIONS.deleteMembers);
	const canInvite = usePermission(ADMIN_PERMISSIONS.createMembers);

	const [inviteOpen, setInviteOpen] = useState(false);
	const [searchDraft, setSearchDraft] = useState(search.search ?? '');

	const params: TUserListParams = {
		page: search.page ?? 1,
		limit: 20,
		status: search.status,
		search: search.search,
		includeDeleted: search.includeDeleted,
	};

	const { data, isPending, isError, error } = useQuery({
		...usersQueryOptions(organizationId ?? '', params),
		enabled: !!organizationId,
	});

	/** Invalidates every users/audit cache entry after a lifecycle action. */
	async function refresh() {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
			queryClient.invalidateQueries({ queryKey: ['admin-audit'] }),
			queryClient.invalidateQueries({ queryKey: ['admin-invitations'] }),
		]);
	}

	const deactivate = useMutation({
		mutationFn: (userId: string) => deactivateUser(organizationId!, userId),
		onSuccess: async () => {
			toast.success('User deactivated; sessions revoked');
			await refresh();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const restore = useMutation({
		mutationFn: (userId: string) => restoreUser(organizationId!, userId),
		onSuccess: async () => {
			toast.success('User restored');
			await refresh();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const remove = useMutation({
		mutationFn: (userId: string) => deleteUser(organizationId!, userId),
		onSuccess: async () => {
			toast.success('User deleted (soft)');
			await refresh();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	if (!organizationId) {
		return (
			<div className='p-6 text-sm text-muted-foreground'>
				Select an organization to manage users.
			</div>
		);
	}

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;
	const busy = deactivate.isPending || restore.isPending || remove.isPending;

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='flex items-center gap-2 text-2xl font-bold'>
						<UsersIcon className='size-6' />
						Users
					</h1>
					<p className='text-sm text-muted-foreground'>
						Account lifecycle, roles and pending invitations for this
						organization.
					</p>
				</div>
				{canInvite && (
					<Button onClick={() => setInviteOpen(true)}>
						<UserPlus className='mr-2 size-4' />
						Invite users
					</Button>
				)}
			</div>

			{/* Filters ------------------------------------------------------ */}
			<div className='flex flex-wrap items-end gap-3'>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>Search</span>
					<Input
						className='w-64'
						placeholder='Name, email or username'
						value={searchDraft}
						onChange={(event) => setSearchDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								void navigate({
									search: (prev) => ({
										...prev,
										page: 1,
										search: searchDraft || undefined,
									}),
								});
							}
						}}
					/>
				</div>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>Status</span>
					<Select
						value={search.status ?? 'all'}
						onValueChange={(value) =>
							void navigate({
								search: (prev) => ({
									...prev,
									page: 1,
									status: value === 'all' ? undefined : (value as TUserStatus),
								}),
							})
						}
					>
						<SelectTrigger className='w-44'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All statuses</SelectItem>
							<SelectItem value='pending'>Pending</SelectItem>
							<SelectItem value='active'>Active</SelectItem>
							<SelectItem value='deactivated'>Deactivated</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<Button
					variant='outline'
					onClick={() =>
						void navigate({
							search: (prev) => ({
								...prev,
								page: 1,
								search: searchDraft || undefined,
							}),
						})
					}
				>
					Apply
				</Button>
				<Button
					variant='ghost'
					onClick={() => {
						setSearchDraft('');
						void navigate({ search: {} });
					}}
				>
					Reset
				</Button>
			</div>

			{/* Table -------------------------------------------------------- */}
			<Card>
				<CardHeader>
					<CardTitle>Accounts</CardTitle>
					<CardDescription>
						{pagination ? `${pagination.total} user(s)` : 'Loading…'}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isPending && (
						<p className='text-sm text-muted-foreground'>Loading users…</p>
					)}
					{isError && (
						<p className='text-sm text-destructive'>{(error as Error).message}</p>
					)}
					{!isPending && !isError && rows.length === 0 && (
						<p className='text-sm text-muted-foreground'>No users found.</p>
					)}
					{rows.length > 0 && (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>User</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Organization roles</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className='text-right'>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((user) => (
									<UserRow
										key={user.id}
										user={user}
										busy={busy}
										canUpdate={canUpdate}
										canDelete={canDelete}
										onDeactivate={() => deactivate.mutate(user.id)}
										onRestore={() => restore.mutate(user.id)}
										onDelete={() => remove.mutate(user.id)}
									/>
								))}
							</TableBody>
						</Table>
					)}

					{pagination && pagination.totalPages > 1 && (
						<div className='mt-4 flex items-center justify-end gap-2'>
							<Button
								variant='outline'
								size='sm'
								disabled={(search.page ?? 1) <= 1}
								onClick={() =>
									void navigate({
										search: (prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }),
									})
								}
							>
								Previous
							</Button>
							<span className='text-xs text-muted-foreground'>
								Page {pagination.page} of {pagination.totalPages}
							</span>
							<Button
								variant='outline'
								size='sm'
								disabled={pagination.page >= pagination.totalPages}
								onClick={() =>
									void navigate({
										search: (prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }),
									})
								}
							>
								Next
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			<PendingInvitationsPanel organizationId={organizationId} />

			{canInvite && (
				<InviteDialog
					organizationId={organizationId}
					open={inviteOpen}
					onOpenChange={setInviteOpen}
					onInvited={() => void refresh()}
				/>
			)}
		</div>
	);
}

/** One user row with its lifecycle actions gated by permission. */
function UserRow({
	user,
	busy,
	canUpdate,
	canDelete,
	onDeactivate,
	onRestore,
	onDelete,
}: {
	user: TAdminUser;
	busy: boolean;
	canUpdate: boolean;
	canDelete: boolean;
	onDeactivate: () => void;
	onRestore: () => void;
	onDelete: () => void;
}) {
	const status = user.deletedAt ? 'deleted' : (user.status ?? 'unknown');
	const isActive = status === 'active';
	const canRestore = status === 'deactivated' || status === 'deleted';

	return (
		<TableRow>
			<TableCell>
				<div className='flex flex-col'>
					<span className='font-medium'>{user.name || '—'}</span>
					<span className='text-xs text-muted-foreground'>{user.email}</span>
					{user.username && (
						<span className='text-xs text-muted-foreground'>
							@{user.displayUsername ?? user.username}
						</span>
					)}
				</div>
			</TableCell>
			<TableCell>
				<div className='flex flex-wrap gap-1'>
					<Badge variant={STATUS_VARIANT[status] ?? 'outline'}>{status}</Badge>
					{user.role === 'admin' && <Badge variant='outline'>app admin</Badge>}
				</div>
			</TableCell>
			<TableCell>
				{user.organizations.length === 0 ? (
					<span className='text-xs text-muted-foreground'>No memberships</span>
				) : (
					<div className='flex flex-wrap gap-1'>
						{user.organizations.map((org) => (
							<Badge key={org.id} variant='secondary'>
								{org.role}
							</Badge>
						))}
					</div>
				)}
			</TableCell>
			<TableCell className='text-xs text-muted-foreground'>
				{new Date(user.createdAt).toLocaleDateString()}
			</TableCell>
			<TableCell className='text-right'>
				<div className='flex justify-end gap-2'>
					{canUpdate && isActive && (
						<Button
							variant='outline'
							size='sm'
							disabled={busy}
							onClick={onDeactivate}
						>
							Deactivate
						</Button>
					)}
					{canUpdate && canRestore && (
						<Button variant='outline' size='sm' disabled={busy} onClick={onRestore}>
							Restore
						</Button>
					)}
					{canDelete && !user.deletedAt && (
						<AlertDialog>
							<AlertDialogTrigger
								render={
									<Button variant='ghost' size='sm' disabled={busy}>
										Delete
									</Button>
								}
							/>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Delete this user?</AlertDialogTitle>
									<AlertDialogDescription>
										{user.email} is soft-deleted and all sessions are revoked.
										Memberships are kept; an admin can restore the account
										later.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</div>
			</TableCell>
		</TableRow>
	);
}
