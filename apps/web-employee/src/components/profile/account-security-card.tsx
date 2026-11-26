import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { PasswordInput } from '@/components/password-input';
import { toast } from '@/components/toast';
import { authClient } from '@/lib/auth-client';

/**
 * Account security: change the password, or leave.
 *
 * @remarks
 * Email, username and roles are HR/administrator-owned, so this card offers
 * only what a Better Auth session can do on its own. `revokeOtherSessions` is
 * on: a password change that leaves old devices signed in is not a change of
 * control. A failed provider call surfaces its own message.
 */
export function AccountSecurityCard() {
	const { t } = useTranslation('employee');
	const router = useRouter();
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');

	const change = useMutation({
		mutationFn: async () => {
			if (newPassword !== confirmPassword) throw new Error(t('account.mismatch'));
			if (newPassword.length < 8) throw new Error(t('account.minHint'));
			const { error } = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: true,
			});
			if (error) throw new Error(error.message ?? 'Could not change the password');
		},
		onSuccess: () => {
			toast.success(t('account.changed'));
			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');
		},
		onError: (error) => toast.error(error instanceof Error ? error.message : ''),
	});

	const signOut = useMutation({
		mutationFn: () => authClient.signOut(),
		onSuccess: () => router.navigate({ to: '/login', search: { redirect: undefined } }),
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className='text-base'>{t('account.title')}</CardTitle>
				<CardDescription>{t('account.subtitle')}</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					className='space-y-4'
					onSubmit={(event) => {
						event.preventDefault();
						change.mutate();
					}}
				>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field className='sm:col-span-2'>
							<FieldLabel>{t('account.currentPassword')}</FieldLabel>
							<PasswordInput
								autoComplete='current-password'
								value={currentPassword}
								onChange={(event) => setCurrentPassword(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>{t('account.newPassword')}</FieldLabel>
							<PasswordInput
								autoComplete='new-password'
								value={newPassword}
								onChange={(event) => setNewPassword(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>{t('account.confirmPassword')}</FieldLabel>
							<PasswordInput
								autoComplete='new-password'
								value={confirmPassword}
								onChange={(event) => setConfirmPassword(event.target.value)}
							/>
						</Field>
					</FieldGroup>
					<p className='text-xs text-muted-foreground'>{t('account.minHint')}</p>
					<p className='text-xs text-muted-foreground'>{t('account.otherDevices')}</p>
					<div className='flex flex-wrap gap-2'>
						<Button type='submit' disabled={change.isPending || !currentPassword || !newPassword}>
							{t('account.password')}
						</Button>
						<Button
							type='button'
							variant='outline'
							onClick={() => signOut.mutate()}
							disabled={signOut.isPending}
						>
							{t('account.signOut')}
						</Button>
					</div>
					<p className='text-xs text-muted-foreground'>{t('account.readOnlyNote')}</p>
				</form>
			</CardContent>
		</Card>
	);
}
