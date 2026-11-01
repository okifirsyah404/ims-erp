import { cn } from 'cn';

import { useState } from 'react';
import { requestPasswordReset } from '@/lib/auth-client';
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
				setError(forgetError.message ?? 'Something went wrong');
				return;
			}
			setSent(true);
		} catch {
			setError(
				'Cannot reach the server. Check your connection and try again.',
			);
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
							<h1 className='text-2xl font-bold'>Forgot your password?</h1>
							<p className='text-balance text-muted-foreground'>
								Enter your email and we'll send you a reset link
							</p>
						</div>
						{sent ? (
							<FieldDescription className='text-center'>
								If an account exists for that email, a password reset link has
								been sent. Check your inbox.
							</FieldDescription>
						) : (
							<form onSubmit={handleSubmit}>
								<FieldGroup>
									<Field>
										<FieldLabel htmlFor='email'>Email</FieldLabel>
										<Input
											id='email'
											type='email'
											placeholder='m@example.com'
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
											{pending ? 'Sending…' : 'Send reset link'}
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
								Back to login
							</a>
						</FieldDescription>
					</FieldGroup>
				</CardContent>
			</Card>
		</div>
	);
}
