import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { toast } from '@/components/toast';
import { selfUserQueryOptions } from '@/lib/user-api';
import { useSuspenseQuery } from '@tanstack/react-query';
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
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';

/**
 * Change-email form (`/account/email`). Shows the current email with its
 * verification status; runs Better Auth's `changeEmail` (a verification
 * email is sent to the new address — currently logged by the backend).
 */
export function ChangeEmailForm() {
	const { data: user } = useSuspenseQuery(selfUserQueryOptions);
	const [newEmail, setNewEmail] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [requested, setRequested] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setPending(true);
		try {
			const { error: changeError } = await authClient.changeEmail({
				newEmail,
			});
			if (changeError) {
				setError(changeError.message ?? 'Could not change email');
				return;
			}
			setRequested(true);
			toast.success('Verification email sent');
			setNewEmail('');
		} catch {
			setError(
				'Cannot reach the server. Check your connection and try again.',
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Email</CardTitle>
				<CardDescription>
					Your sign-in email. Changing it requires verifying the new address.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor='current-email'>Current email</FieldLabel>
						<div className='flex items-center gap-2'>
							<Input
								id='current-email'
								value={user.email}
								readOnly
								className='flex-1'
							/>
							<Badge variant={user.emailVerified ? 'secondary' : 'outline'}>
								{user.emailVerified ? 'Verified' : 'Unverified'}
							</Badge>
						</div>
					</Field>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='new-email'>New email</FieldLabel>
								<Input
									id='new-email'
									type='email'
									required
									value={newEmail}
									onChange={(e) => setNewEmail(e.target.value)}
									autoComplete='email'
								/>
								<FieldDescription>
									A verification link will be sent to the new address.
								</FieldDescription>
							</Field>
							{requested && (
								<FieldDescription>
									Verification requested — check the new inbox to confirm.
								</FieldDescription>
							)}
							{error && (
								<p className='text-destructive text-sm' role='alert'>
									{error}
								</p>
							)}
							<div>
								<Button type='submit' disabled={pending}>
									{pending ? 'Requesting…' : 'Change email'}
								</Button>
							</div>
						</FieldGroup>
					</form>
				</FieldGroup>
			</CardContent>
		</Card>
	);
}
