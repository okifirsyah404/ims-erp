import { cn } from 'cn';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { requestPasswordReset } from '@/lib/auth-client';
import LanguageSwitcher from '@/components/language-switcher';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';

/**
 * Forgot-password form: asks for the account email and calls
 * `authClient.forgetPassword`. Always shows a generic success message so
 * the endpoint can't be used to enumerate registered emails.
 */
export function ForgotPasswordForm({
	className,
	...props
}: React.ComponentProps<'div'>) {
	const [email, setEmail] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [sent, setSent] = useState(false);
	const { t } = useTranslation(['auth', 'common']);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setPending(true);
		try {
			const { error: forgetError } = await requestPasswordReset({
				email,
				/**
				 * Better Auth appends the reset token to this URL as `?token=…`
				 * when building the link passed to `sendResetPassword`.
				 */
				redirectTo: `${window.location.origin}/reset-password`,
			});
			if (forgetError) {
				setError(forgetError.message ?? t('common:error.generic'));
				return;
			}
			setSent(true);
		} catch {
			setError(t('common:error.network'));
		} finally {
			setPending(false);
		}
	}

	return (
		<div className={cn('flex flex-col gap-6', className)} {...props}>
			<Card className='overflow-hidden p-0'>
				<CardContent className='p-6 md:p-8'>
					<FieldGroup>
						<div className='flex flex-col items-center gap-2 text-center'>
							<h1 className='text-2xl font-bold'>{t('forgot.title')}</h1>
							<p className='text-balance text-muted-foreground'>
								{t('forgot.subtitle')}
							</p>
						</div>
						{sent ? (
							<FieldDescription className='text-center'>
								{t('forgot.sent')}
							</FieldDescription>
						) : (
							<form onSubmit={handleSubmit}>
								<FieldGroup>
									<Field>
										<FieldLabel htmlFor='email'>{t('login.email')}</FieldLabel>
										<Input
											id='email'
											type='email'
											placeholder={t('login.emailPlaceholder')}
											required
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											autoComplete='email'
										/>
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
											{pending ? t('forgot.submitting') : t('forgot.submit')}
										</Button>
									</Field>
								</FieldGroup>
							</form>
						)}
						<FieldDescription className='text-center'>
							<a
								href='/login'
								className='underline underline-offset-4 hover:text-foreground'
							>
								{t('forgot.backToLogin')}
							</a>
						</FieldDescription>
					</FieldGroup>
				</CardContent>
			</Card>
			<LanguageSwitcher className='mx-auto flex justify-center gap-1' />
		</div>
	);
}
