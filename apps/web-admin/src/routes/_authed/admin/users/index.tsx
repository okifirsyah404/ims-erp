import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { UserPlus, Users as UsersIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '@ims-erp/locales';
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
import { Skeleton } from '@ims-erp/ui/components/skeleton';
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

export const Route = createFileRoute('/_authed/admin/users/')({
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

/** Number of placeholder rows shown while the first page loads. */
const SKELETON_ROW_COUNT = 5;

/** Per-column placeholder widths, matching the Users table's shape. */
const SKELETON_CELLS = [
	{ key: 'user', className: 'h-4 w-40' },
	{ key: 'status', className: 'h-5 w-20 rounded-full' },
	{ key: 'roles', className: 'h-4 w-28' },
	{ key: 'created', className: 'h-4 w-24' },
	{ key: 'actions', className: 'ml-auto h-8 w-16' },
] as const;

function UsersPage() {
	const organizationId = useActiveOrganizationId();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const { t } = useTranslation(['admin', 'common', 'nav']);

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
			toast.success(t('users.deactivated'));
			await refresh();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const restore = useMutation({
		mutationFn: (userId: string) => restoreUser(organizationId!, userId),
		onSuccess: async () => {
			toast.success(t('users.restored'));
			await refresh();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const remove = useMutation({
		mutationFn: (userId: string) => deleteUser(organizationId!, userId),
		onSuccess: async () => {
			toast.success(t('users.deleted'));
			await refresh();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	if (!organizationId) {
		return (
			<div className='p-6 text-sm text-muted-foreground'>
				{t('nav:organization.required')}
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
						{t('users.title')}
					</h1>
					<p className='text-sm text-muted-foreground'>
						{t('users.description')}
					</p>
				</div>
				{canInvite && (
					<Button onClick={() => setInviteOpen(true)}>
						<UserPlus className='mr-2 size-4' />
						{t('users.invite')}
					</Button>
				)}
			</div>

			{/* Filters ------------------------------------------------------ */}
			<div className='flex flex-wrap items-end gap-3'>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>
						{t('users.search')}
					</span>
					<Input
						className='w-64'
						placeholder={t('users.searchPlaceholder')}
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
					<span className='text-xs text-muted-foreground'>
						{t('users.filterStatus')}
					</span>
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
							<SelectItem value='all'>{t('users.allStatuses')}</SelectItem>
							<SelectItem value='pending'>{t('common:status.pending')}</SelectItem>
							<SelectItem value='active'>{t('common:status.active')}</SelectItem>
							<SelectItem value='deactivated'>
								{t('common:status.deactivated')}
							</SelectItem>
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
					{t('users.apply')}
				</Button>
				<Button
					variant='ghost'
					onClick={() => {
						setSearchDraft('');
						void navigate({ search: {} });
					}}
				>
					{t('users.reset')}
				</Button>
			</div>

			{/* Table -------------------------------------------------------- */}
			<Card>
				<CardHeader>
					<CardTitle>{t('users.accounts')}</CardTitle>
					<CardDescription>
						{pagination ? (
							t('users.count', { count: pagination.total })
						) : isPending ? (
							<Skeleton className='h-4 w-20 motion-reduce:animate-none' />
						) : null}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isError && (
						<p className='text-sm text-destructive'>{(error as Error).message}</p>
					)}
					{!isPending && !isError && rows.length === 0 && (
						<p className='text-sm text-muted-foreground'>{t('users.empty')}</p>
					)}
					{(isPending || rows.length > 0) && (
						<Table aria-busy={isPending || undefined}>
							<TableHeader>
								<TableRow>
									<TableHead>{t('users.user')}</TableHead>
									<TableHead>{t('users.filterStatus')}</TableHead>
									<TableHead>{t('users.organizationRoles')}</TableHead>
									<TableHead>{t('users.created')}</TableHead>
									<TableHead className='text-right'>
										{t('users.actions')}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isPending &&
									Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
										<TableRow key={index} aria-hidden='true'>
											{SKELETON_CELLS.map((cell) => (
												<TableCell key={cell.key}>
													<Skeleton
														className={`${cell.className} motion-reduce:animate-none`}
													/>
												</TableCell>
											))}
										</TableRow>
									))}
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
					{isPending && <span className='sr-only'>{t('users.loading')}</span>}

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
								{t('common:action.previous')}
							</Button>
							<span className='text-xs text-muted-foreground'>
								{t('common:pagination.summary', {
									page: pagination.page,
									totalPages: pagination.totalPages,
								})}
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
								{t('common:action.next')}
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
	const { t } = useTranslation(['admin', 'common']);

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
					<Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
						{/*
						 * The only dynamically composed key in the app: `status` comes from
						 * the backend, so it cannot be narrowed statically. `defaultValue`
						 * falls back to the raw status if a new one appears before the
						 * `common:status.*` keys are updated.
						 */}
						{t(`common:status.${status}` as TranslationKey, { defaultValue: status })}
					</Badge>
					{user.role === 'admin' && (
						<Badge variant='outline'>{t('users.appAdmin')}</Badge>
					)}
				</div>
			</TableCell>
			<TableCell>
				{/* `?? []` is defensive: a listing served by a handler that
				    doesn't join memberships omits the field entirely, and an
				    unguarded `.length` crashed the whole table. */}
				{(user.organizations ?? []).length === 0 ? (
					<span className='text-xs text-muted-foreground'>
						{t('users.noMemberships')}
					</span>
				) : (
					<div className='flex flex-wrap gap-1'>
						{(user.organizations ?? []).map((org) => (
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
							{t('users.deactivate')}
						</Button>
					)}
					{canUpdate && canRestore && (
						<Button variant='outline' size='sm' disabled={busy} onClick={onRestore}>
							{t('common:action.restore')}
						</Button>
					)}
					{canDelete && !user.deletedAt && (
						<AlertDialog>
							<AlertDialogTrigger
								render={
									<Button variant='ghost' size='sm' disabled={busy}>
										{t('common:action.delete')}
									</Button>
								}
							/>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										{t('users.deleteTitle')}
									</AlertDialogTitle>
									<AlertDialogDescription>
										{t('users.deleteDescription', { email: user.email })}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>
										{t('common:action.cancel')}
									</AlertDialogCancel>
									<AlertDialogAction onClick={onDelete}>
										{t('common:action.delete')}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</div>
			</TableCell>
		</TableRow>
	);
}
