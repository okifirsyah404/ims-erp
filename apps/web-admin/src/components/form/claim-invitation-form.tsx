import { cn } from 'cn';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	claimInvitation,
	isUsernameAvailable,
	type TClaimTarget,
} from '@/lib/claim-api';
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

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const PHONE_RE = /^[+0-9()\-\s]+$/;

/**
 * Claim-invitation form: shows the read-only invitee context resolved from
 * the token, then collects username + password + phone (the backend's form
 * 1). A successful claim signs the user in via the response's set-cookie.
 */
export function ClaimInvitationForm({
	className,
	token,
	target,
	onSuccess,
	...props
}: React.ComponentProps<'div'> & {
	token: string;
	/** Read-only context resolved via `GET /invitations/claim/:token`. */
	target: TClaimTarget;
	/** Called after the claim succeeded (session cookie is already set). */
	onSuccess?: (organizationName: string | null) => void;
}) {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [phone, setPhone] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const { t } = useTranslation(['claim', 'common']);

	// Live availability feedback (debounced by the browser's input cadence —
	// the check is cheap and non-enumerating on the backend).
	const [availability, setAvailability] = useState<boolean | null>(null);
	useEffect(() => {
		if (!USERNAME_RE.test(username)) {
			setAvailability(null);
			return;
		}
		let cancelled = false;
		// Availability is derived from an async external check, not render —
		// resolving it inside the (debounced) effect is the synchronization.
		const timer = setTimeout(async () => {
			const result = await isUsernameAvailable(username);
			if (!cancelled) setAvailability(result);
		}, 400);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [username]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		if (username.length < 3 || !USERNAME_RE.test(username)) {
			setError(t('form.usernameInvalid'));
			return;
		}
		if (password.length < 8) {
			setError(t('form.passwordShort'));
			return;
		}
		if (phone.length < 6 || !PHONE_RE.test(phone)) {
			setError(t('form.phoneInvalid'));
			return;
		}
		setPending(true);
		try {
			const result = await claimInvitation(token, {
				username,
				password,
				phone,
			});
			onSuccess?.(result?.organizationName ?? null);
		} catch (claimError) {
			setError(
				claimError instanceof Error
					? claimError.message
					: t('common:error.failed'),
			);
		} finally {
			setPending(false);
		}
	}

	const availabilityMessage =
		availability === null || !USERNAME_RE.test(username)
			? null
			: availability
				? t('form.usernameAvailable')
				: t('form.usernameTaken');

	return (
		<div className={cn('flex flex-col gap-6', className)} {...props}>
			<Card className='overflow-hidden p-0'>
				<CardContent className='p-6 md:p-8'>
					<FieldGroup>
						<div className='flex flex-col items-center gap-2 text-center'>
							<LanguageSwitcher />
							<h1 className='text-2xl font-bold'>{t('form.title')}</h1>
							<p className='text-balance text-muted-foreground'>
								{t('form.description', {
									name: target.name ?? target.email,
									email: target.email,
								})}
							</p>
						</div>
						<form onSubmit={handleSubmit}>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor='claim-username'>
										{t('form.username')}
									</FieldLabel>
									<input
										id='claim-username'
										className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs'
										value={username}
										required
										minLength={3}
										maxLength={30}
										autoComplete='username'
										onChange={(event) => setUsername(event.target.value)}
									/>
									<FieldDescription>{availabilityMessage}</FieldDescription>
								</Field>
								<Field>
									<FieldLabel htmlFor='claim-password'>
										{t('form.password')}
									</FieldLabel>
									<PasswordInput
										id='claim-password'
										value={password}
										required
										minLength={8}
										autoComplete='new-password'
										onChange={(event) => setPassword(event.target.value)}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor='claim-phone'>
										{t('form.phone')}
									</FieldLabel>
									<input
										id='claim-phone'
										type='tel'
										className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs'
										value={phone}
										required
										placeholder='+6281234567890'
										onChange={(event) => setPhone(event.target.value)}
									/>
								</Field>
								{error && <p className='text-sm text-destructive'>{error}</p>}
								<Button type='submit' className='w-full' disabled={pending}>
									{pending ? t('form.claiming') : t('form.submit')}
								</Button>
							</FieldGroup>
						</form>
					</FieldGroup>
				</CardContent>
			</Card>
		</div>
	);
}
