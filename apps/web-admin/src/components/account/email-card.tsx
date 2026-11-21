import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, MailWarning } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { toast } from '@/components/toast';
import {
	accountsCallbackUrl,
	type TVerificationOutcome,
} from '@/lib/account-search';
import { selfUserQueryOptions } from '@/lib/user-api';
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@ims-erp/ui/components/alert';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Field,
	FieldDescription,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';

/** Client-side pause between verification emails (Better Auth rate-limits too). */
const RESEND_COOLDOWN_SECONDS = 60;

/** Seconds left until `until` (epoch ms), ticking once a second while > 0. */
function useCountdown(until: number | null): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (until === null || until <= Date.now()) return;
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [until]);
	return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
}

/**
 * Email card on `/accounts` (ERP-0107): current address and verification
 * state, "send verification email" for an unverified address, the result of
 * an opened verification link, and the change-email form.
 *
 * @remarks
 * Every link Better Auth mails returns to `/accounts?section=email&verified=1`
 * (absolute: the auth server is on another origin). A bad link comes back to
 * the same URL with `error` appended; the page parses it into `outcome`.
 * Changing the address only mails the new inbox — the stored email changes
 * when that link is opened (no confirmation on the old address, owner
 * decision 2026-11-21).
 */
export function EmailCard({
	id,
	outcome,
}: {
	id: string;
	outcome: TVerificationOutcome | null;
}) {
	const { data: user } = useSuspenseQuery(selfUserQueryOptions);
	const { t } = useTranslation(['account', 'common']);

	const [newEmail, setNewEmail] = useState('');
	const [pendingEmail, setPendingEmail] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [changing, setChanging] = useState(false);
	const [sending, setSending] = useState(false);
	const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
	const secondsLeft = useCountdown(cooldownUntil);

	const callbackURL = accountsCallbackUrl(window.location.origin, 'email', {
		verified: '1',
	});
	const sameAsCurrent =
		newEmail.trim().toLowerCase() === user.email.toLowerCase();

	async function sendVerification() {
		setSending(true);
		try {
			const { error: sendError } = await authClient.sendVerificationEmail({
				email: user.email,
				callbackURL,
			});
			if (sendError) {
				toast.error(sendError.message ?? t('common:error.failed'));
				return;
			}
			setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
			toast.success(t('email.verificationSent', { email: user.email }));
		} catch {
			toast.error(t('common:error.network'));
		} finally {
			setSending(false);
		}
	}

	async function handleChange(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		if (sameAsCurrent) {
			setError(t('email.sameAsCurrent'));
			return;
		}
		setChanging(true);
		try {
			const target = newEmail.trim();
			const { error: changeError } = await authClient.changeEmail({
				newEmail: target,
				callbackURL,
			});
			if (changeError) {
				setError(changeError.message ?? t('email.failed'));
				return;
			}
			setPendingEmail(target);
			setNewEmail('');
			toast.success(t('email.sent'));
		} catch {
			setError(t('common:error.network'));
		} finally {
			setChanging(false);
		}
	}

	return (
		<form id={id} onSubmit={handleChange} className='scroll-mt-4'>
			<Card size='sm'>
				<CardHeader>
					<CardTitle>{t('email.title')}</CardTitle>
					<CardDescription>{t('email.description')}</CardDescription>
					<CardAction>
						<Badge variant={user.emailVerified ? 'secondary' : 'outline'}>
							{user.emailVerified ? t('email.verified') : t('email.unverified')}
						</Badge>
					</CardAction>
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					{outcome === 'verified' && (
						<Alert>
							<CircleCheck className='text-emerald-600' />
							<AlertTitle>{t('email.verifiedTitle')}</AlertTitle>
							<AlertDescription>{t('email.verifiedBody')}</AlertDescription>
						</Alert>
					)}
					{(outcome === 'expired' || outcome === 'invalid') && (
						<Alert variant='destructive'>
							<CircleAlert />
							<AlertTitle>{t('email.linkFailedTitle')}</AlertTitle>
							<AlertDescription>
								{outcome === 'expired' ? t('email.linkExpired') : t('email.linkInvalid')}
							</AlertDescription>
						</Alert>
					)}

					<Field>
						<FieldLabel htmlFor='current-email'>{t('email.current')}</FieldLabel>
						<Input id='current-email' value={user.email} readOnly />
					</Field>

					{!user.emailVerified && (
						<Alert>
							<MailWarning />
							<AlertTitle>{t('email.unverifiedTitle')}</AlertTitle>
							<AlertDescription className='flex flex-col items-start gap-2'>
								<span>{t('email.unverifiedBody')}</span>
								<Button
									type='button'
									size='sm'
									variant='outline'
									disabled={sending || secondsLeft > 0}
									onClick={sendVerification}
								>
									{secondsLeft > 0
										? t('email.resendIn', { seconds: secondsLeft })
										: t('email.sendVerification')}
								</Button>
							</AlertDescription>
						</Alert>
					)}

					<Field data-invalid={Boolean(error)}>
						<FieldLabel htmlFor='new-email'>{t('email.new')}</FieldLabel>
						<Input
							id='new-email'
							type='email'
							required
							value={newEmail}
							disabled={changing}
							autoComplete='email'
							aria-invalid={Boolean(error)}
							onChange={(event) => setNewEmail(event.target.value)}
						/>
						<FieldDescription>
							{pendingEmail
								? t('email.pending', { email: pendingEmail })
								: t('email.verificationHint')}
						</FieldDescription>
						{error && (
							<p className='text-sm text-destructive' role='alert'>
								{error}
							</p>
						)}
					</Field>
				</CardContent>
				<CardFooter className='justify-end'>
					<Button
						type='submit'
						size='sm'
						disabled={changing || !newEmail.trim() || sameAsCurrent}
					>
						{changing ? t('email.submitting') : t('email.submit')}
					</Button>
				</CardFooter>
			</Card>
		</form>
	);
}
