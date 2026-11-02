import { cn } from 'cn';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resetPassword } from '@/lib/auth-client';
import LanguageSwitcher from '@/components/language-switcher';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { PasswordInput } from '@/components/password-input';

/**
 * Reset-password form: takes the new password (+ confirm) and the token from
 * the reset link's `?token=` search param, then calls `authClient.resetPassword`.
 * Invalid/expired tokens surface an error with a way back to /forgot-password.
 */
export function ResetPasswordForm({
	className,
	token,
	onSuccess,
	...props
}: React.ComponentProps<'div'> & {
	token: string;
	/** Called after the password was successfully changed. */
	onSuccess?: () => void;
}) {
	const [password, setPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const { t } = useTranslation(['auth', 'common']);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		if (password !== confirm) {
			setError(t('reset.mismatch'));
			return;
		}
		setPending(true);
		try {
			const { error: resetError } = await resetPassword({
				newPassword: password,
				token,
			});
			if (resetError) {
				setError(resetError.message ?? t('reset.invalidLink'));
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
				<CardContent className='p-6 md:p-8'>
					<FieldGroup>
						<div className='flex flex-col items-center gap-2 text-center'>
							<h1 className='text-2xl font-bold'>{t('reset.title')}</h1>
							<p className='text-balance text-muted-foreground'>
								{t('reset.subtitle')}
							</p>
						</div>
						<form onSubmit={handleSubmit}>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor='password'>
										{t('reset.newPassword')}
									</FieldLabel>
									<PasswordInput
										id='password'
										required
										minLength={8}
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										autoComplete='new-password'
									/>
									<FieldDescription>{t('reset.passwordHint')}</FieldDescription>
								</Field>
								<Field>
									<FieldLabel htmlFor='confirm'>
										{t('reset.confirmPassword')}
									</FieldLabel>
									<PasswordInput
										id='confirm'
										required
										value={confirm}
										onChange={(e) => setConfirm(e.target.value)}
										autoComplete='new-password'
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
										{pending ? t('reset.submitting') : t('reset.submit')}
									</Button>
								</Field>
							</FieldGroup>
						</form>
						<FieldDescription className='text-center'>
							<a
								href='/forgot-password'
								className='underline underline-offset-4 hover:text-foreground'
							>
								{t('reset.requestNewLink')}
							</a>
						</FieldDescription>
					</FieldGroup>
				</CardContent>
			</Card>
			<LanguageSwitcher className='mx-auto flex justify-center gap-1' />
		</div>
	);
}
