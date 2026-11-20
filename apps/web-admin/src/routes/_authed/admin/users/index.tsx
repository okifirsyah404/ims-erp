import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Funnel,
	MoreHorizontal,
	UserPlus,
	Users as UsersIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '@ims-erp/locales';
import { toast } from '@/components/toast';

import { Badge } from '@ims-erp/ui/components/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@ims-erp/ui/components/avatar';
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
} from '@ims-erp/ui/components/alert-dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@ims-erp/ui/components/dropdown-menu';
import { Input } from '@ims-erp/ui/components/input';
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from '@ims-erp/ui/components/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import {
	ADMIN_PERMISSIONS,
	cancelInvitation,
	deleteInvitation,
	deleteUser,
	deactivateUser,
	listInvitations,
	resendInvitation,
	restoreUser,
	usersQueryOptions,
	type TAdminUser,
	type TUserListParams,
	type TUserSortDirection,
	type TUserStatus,
} from '@/lib/admin-api';
import { organizationsQueryOptions } from '@/lib/organization-api';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { InviteDialog } from '@/components/invite/invite-dialog';
import {
	PendingInvitationsPanel,
	type TInvitationSource,
} from '@/components/admin/pending-invitations-panel';
import { useActiveOrganizationId } from '@/lib/use-active-organization';
import { usePermission } from '@/lib/use-permission';
import { humanizeIdentifier } from '@/lib/format';
import { erpRoleLabel, hasRole } from '@ims-erp/common';

/** Sort fields the users table header exposes. */
const SORT_FIELDS = ['name', 'createdAt', 'joinedAt'] as const;
type TSortField = (typeof SORT_FIELDS)[number];

/** Search params for the users table (URL-backed filters). */
type TUsersSearch = {
	page?: number;
	status?: TUserStatus;
	search?: string;
	includeDeleted?: boolean;
	organizationId?: string;
	sortBy?: TSortField;
	sortDir?: TUserSortDirection;
};

export const Route = createFileRoute('/_authed/admin/users/')({
	validateSearch: (search: Record<string, unknown>): TUsersSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		status: (search.status as TUserStatus | undefined) || undefined,
		search: typeof search.search === 'string' ? search.search : undefined,
		includeDeleted: search.includeDeleted === true || search.includeDeleted === 'true',
		organizationId:
			typeof search.organizationId === 'string' && search.organizationId
				? search.organizationId
				: undefined,
		sortBy: SORT_FIELDS.includes(search.sortBy as TSortField)
			? (search.sortBy as TSortField)
			: undefined,
		sortDir: search.sortDir === 'asc' || search.sortDir === 'desc'
			? search.sortDir
			: undefined,
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

/** Per-column placeholders matching the Users table's shape. `elements`
 *  renders multiple stacked skeletons (e.g. avatar + text in one cell). */
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
		organizationId: search.organizationId,
		sortBy: search.sortBy ?? 'createdAt',
		sortDir: search.sortDir ?? 'desc',
	};

	const { data, isPending, isError, error } = useQuery({
		...usersQueryOptions(organizationId ?? '', params),
		enabled: !!organizationId,
	});

	// Organization options for the filter dropdown. Includes soft-deleted orgs
	// so historical memberships still resolve to a label.
	const { data: orgData } = useQuery({
		...organizationsQueryOptions,
		enabled: !!organizationId,
	});
	const orgOptions = orgData?.rows ?? [];

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

	// Invitations here are application-wide: the panel's endpoints are
	// `/admin/invitations`, which only a global admin can reach.
	const invitationSource: TInvitationSource = {
		queryOptions: {
			queryKey: ['admin-invitations', organizationId, 'pending'],
			queryFn: () => listInvitations(organizationId!, { status: 'pending' }),
			staleTime: 15 * 1000,
		},
		resend: (invitationId) => resendInvitation(organizationId!, invitationId),
		cancel: (invitationId) => cancelInvitation(organizationId!, invitationId),
		remove: (invitationId) => deleteInvitation(organizationId!, invitationId),
		invalidate: [['admin-invitations'], ['admin-audit']],
	};

	const busy = deactivate.isPending || restore.isPending || remove.isPending;
	const columns = useMemo<ColumnDef<DataTableFeatures, TAdminUser, CellData>[]>(
		() => [
			{
				id: 'user',
				header: sortHeader(t('users.user'), 'name'),
				cell: ({ row }) => <UserIdentity user={row.original} />,
			},
			{
				id: 'status',
				header: t('users.filterStatus'),
				cell: ({ row }) => <UserStatusBadges user={row.original} />,
			},
			{
				id: 'roles',
				header: t('users.organizationRoles'),
				cell: ({ row }) => <UserOrganizations user={row.original} />,
			},
			{
				accessorKey: 'createdAt',
				header: sortHeader(t('users.created'), 'createdAt'),
				meta: { cellClassName: 'text-xs text-muted-foreground' },
				cell: ({ row }) =>
					row.original.createdAt
						? new Date(row.original.createdAt).toLocaleDateString()
						: '—',
			},
			{
				accessorKey: 'joinedAt',
				header: sortHeader(t('users.joined'), 'joinedAt'),
				meta: { cellClassName: 'text-xs text-muted-foreground' },
				// Pending users never claimed their invitation - no join date yet.
				cell: ({ row }) =>
					row.original.joinedAt
						? new Date(row.original.joinedAt).toLocaleDateString()
						: '—',
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('users.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<UserActions
						user={row.original}
						busy={busy}
						canUpdate={canUpdate}
						canDelete={canDelete}
						onDeactivate={() => deactivate.mutate(row.original.id)}
						onRestore={() => restore.mutate(row.original.id)}
						onDelete={() => remove.mutate(row.original.id)}
					/>
				),
			},
		],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[t, busy, canUpdate, canDelete, search.sortBy, search.sortDir],
	);
	if (!organizationId) {
		return (
			<div className='text-sm text-muted-foreground'>
				{t('nav:organization.required')}
			</div>
		);
	}

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;

	/** Toggles the sort column, flipping direction when already active. */
	function toggleSort(field: TSortField) {
		void navigate({
			search: (prev) => ({
				...prev,
				page: 1,
				sortBy: field,
				sortDir:
					(prev.sortBy ?? 'createdAt') === field
						? (prev.sortDir ?? 'desc') === 'desc'
							? 'asc'
							: 'desc'
						: 'asc',
			}),
		});
	}

	/** Sort indicator: direction arrows for the active column, neutral otherwise. */
	function sortIcon(field: TSortField) {
		const active = (search.sortBy ?? 'createdAt') === field;
		if (!active) return <ArrowUpDown className='ml-1 size-3' aria-hidden='true' />;
		return (search.sortDir ?? 'desc') === 'asc' ? (
			<ArrowUp className='ml-1 size-3' aria-hidden='true' />
		) : (
			<ArrowDown className='ml-1 size-3' aria-hidden='true' />
		);
	}

	/** Server-driven sort header: the URL holds the sort, not the table. */
	function sortHeader(label: string, field: TSortField) {
		return () => (
			<Button
				variant='ghost'
				size='sm'
				className='-ml-2 h-8'
				onClick={() => toggleSort(field)}
			>
				{label}
				{sortIcon(field)}
			</Button>
		);
	}



	return (
		<div className='flex flex-col gap-6'>
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
				<FiltersPopover
					status={search.status}
					organizationId={search.organizationId}
					orgOptions={orgOptions}
					onApply={(filters) =>
						void navigate({
							search: (prev) => ({
								...prev,
								page: 1,
								status: filters.status,
								organizationId: filters.organizationId,
							}),
						})
					}
					onReset={() => void navigate({ search: {} })}
				/>
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
						<ErrorState error={error} size='sm' />
					)}
					{!isPending && !isError && rows.length === 0 && (
						<EmptyState title={t('users.empty')} size='sm' />
					)}
					{(isPending || rows.length > 0) && (
						<DataTable
							columns={columns}
							data={rows}
							getRowId={(user) => user.id}
							loading={isPending}
						/>
					)}
					{isPending && <span className='sr-only'>{t('users.loading')}</span>}

					{pagination && (
						<PaginationControls
							page={pagination.page}
							totalPages={pagination.totalPages}
							onPageChange={(page) =>
								void navigate({
									search: (prev) => ({ ...prev, page }),
								})
							}
						/>
					)}
				</CardContent>
			</Card>

			<PendingInvitationsPanel source={invitationSource} />

			{canInvite && (
				<InviteDialog
					mode='admin'
					organizationId={organizationId ?? undefined}
					open={inviteOpen}
					onOpenChange={setInviteOpen}
					onInvited={() => void refresh()}
				/>
			)}
		</div>
	);
}

/** Avatar + name + email + handle for a user row. */
function UserIdentity({ user }: { user: TAdminUser }) {
	return (
		<div className='flex items-center gap-3'>
			<Avatar className='size-9'>
				{user.image && (
					<AvatarImage src={user.image} alt={user.name || user.email} />
				)}
				<AvatarFallback>
					{user.name
						? user.name
								.split(' ')
								.map((part) => part[0])
								.slice(0, 2)
								.join('')
								.toUpperCase()
						: '—'}
				</AvatarFallback>
			</Avatar>
			<div className='flex flex-col'>
				<span className='font-medium'>{user.name || '—'}</span>
				<span className='text-xs text-muted-foreground'>{user.email}</span>
				{user.username && (
					<span className='text-xs text-muted-foreground'>
						@{user.displayUsername ?? user.username}
					</span>
				)}
			</div>
		</div>
	);
}

/** Account status plus the app-admin marker. */
function UserStatusBadges({ user }: { user: TAdminUser }) {
	const status = user.deletedAt ? 'deleted' : (user.status ?? 'unknown');
	const { t } = useTranslation(['admin', 'common']);

	return (
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
			{hasRole(user.role, 'admin') && (
				<Badge variant='outline'>{t('users.appAdmin')}</Badge>
			)}
		</div>
	);
}

/** Organization memberships with the role held in each. */
function UserOrganizations({ user }: { user: TAdminUser }) {
	const { t, i18n } = useTranslation(['admin', 'common']);

	// `?? []` is defensive: a listing served by a handler that doesn't join
	// memberships omits the field entirely, and an unguarded `.length` crashed
	// the whole table.
	if ((user.organizations ?? []).length === 0) {
		return (
			<span className='text-xs text-muted-foreground'>
				{t('users.noMemberships')}
			</span>
		);
	}
	return (
		<div className='flex flex-wrap gap-1'>
			{(user.organizations ?? []).map((org) => (
				<Badge key={org.id} variant='secondary'>
					{`${humanizeIdentifier(org.name)} (${erpRoleLabel(org.role, i18n.language)})`}
				</Badge>
			))}
		</div>
	);
}

/** Row actions dropdown, including the controlled delete confirmation. */
function UserActions({
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
	const hasActions =
		(canUpdate && (isActive || canRestore)) || (canDelete && !user.deletedAt);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const { t } = useTranslation(['admin', 'common']);

	if (!hasActions) {
		return <span className='text-xs text-muted-foreground'>—</span>;
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant='ghost'
						size='sm'
						disabled={busy}
						aria-label={t('users.openActions')}
					>
						<MoreHorizontal className='size-4' />
					</Button>
				}
			/>
			<DropdownMenuContent align='end' className='w-44'>
				{canUpdate && isActive && (
					<DropdownMenuItem onSelect={onDeactivate}>
						{t('users.deactivate')}
					</DropdownMenuItem>
				)}
				{canUpdate && canRestore && (
					<DropdownMenuItem onSelect={onRestore}>
						{t('common:action.restore')}
					</DropdownMenuItem>
				)}
				{canDelete && !user.deletedAt && (
					<>
						{canUpdate && (isActive || canRestore) && <DropdownMenuSeparator />}
						{/* Controlled dialog: opening it from the menu item avoids
						    nesting an AlertDialog inside the menu portal (the trigger
						    must live outside the popup). */}
						<DropdownMenuItem
							variant='destructive'
							onSelect={() => setDeleteOpen(true)}
						>
							{t('common:action.delete')}
						</DropdownMenuItem>
						<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>{t('users.deleteTitle')}</AlertDialogTitle>
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
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}


/**
 * Filters popover: status + organization selects with draft state.
 *
 * Edits accumulate locally while the popover is open and only hit the URL
 * on `Apply` — closing without applying (Esc, outside click) discards them.
 * The URL stays the source of truth: drafts re-sync from props on open.
 */
function FiltersPopover({
	status,
	organizationId,
	orgOptions,
	onApply,
	onReset,
}: {
	status?: TUserStatus;
	organizationId?: string;
	orgOptions: Array<{ id: string; name: string }>;
	onApply: (filters: { status?: TUserStatus; organizationId?: string }) => void;
	onReset: () => void;
}) {
	const { t } = useTranslation(['admin', 'common']);
	const [open, setOpen] = useState(false);
	const [draftStatus, setDraftStatus] = useState<TUserStatus | undefined>(status);
	const [draftOrg, setDraftOrg] = useState<string | undefined>(organizationId);

	const activeCount =
		(status ? 1 : 0) + (organizationId ? 1 : 0);

	/** Re-seeds drafts from the URL whenever the popover opens. */
	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			setDraftStatus(status);
			setDraftOrg(organizationId);
		}
		setOpen(nextOpen);
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				render={
					<Button variant={activeCount > 0 ? 'default' : 'outline'}>
						<Funnel className='mr-2 size-4' />
						{t('users.filters')}
						{activeCount > 0 && (
							<Badge variant='secondary' className='ml-2'>
								{t('users.activeFilters', { count: activeCount })}
							</Badge>
						)}
					</Button>
				}
			/>
			<PopoverContent align='start' className='w-72'>
				<PopoverHeader>
					<PopoverTitle>{t('users.filtersTitle')}</PopoverTitle>
				</PopoverHeader>
				<div className='flex flex-col gap-3'>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>
							{t('users.filterStatus')}
						</span>
						<Select
							value={draftStatus ?? 'all'}
							onValueChange={(value) =>
								setDraftStatus(value === 'all' ? undefined : (value as TUserStatus))
							}
						>
							<SelectTrigger className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>{t('users.allStatuses')}</SelectItem>
								<SelectItem value='pending'>
									{t('common:status.pending')}
								</SelectItem>
								<SelectItem value='active'>{t('common:status.active')}</SelectItem>
								<SelectItem value='deactivated'>
									{t('common:status.deactivated')}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>
							{t('users.filterOrganization')}
						</span>
						<Select
							value={draftOrg ?? 'all'}
							onValueChange={(value) =>
								setDraftOrg(value === 'all' || value == null ? undefined : value)
							}
						>
							<SelectTrigger className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>
									{t('users.allOrganizations')}
								</SelectItem>
								{orgOptions.map((org) => (
									<SelectItem key={org.id} value={org.id}>
										{org.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className='mt-1 flex items-center justify-between gap-2'>
					<Button
						variant='ghost'
						size='sm'
						onClick={() => {
							setDraftStatus(undefined);
							setDraftOrg(undefined);
							onReset();
							setOpen(false);
						}}
					>
						{t('users.reset')}
					</Button>
					<Button
						size='sm'
						onClick={() => {
							onApply({ status: draftStatus, organizationId: draftOrg });
							setOpen(false);
						}}
					>
						{t('users.apply')}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
