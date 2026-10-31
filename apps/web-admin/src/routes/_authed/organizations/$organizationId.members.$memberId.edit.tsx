import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createFileRoute,
	useNavigate,
	useParams,
} from '@tanstack/react-router';
import { toast } from '@/components/toast';
import { useState } from 'react';

import { Button } from '@ims-erp/ui/components/button';
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
import {
	Field,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { erpRoleNames } from '@ims-erp/common';
import {
	organizationMembersQueryOptions,
	removeMember,
	updateMemberRole,
} from '@/lib/organization-api';

export const Route = createFileRoute(
	'/_authed/organizations/$organizationId/members/$memberId/edit',
)({
	component: EditMemberPage,
});

function EditMemberPage() {
	const { organizationId, memberId } = useParams({ from: Route.id });
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: members, isPending } = useQuery({
		...organizationMembersQueryOptions(organizationId),
	});
	const member = members?.rows.find((row) => row.id === memberId);

	const [role, setRole] = useState(member?.role ?? null);
	const [pending, setPending] = useState(false);
	const [removing, setRemoving] = useState(false);

	async function handleSave(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!role) return;
		setPending(true);
		try {
			await updateMemberRole(organizationId, memberId, role);
			toast.success('Member role updated');
			await queryClient.invalidateQueries({
				queryKey: organizationMembersQueryOptions(organizationId).queryKey,
			});
			void navigate({
				to: '/organizations/$organizationId',
				params: { organizationId },
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed');
		} finally {
			setPending(false);
		}
	}

	async function handleRemove() {
		setRemoving(true);
		try {
			await removeMember(organizationId, memberId);
			toast.success('Member removed');
			await queryClient.invalidateQueries({
				queryKey: organizationMembersQueryOptions(organizationId).queryKey,
			});
			void navigate({
				to: '/organizations/$organizationId',
				params: { organizationId },
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed');
		} finally {
			setRemoving(false);
		}
	}

	if (isPending) {
		return <div className='p-6 text-sm text-muted-foreground'>Loading…</div>;
	}
	if (!member) {
		return (
			<div className='p-6 text-sm text-muted-foreground'>Member not found.</div>
		);
	}

	const effectiveRole = role ?? member.role;

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div>
				<h1 className='text-2xl font-bold'>
					Edit member — {member.user?.name ?? member.userId}
				</h1>
				<p className='text-sm text-muted-foreground'>
					{member.user?.email ?? '—'}
				</p>
			</div>
			<Card className='max-w-xl'>
				<CardHeader>
					<CardTitle>Role</CardTitle>
					<CardDescription>
						The last owner cannot be demoted or removed; the backend rejects
						it.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className='flex flex-col gap-6'>
						<form onSubmit={handleSave}>
							<FieldGroup>
								<Field>
									<FieldLabel>Role</FieldLabel>
								<Select
									value={effectiveRole}
									onValueChange={(value) => {
										if (value != null) setRole(value);
									}}
								>
										<SelectTrigger className='w-full'>
											<SelectValue placeholder='Select a role' />
										</SelectTrigger>
										<SelectContent>
											{erpRoleNames.map((roleName) => (
												<SelectItem key={roleName} value={roleName}>
													{roleName}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
								<div className='flex gap-2'>
									<Button
										type='submit'
										disabled={pending || effectiveRole === member.role}
									>
										{pending ? 'Saving…' : 'Save'}
									</Button>
									<Button
										type='button'
										variant='outline'
										onClick={() =>
											navigate({
												to: '/organizations/$organizationId',
												params: { organizationId },
											})
										}
									>
										Cancel
									</Button>
								</div>
							</FieldGroup>
						</form>

						<AlertDialog>
							<AlertDialogTrigger render={<Button variant='destructive' />}>
								Remove member
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										Remove {member.user?.name ?? member.userId} from the
										organization?
									</AlertDialogTitle>
									<AlertDialogDescription>
										The user loses all organization access. Their account
										itself is not deleted. The last owner cannot be removed.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={() => void handleRemove()}
										disabled={removing}
									>
										{removing ? 'Removing…' : 'Remove'}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
