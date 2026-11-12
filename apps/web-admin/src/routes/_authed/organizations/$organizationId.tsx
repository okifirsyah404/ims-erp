import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createFileRoute,
	Link,
	Outlet,
	useMatches,
	useNavigate,
	useParams,
} from '@tanstack/react-router';
import { toast } from '@/components/toast';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Badge } from '@ims-erp/ui/components/badge';
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
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ims-erp/ui/components/tabs';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { OrganizationMemberCard } from '@/components/organization';
import { InviteDialog } from '@/components/invite/invite-dialog';
import {
	PendingInvitationsPanel,
	type TInvitationSource,
} from '@/components/admin/pending-invitations-panel';
import {
	cancelOrgInvitation,
	deleteOrgInvitation,
	listOrgInvitations,
	resendOrgInvitation,
} from '@/lib/org-invitation-api';
import {
	deleteOrganization,
	organizationMembersQueryOptions,
	organizationQueryOptions,
	organizationsQueryOptions,
} from '@/lib/organization-api';
import { usePermission } from '@/lib/use-permission';

export const Route = createFileRoute('/_authed/organizations/$organizationId')({
	component: OrganizationDetailPage,
});

/** Members per page in the members tab (matches the backend default). */
const MEMBER_PAGE_SIZE = 20;

function OrganizationDetailPage() {
	const { organizationId } = useParams({ from: Route.id });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const canUpdate = usePermission('organization.update');
	const canDelete = usePermission('organization.delete');
	const canManageMembers = usePermission('invitation.create');
	const canReadMembers = usePermission('member.read');
	const { t } = useTranslation(['admin', 'common']);

	const { data: organization, isPending } = useQuery({
		...organizationQueryOptions(organizationId),
		retry: false,
	});
	const [memberPage, setMemberPage] = useState(1);
	const membersQuery = useQuery({
		...organizationMembersQueryOptions(organizationId, memberPage, MEMBER_PAGE_SIZE),
		placeholderData: (previous) => previous,
		enabled: canReadMembers,
	});
	const { data: members } = membersQuery;

	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [inviteOpen, setInviteOpen] = useState(false);

	// Invitations for THIS organization: org admins reach them without the
	// application-admin-only `/admin/invitations` surface.
	const invitationSource: TInvitationSource = {
		queryOptions: {
			queryKey: ['org-invitations', organizationId, 'pending'],
			queryFn: () =>
				listOrgInvitations(organizationId, { status: 'pending' }),
			staleTime: 15 * 1000,
		},
		resend: (invitationId) => resendOrgInvitation(organizationId, invitationId),
		cancel: (invitationId) => cancelOrgInvitation(organizationId, invitationId),
		remove: (invitationId) => deleteOrgInvitation(organizationId, invitationId),
		invalidate: [
			['org-invitations'],
			['admin-audit'],
			['organizations', organizationId, 'members'],
		],
	};

	// Child routes (edit, members/new, members/$memberId/edit) render instead
	// of the detail page. The last match's routeId tells us which page is the
	// active leaf; `useChildMatches` can't be used here because it also counts
	// this route's own match.
	const matches = useMatches();
	const isChildActive = matches.at(-1)?.routeId !== Route.id;

	if (isChildActive) {
		return <Outlet />;
	}

	async function handleDelete() {
		setDeleting(true);
		try {
			await deleteOrganization(organizationId);
			toast.success(t('orgDetail.deleted'));
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: organizationsQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: organizationQueryOptions(organizationId).queryKey,
				}),
			]);
			void navigate({ to: '/organizations' });
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setDeleting(false);
			setConfirmOpen(false);
		}
	}

	if (isPending) {
		return (
			<div className='flex flex-col gap-6' aria-busy='true'>
				{/* Header */}
				<div className='flex items-start justify-between gap-4'>
					<div className='flex flex-col gap-2'>
						<Skeleton className='h-8 w-64' />
						<Skeleton className='h-4 w-48' />
					</div>
					<Skeleton className='h-9 w-20' />
				</div>
				{/* Tabs */}
				<div className='flex flex-col gap-4'>
					<div className='flex gap-2'>
						<Skeleton className='h-8 w-20' />
						<Skeleton className='h-8 w-32' />
					</div>
					{/* Info card */}
					<Card>
						<CardHeader>
							<Skeleton className='h-5 w-24' />
						</CardHeader>
						<CardContent>
							<div className='grid gap-2'>
								<Skeleton className='h-4 w-full max-w-sm' />
								<Skeleton className='h-4 w-full max-w-xs' />
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}
	if (!organization) {
		return (
			<div className='flex flex-col gap-6'>
				<p className='text-sm text-muted-foreground'>
					{t('orgDetail.notFound')}
				</p>
				<Button
					variant='outline'
					className='w-fit'
					onClick={() => navigate({ to: '/organizations' })}
				>
					{t('orgDetail.backToList')}
				</Button>
			</div>
		);
	}

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<div className='flex items-center gap-2'>
						<h1 className='text-2xl font-bold'>{organization.name}</h1>
						{organization.deletedAt && (
							<Badge variant='destructive'>{t('orgs.deletedBadge')}</Badge>
						)}
					</div>
					<p className='text-sm text-muted-foreground'>
						{t('orgDetail.createdOn', {
							slug: organization.slug,
							date: new Date(organization.createdAt).toLocaleDateString(),
						})}
					</p>
				</div>
				{!organization.deletedAt && (
					<div className='flex gap-2'>
						{canUpdate && (
							<Button
								variant='outline'
								render={
									<Link
										to='/organizations/$organizationId/edit'
										params={{ organizationId }}
									/>
								}
							>
								{t('common:action.edit')}
							</Button>
						)}
						{canDelete && (
							<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
								<AlertDialogTrigger render={<Button variant='destructive' />}>
									{t('common:action.delete')}
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											{t('orgDetail.deleteTitle', { name: organization.name })}
										</AlertDialogTitle>
										<AlertDialogDescription>
											{t('orgDetail.deleteDescription')}
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>
											{t('common:action.cancel')}
										</AlertDialogCancel>
										<AlertDialogAction
											onClick={() => void handleDelete()}
											disabled={deleting}
										>
											{deleting
												? t('orgDetail.deleting')
												: t('common:action.delete')}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						)}
					</div>
				)}
			</div>

			<Tabs defaultValue='info'>
				<TabsList>
					<TabsTrigger value='info'>{t('orgDetail.info')}</TabsTrigger>
					{canReadMembers && (
						<TabsTrigger value='members'>
							{t('orgDetail.membersCount', {
								count: members?.pagination.total ?? 0,
							})}
						</TabsTrigger>
					)}
				</TabsList>
				<TabsContent value='info'>
					<Card>
						<CardHeader>
							<CardTitle>{t('orgDetail.details')}</CardTitle>
						</CardHeader>
						<CardContent className='grid gap-2 text-sm'>
							<div className='grid grid-cols-[140px_1fr] gap-2'>
								<span className='text-muted-foreground'>
									{t('orgDetail.name')}
								</span>
								<span>{organization.name}</span>
								<span className='text-muted-foreground'>
									{t('orgDetail.slug')}
								</span>
								<span>{organization.slug}</span>
								<span className='text-muted-foreground'>
									{t('orgDetail.created')}
								</span>
								<span>{new Date(organization.createdAt).toLocaleString()}</span>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value='members' className='flex flex-col gap-6'>
					<Card className='gap-0 py-0'>
						<div className='flex items-center justify-between gap-4 border-b px-4 py-4'>
							<div>
								<h2 className='font-semibold leading-none'>
									{t('orgDetail.members')}
								</h2>
								<p className='mt-1.5 text-sm text-muted-foreground'>
									{t('orgDetail.membersDescription')}
								</p>
							</div>
							{canManageMembers && (
								<Button className='shrink-0' onClick={() => setInviteOpen(true)}>
									{t('orgDetail.addMember')}
								</Button>
							)}
						</div>
						{membersQuery.isPending ? (
							<div className='grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6'>
								{Array.from({ length: 6 }, (_, index) => (
									<Card key={`member-skeleton-${index}`} className='gap-2 py-3'>
										<div className='flex items-center gap-2.5 px-3'>
											<Skeleton className='size-9 shrink-0 rounded-full' />
											<div className='flex flex-1 flex-col gap-1.5'>
												<Skeleton className='h-4 w-3/4' />
												<Skeleton className='h-3 w-full' />
											</div>
										</div>
										<div className='flex items-center justify-between gap-2 px-3'>
											<Skeleton className='h-5 w-24' />
											<Skeleton className='h-3 w-16' />
										</div>
										<Skeleton className='mx-1 h-7' />
									</Card>
								))}
							</div>
						) : (members?.rows?.length ?? 0) === 0 ? (
							<p className='py-6 text-center text-sm text-muted-foreground'>
								{t('orgDetail.membersEmpty')}
							</p>
						) : (
							<div className='flex flex-col'>
								<div className='grid flex-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6'>
									{(members?.rows ?? []).map((member) => (
										<OrganizationMemberCard
											key={member.id}
											member={member}
											organizationId={organizationId}
										/>
									))}
								</div>
								<PaginationControls
									className='mx-4 border-t py-4 mt-0'
									page={members?.pagination.page ?? memberPage}
									totalPages={members?.pagination.totalPages ?? 1}
									onPageChange={setMemberPage}
								/>
							</div>
						)}
					</Card>
					<PendingInvitationsPanel source={invitationSource} />
				</TabsContent>
			</Tabs>

			{canManageMembers && (
				<InviteDialog
					mode='org'
					organizationId={organizationId}
					open={inviteOpen}
					onOpenChange={setInviteOpen}
					onInvited={() =>
						void Promise.all([
							queryClient.invalidateQueries({
								queryKey: ['organizations', organizationId, 'members'],
							}),
							queryClient.invalidateQueries({ queryKey: ['org-invitations'] }),
						])
					}
				/>
			)}
		</div>
	);
}
