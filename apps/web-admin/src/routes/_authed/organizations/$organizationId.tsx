import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createFileRoute,
	Link,
	Outlet,
	useChildMatches,
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
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ims-erp/ui/components/tabs';
import { OrganizationMemberCard } from '@/components/organization';
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

function OrganizationDetailPage() {
	const { organizationId } = useParams({ from: Route.id });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const canUpdate = usePermission('organization.update');
	const canDelete = usePermission('organization.delete');
	const canManageMembers = usePermission('member.create');
	const { t } = useTranslation(['admin', 'common']);

	const { data: organization, isPending } = useQuery({
		...organizationQueryOptions(organizationId),
		retry: false,
	});
	const { data: members } = useQuery({
		...organizationMembersQueryOptions(organizationId),
	});

	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);

	// Child routes (edit, members/new, members/$memberId/edit) render via the
	// Outlet; the detail page must yield so the child page displays full-page.
	const isChildActive = useChildMatches();

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
			<div className='p-6 text-sm text-muted-foreground'>
				{t('common:state.loading')}
			</div>
		);
	}
	if (!organization) {
		return (
			<div className='flex flex-col gap-4 p-6'>
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
		<div className='flex flex-col gap-6 p-6'>
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
					<TabsTrigger value='members'>
						{t('orgDetail.membersCount', {
							count: members?.rows.length ?? 0,
						})}
					</TabsTrigger>
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
				<TabsContent value='members'>
					<Card>
						<CardHeader className='flex-row items-center justify-between'>
							<div>
								<CardTitle>{t('orgDetail.members')}</CardTitle>
								<CardDescription>
									{t('orgDetail.membersDescription')}
								</CardDescription>
							</div>
							{canManageMembers && (
								<Button
									render={
										<Link
											to='/organizations/$organizationId/members/new'
											params={{ organizationId }}
										/>
									}
								>
									{t('orgDetail.addMember')}
								</Button>
							)}
						</CardHeader>
						<CardContent>
							{(members?.rows?.length ?? 0) === 0 ? (
								<p className='py-6 text-center text-sm text-muted-foreground'>
									{t('orgDetail.membersEmpty')}
								</p>
							) : (
								<div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
									{(members?.rows ?? []).map((member) => (
										<OrganizationMemberCard
											key={member.id}
											member={member}
											organizationId={organizationId}
										/>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
