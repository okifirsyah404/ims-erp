import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { toast } from '@/components/toast';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';

/**
 * Change-password form (`/account`). Runs Better Auth's
 * `changePassword` — the current session is kept, other sessions are
 * revoked when the checkbox is on.
 */
export function ChangePasswordForm() {
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [revokeOthers, setRevokeOthers] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		if (newPassword !== confirm) {
			setError('New passwords do not match');
			return;
		}
		setPending(true);
		try {
			const { error: changeError } = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: revokeOthers,
			});
			if (changeError) {
				setError(changeError.message ?? 'Could not change password');
				return;
			}
			toast.success('Password changed');
			setCurrentPassword('');
			setNewPassword('');
			setConfirm('');
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
				<CardTitle>Change password</CardTitle>
				<CardDescription>
					Choose a new password for your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor='current-password'>
								Current password
							</FieldLabel>
							<Input
								id='current-password'
								type='password'
								required
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
								autoComplete='current-password'
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='new-password'>New password</FieldLabel>
							<Input
								id='new-password'
								type='password'
								required
								minLength={8}
								maxLength={128}
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								autoComplete='new-password'
							/>
							<FieldDescription>At least 8 characters.</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='confirm-password'>
								Confirm new password
							</FieldLabel>
							<Input
								id='confirm-password'
								type='password'
								required
								value={confirm}
								onChange={(e) => setConfirm(e.target.value)}
								autoComplete='new-password'
							/>
						</Field>
						<Field orientation='horizontal'>
							<Checkbox
								id='revoke-others'
								checked={revokeOthers}
								onCheckedChange={(checked) =>
									setRevokeOthers(checked === true)
								}
							/>
							<FieldLabel htmlFor='revoke-others' className='font-normal'>
								Log out all other devices
							</FieldLabel>
						</Field>
						{error && (
							<p className='text-destructive text-sm' role='alert'>
								{error}
							</p>
						)}
						<div>
							<Button type='submit' disabled={pending}>
								{pending ? 'Changing…' : 'Change password'}
							</Button>
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
