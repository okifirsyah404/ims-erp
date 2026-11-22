import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { authClient, requestPasswordReset } from '@/lib/auth-client';
import { hasCredential, linkedAccountsQueryOptions } from '@/lib/account-api';
import { selfUserQueryOptions } from '@/lib/user-api';
import { toast } from '@/components/toast';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
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
import { Skeleton } from '@ims-erp/ui/components/skeleton';

/**
 * Password card on `/accounts`. Runs Better Auth's `changePassword` — the
 * current session is kept, other sessions are revoked when the checkbox is on.
 *
 * @remarks
 * A user who only ever signed in with Google has no `credential` account, so
 * `changePassword` cannot succeed. That user gets a password-setup link
 * instead: Better Auth's reset flow creates the credential account when it
 * is missing (`resetCredentialPassword`, ERP-0109).
 */
export function PasswordCard({ id }: { id: string }) {
	const { t } = useTranslation(['account', 'common']);
	const accountsQuery = useQuery(linkedAccountsQueryOptions);

	return (
		<section id={id} className='scroll-mt-4'>
			{accountsQuery.isPending ? (
				<Card size='sm'>
					<CardHeader>
						<CardTitle>{t('password.title')}</CardTitle>
					</CardHeader>
					<CardContent className='flex flex-col gap-3'>
						<Skeleton className='h-8 w-full' />
						<Skeleton className='h-8 w-full' />
					</CardContent>
				</Card>
			) : accountsQuery.data && !hasCredential(accountsQuery.data) ? (
				<PasswordSetupCard />
			) : (
				// On a load error, fall back to the form: the server still decides.
				<ChangePasswordForm />
			)}
		</section>
	);
}

function PasswordSetupCard() {
	const { data: user } = useSuspenseQuery(selfUserQueryOptions);
	const { t } = useTranslation(['account', 'common']);
	const [pending, setPending] = useState(false);
	const [sent, setSent] = useState(false);

	async function sendSetupLink() {
		setPending(true);
		try {
			const { error } = await requestPasswordReset({
				email: user.email,
				redirectTo: `${window.location.origin}/reset-password`,
			});
			if (error) {
				toast.error(error.message ?? t('common:error.failed'));
				return;
			}
			setSent(true);
			toast.success(t('password.setupSent', { email: user.email }));
		} catch {
			toast.error(t('common:error.network'));
		} finally {
			setPending(false);
		}
	}

	return (
		<Card size='sm'>
			<CardHeader>
				<CardTitle>{t('password.title')}</CardTitle>
				<CardDescription>
					{sent ? t('password.setupSent', { email: user.email }) : t('password.none')}
				</CardDescription>
			</CardHeader>
			<CardFooter className='justify-end'>
				<Button
					type='button'
					size='sm'
					variant='outline'
					disabled={pending || sent}
					onClick={sendSetupLink}
				>
					{t('password.setupSend')}
				</Button>
			</CardFooter>
		</Card>
	);
}

function ChangePasswordForm() {
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [revokeOthers, setRevokeOthers] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const { t } = useTranslation(['account', 'common']);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		if (newPassword !== confirm) {
			setError(t('password.mismatch'));
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
				setError(changeError.message ?? t('password.failed'));
				return;
			}
			toast.success(t('password.changed'));
			setCurrentPassword('');
			setNewPassword('');
			setConfirm('');
		} catch {
			setError(t('common:error.network'));
		} finally {
			setPending(false);
		}
	}

	return (
		<form onSubmit={handleSubmit}>
			<Card size='sm'>
				<CardHeader>
					<CardTitle>{t('password.title')}</CardTitle>
					<CardDescription>{t('password.description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup className='gap-4'>
						<Field>
							<FieldLabel htmlFor='current-password'>
								{t('password.current')}
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
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='new-password'>{t('password.new')}</FieldLabel>
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
								<FieldDescription>{t('password.minHint')}</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor='confirm-password'>
									{t('password.confirm')}
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
						</div>
						<Field orientation='horizontal'>
							<Checkbox
								id='revoke-others'
								checked={revokeOthers}
								onCheckedChange={(checked) => setRevokeOthers(checked === true)}
							/>
							<FieldLabel htmlFor='revoke-others' className='font-normal'>
								{t('password.revokeOthers')}
							</FieldLabel>
						</Field>
						{error && (
							<p className='text-sm text-destructive' role='alert'>
								{error}
							</p>
						)}
					</FieldGroup>
				</CardContent>
				<CardFooter className='justify-end'>
					<Button type='submit' size='sm' disabled={pending}>
						{pending ? t('password.submitting') : t('password.submit')}
					</Button>
				</CardFooter>
			</Card>
		</form>
	);
}
