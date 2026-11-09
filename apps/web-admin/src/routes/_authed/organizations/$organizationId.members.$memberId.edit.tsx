import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createFileRoute,
	useNavigate,
	useParams,
} from '@tanstack/react-router';
import { toast } from '@/components/toast';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
	const { t } = useTranslation(['admin', 'common']);

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
			toast.success(t('memberEdit.updated'));
			await queryClient.invalidateQueries({
				queryKey: organizationMembersQueryOptions(organizationId).queryKey,
			});
			void navigate({
				to: '/organizations/$organizationId',
				params: { organizationId },
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setPending(false);
		}
	}

	async function handleRemove() {
		setRemoving(true);
		try {
			await removeMember(organizationId, memberId);
			toast.success(t('memberEdit.removed'));
			await queryClient.invalidateQueries({
				queryKey: organizationMembersQueryOptions(organizationId).queryKey,
			});
			void navigate({
				to: '/organizations/$organizationId',
				params: { organizationId },
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setRemoving(false);
		}
	}

	if (isPending) {
		return (
			<div className='text-sm text-muted-foreground'>
				{t('common:state.loading')}
			</div>
		);
	}
	if (!member) {
		return (
			<div className='text-sm text-muted-foreground'>
				{t('common:state.noResults')}
			</div>
		);
	}

	const effectiveRole = role ?? member.role;

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>
					{t('memberEdit.title')} — {member.user?.name ?? member.userId}
				</h1>
				<p className='text-sm text-muted-foreground'>
					{member.user?.email ?? '—'}
				</p>
			</div>
			<Card className='max-w-xl'>
				<CardHeader>
					<CardTitle>{t('memberEdit.role')}</CardTitle>
					<CardDescription>{t('memberEdit.description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<div className='flex flex-col gap-6'>
						<form onSubmit={handleSave}>
							<FieldGroup>
								<Field>
									<FieldLabel>{t('memberEdit.role')}</FieldLabel>
									<Select
										value={effectiveRole}
										onValueChange={(value) => {
											if (value != null) setRole(value);
										}}
									>
										<SelectTrigger className='w-full'>
											<SelectValue placeholder={t('invite.rolePlaceholder')} />
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
										{pending
											? t('common:action.saving')
											: t('common:action.save')}
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
										{t('common:action.cancel')}
									</Button>
								</div>
							</FieldGroup>
						</form>

						<AlertDialog>
							<AlertDialogTrigger render={<Button variant='destructive' />}>
								{t('memberEdit.remove')}
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										{t('memberEdit.removeTitle', {
											name: member.user?.name ?? member.userId,
										})}
									</AlertDialogTitle>
									<AlertDialogDescription>
										{t('memberEdit.removeDescription')}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>
										{t('common:action.cancel')}
									</AlertDialogCancel>
									<AlertDialogAction
										onClick={() => void handleRemove()}
										disabled={removing}
									>
										{removing
											? t('memberEdit.removing')
											: t('memberEdit.removeConfirm')}
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
