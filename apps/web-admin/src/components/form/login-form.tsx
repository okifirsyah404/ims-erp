import { cn } from 'cn';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import {
	Field,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';

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
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setPending(true);
		try {
			const { error: signInError } = await authClient.signIn.email({
				email,
				password,
			});
			if (signInError) {
				setError(signInError.message ?? 'Invalid email or password');
				return;
			}
			onSuccess?.();
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
				<CardContent className='grid p-0 md:grid-cols-2'>
					<form className='p-6 md:p-8' onSubmit={handleSubmit}>
						<FieldGroup>
							<div className='flex flex-col items-center gap-2 text-center'>
								<h1 className='text-2xl font-bold'>Welcome back</h1>
								<p className='text-balance text-muted-foreground'>
									Login to your Entragate ERP account
								</p>
							</div>
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
							<Field>
								<FieldLabel htmlFor='password'>Password</FieldLabel>
								<div className='flex justify-end'>
									<a
										href='/forgot-password'
										className='hover:text-foreground ml-auto text-sm underline-offset-4 hover:underline'
									>
										Forgot your password?
									</a>
								</div>
								<Input
									id='password'
									type='password'
									required
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									autoComplete='current-password'
								/>
							</Field>
							{error && (
								<p className='text-destructive text-center text-sm' role='alert'>
									{error}
								</p>
							)}
							<Field>
								<Button type='submit' className='w-full' disabled={pending}>
									{pending ? 'Signing in…' : 'Login'}
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
		</div>
	);
}
