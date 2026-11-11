import { useQueryClient } from '@tanstack/react-query';
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
import { erpRoleLabel, erpRoleNames } from '@ims-erp/common';
import { sendInvitations } from '@/lib/admin-api';

export const Route = createFileRoute(
	'/_authed/organizations/$organizationId/members/new',
)({
	component: InviteMemberPage,
});

/**
 * Invite a new member into this organization. Sends an invitation email
 * (`POST /admin/invitations`, org path): the invitee is pre-created as a
 * pending user and joins the organization with the chosen role when they
 * claim the invitation link.
 */
function InviteMemberPage() {
	const { organizationId } = useParams({ from: Route.id });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { t, i18n } = useTranslation(['admin', 'common']);

	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [role, setRole] = useState<string>('member');
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		try {
			await sendInvitations(organizationId, {
				email,
				name,
				organizationId,
				organizationRole: role,
			});
			toast.success(t('memberNew.invited'));
			// Pending invitations appear in the admin users page panel; the
			// members list itself only changes after the invite is claimed.
			await queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
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

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('memberNew.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('memberNew.description')}
				</p>
			</div>
			<Card className='max-w-xl'>
				<CardHeader>
					<CardTitle>{t('memberNew.membership')}</CardTitle>
					<CardDescription>
						{t('memberNew.membershipDescription')}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='name'>{t('memberNew.name')}</FieldLabel>
								<input
									id='name'
									className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs'
									value={name}
									required
									maxLength={120}
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='email'>{t('memberNew.email')}</FieldLabel>
								<input
									id='email'
									type='email'
									className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs'
									value={email}
									required
									maxLength={320}
									onChange={(event) => setEmail(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel>{t('memberNew.role')}</FieldLabel>
								<Select
									value={role}
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
												{erpRoleLabel(roleName, i18n.language)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<div className='flex gap-2'>
								<Button type='submit' disabled={pending || !email || !name}>
									{pending ? t('memberNew.sending') : t('memberNew.submit')}
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
				</CardContent>
			</Card>
		</div>
	);
}
