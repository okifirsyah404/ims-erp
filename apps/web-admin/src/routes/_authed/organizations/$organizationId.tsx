import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createFileRoute,
	Link,
	useNavigate,
	useParams,
} from '@tanstack/react-router';
import { toast } from '@/components/toast';
import { useState } from 'react';

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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
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

	const { data: organization, isPending } = useQuery({
		...organizationQueryOptions(organizationId),
		retry: false,
	});
	const { data: members } = useQuery({
		...organizationMembersQueryOptions(organizationId),
	});

	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);

	async function handleDelete() {
		setDeleting(true);
		try {
			await deleteOrganization(organizationId);
			toast.success('Organization deleted (soft)');
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
			toast.error(error instanceof Error ? error.message : 'Failed');
		} finally {
			setDeleting(false);
			setConfirmOpen(false);
		}
	}

	if (isPending) {
		return <div className='p-6 text-sm text-muted-foreground'>Loading…</div>;
	}
	if (!organization) {
		return (
			<div className='flex flex-col gap-4 p-6'>
				<p className='text-sm text-muted-foreground'>
					Organization not found (or you lack access).
				</p>
				<Button
					variant='outline'
					className='w-fit'
					onClick={() => navigate({ to: '/organizations' })}
				>
					Back to organizations
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
							<Badge variant='destructive'>Deleted</Badge>
						)}
					</div>
					<p className='text-sm text-muted-foreground'>
						{organization.slug} · created{' '}
						{new Date(organization.createdAt).toLocaleDateString()}
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
								Edit
							</Button>
						)}
						{canDelete && (
							<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
								<AlertDialogTrigger render={<Button variant='destructive' />}>
									Delete
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											Delete organization “{organization.name}”?
										</AlertDialogTitle>
										<AlertDialogDescription>
											This soft-deletes the organization. Its data remains
											recoverable via restore, but the organization switcher
											and membership access stop working until restored.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											onClick={() => void handleDelete()}
											disabled={deleting}
										>
											{deleting ? 'Deleting…' : 'Delete'}
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
					<TabsTrigger value='info'>Info</TabsTrigger>
					<TabsTrigger value='members'>
						Members ({members?.rows.length ?? 0})
					</TabsTrigger>
				</TabsList>
				<TabsContent value='info'>
					<Card>
						<CardHeader>
							<CardTitle>Details</CardTitle>
						</CardHeader>
						<CardContent className='grid gap-2 text-sm'>
							<div className='grid grid-cols-[140px_1fr] gap-2'>
								<span className='text-muted-foreground'>Name</span>
								<span>{organization.name}</span>
								<span className='text-muted-foreground'>Slug</span>
								<span>{organization.slug}</span>
								<span className='text-muted-foreground'>Created</span>
								<span>{new Date(organization.createdAt).toLocaleString()}</span>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value='members'>
					<Card>
						<CardHeader className='flex-row items-center justify-between'>
							<div>
								<CardTitle>Members</CardTitle>
								<CardDescription>
									People with access to this organization.
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
									Add member
								</Button>
							)}
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Role</TableHead>
										<TableHead>Joined</TableHead>
										<TableHead className='text-right'>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(members?.rows ?? []).map((member) => (
										<TableRow key={member.id}>
											<TableCell className='font-medium'>
												{member.user?.name ?? member.userId}
											</TableCell>
											<TableCell>{member.user?.email ?? '—'}</TableCell>
											<TableCell>
												<Badge variant='outline'>{member.role}</Badge>
											</TableCell>
											<TableCell>
												{new Date(member.createdAt).toLocaleDateString()}
											</TableCell>
											<TableCell className='text-right'>
												<Button
													variant='ghost'
													size='sm'
													render={
														<Link
															to='/organizations/$organizationId/members/$memberId/edit'
															params={{
																organizationId,
																memberId: member.id,
															}}
														/>
													}
												>
													Edit
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
