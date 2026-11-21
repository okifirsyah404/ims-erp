import { cn } from 'cn';

import LanguageSwitcher from '@/components/language-switcher';
import { PasswordInput } from '@/components/password-input';
import { GoogleIcon } from '@/components/icons/google-icon';
import { authClient } from '@/lib/auth-client';
import { loginErrorCallbackUrl, sameOriginUrl } from '@/lib/login-error';
import { companyBrandingQueryOptions } from '@/lib/company-api';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Login wired to Better Auth. Credentials go through `signIn.email` when the
 * identifier contains `@`, otherwise `signIn.username`; Google goes through `signIn.social`,
 * which redirects to Google and back to the app (Better Auth navigates
 * itself — `onSuccess` is credentials-only).
 */
export function LoginForm({
	className,
	onSuccess,
	redirect,
	initialError,
	...props
}: React.ComponentProps<'div'> & {
	onSuccess?: () => void;
	/** Post-login destination, also used as the Google OAuth callback URL. */
	redirect?: string;
	/** Message for a failed Google round trip (`/login?error=…`). */
	initialError?: string | null;
}) {
	const [identifier, setIdentifier] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(initialError ?? null);
	const [pending, setPending] = useState(false);
	const [googlePending, setGooglePending] = useState(false);
	const { t } = useTranslation(['auth', 'common']);
	// Public endpoint (no session): the company display name and the onboarding
	// image. Falls back to the bundled hero and the env app name while absent.
	const { data: branding } = useQuery(companyBrandingQueryOptions());
	const appName = branding?.name ?? 'Entragate';

	async function handleGoogleSignIn() {
		setError(null);
		setGooglePending(true);
		try {
			// Absolute URLs: the auth server runs on another origin, so a relative
			// callback would land on the API host. Failures (unknown Google email,
			// pending invitation, deactivated account, no ERP role) come back to
			// `/login?error=<code>`; `redirect` is kept for the next attempt.
			const origin = window.location.origin;
			const { error: socialError } = await authClient.signIn.social({
				provider: 'google',
				callbackURL: sameOriginUrl(redirect, origin),
				errorCallbackURL: loginErrorCallbackUrl(origin, redirect),
			});
			if (socialError) setError(socialError.message ?? t('login.googleFailed'));
		} catch {
			setError(t('common:error.network'));
		} finally {
			// Either a redirect has started (page unloads) or an error is
			// shown; either way the button must be usable again.
			setGooglePending(false);
		}
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setPending(true);
		try {
			/**
			 * An email goes to `signIn.email`. Routing it through
			 * `/sign-in/username` fails for accounts created by sign-up, which
			 * have no `username` (the `email-identifier` hook falls back to the
			 * raw email and the username plugin rejects it with 422). Unknown
			 * emails and wrong passwords return the same generic error.
			 */
			const isEmail = identifier.includes('@');
			const { error: signInError } = isEmail
				? await authClient.signIn.email({ email: identifier, password })
				: await authClient.signIn.username({ username: identifier, password });
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
									{t('login.subtitle', { app: appName })}
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
						<div className='flex items-center gap-3 text-xs text-muted-foreground'>
							<div className='h-px flex-1 bg-border' />
							<span>{t('login.orContinueWith')}</span>
							<div className='h-px flex-1 bg-border' />
						</div>
						<Field>
							<Button
								type='button'
								variant='outline'
								className='w-full'
								disabled={googlePending}
								onClick={handleGoogleSignIn}
							>
								<GoogleIcon className='size-4' />
								{t('login.googleSignIn')}
							</Button>
						</Field>
					</FieldGroup>
					</form>
					<div className='relative hidden bg-muted md:block'>
						<img
							src={branding?.onboardingUrl ?? '/hero.png'}
							alt={appName}
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
