import { cn } from 'cn';

import LanguageSwitcher from '@/components/language-switcher';
import { PasswordInput } from '@/components/password-input';
import { authClient } from '@/lib/auth-client';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Email + password login wired to Better Auth (`authClient.signIn.email`).
 * The session cookie is set by the backend response (`credentials: 'include'`
 * on the auth client); on success the user is redirected to the app root.
 */
export function LoginForm({
	className,
	onSuccess,
	...props
}: React.ComponentProps<'div'> & { onSuccess?: () => void }) {
	const [identifier, setIdentifier] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const { t } = useTranslation(['auth', 'common']);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setPending(true);
		try {
			/**
			 * One code path for both identifiers: the backend's
			 * `email-identifier` hook rewrites an email to its username, so
			 * `/sign-in/username` handles both. Unknown emails fail with the
			 * same generic invalid-credentials error as unknown usernames.
			 */
			const { error: signInError } = await authClient.signIn.username({
				username: identifier,
				password,
			});
			if (signInError) {
				// Better Auth's message comes back already localized (the backend
				// runs the i18n plugin with header detection); the fallback is ours.
				setError(signInError.message ?? t('login.invalidCredentials'));
				return;
			}
			onSuccess?.();
		} catch {
			setError(t('common:error.network'));
		} finally {
			setPending(false);
		}
	}

	return (
		<div className={cn('flex flex-col gap-6', className)} {...props}>
			<Card className='overflow-hidden p-0'>
				<CardContent className='grid p-0 md:grid-cols-2'>
					<form className='p-6 md:p-8' onSubmit={handleSubmit}>
						<FieldGroup>
							<div className='flex flex-col items-center gap-2 text-center'>
								<h1 className='text-2xl font-bold'>{t('login.title')}</h1>
								<p className='text-balance text-muted-foreground'>
									{t('login.subtitle')}
								</p>
							</div>
							<Field>
								<FieldLabel htmlFor='identifier'>
									{t('login.identifier')}
								</FieldLabel>
								<Input
									id='identifier'
									type='text'
									placeholder={t('login.identifierPlaceholder')}
									required
									value={identifier}
									onChange={(e) => setIdentifier(e.target.value)}
									autoComplete='username'
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='password'>
									{t('login.password')}
								</FieldLabel>
								<PasswordInput
									id='password'
									required
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									autoComplete='current-password'
								/>
								<div className='flex justify-end'>
									<a
										href='/forgot-password'
										className='hover:text-foreground ml-auto text-sm underline-offset-4 hover:underline'
									>
										{t('login.forgotPassword')}
									</a>
								</div>
							</Field>
							{error && (
								<p
									className='text-destructive text-center text-sm'
									role='alert'
								>
									{error}
								</p>
							)}
							<Field>
								<Button type='submit' className='w-full' disabled={pending}>
									{pending ? t('login.submitting') : t('login.submit')}
								</Button>
							</Field>
						</FieldGroup>
					</form>
					<div className='relative hidden bg-muted md:block'>
						<img
							src='/hero.png'
							alt='Entragate'
							className='absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale'
						/>
					</div>
				</CardContent>
			</Card>
			{/* Logged-out users never see the sidebar switcher, so the auth
			    screens carry their own. */}
			<LanguageSwitcher className='mx-auto flex justify-center gap-1' />
		</div>
	);
}
