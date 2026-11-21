import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from '@/components/toast';
import { USERNAME_PATTERN } from '@/lib/account-search';
import { isUsernameAvailable } from '@/lib/claim-api';
import {
	invalidateSelfUser,
	selfUserQueryOptions,
	updateSelfUser,
} from '@/lib/user-api';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
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
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from '@ims-erp/ui/components/input-group';

type TAvailability = 'checking' | 'available' | 'taken' | null;

/**
 * Username card on `/accounts` (ERP-0107; moved off the profile form). Live
 * availability uses the public `/username-availability` check the claim form
 * already relies on; saving goes through `PATCH /users/me`, where Better
 * Auth's username plugin stays the authority (normalisation, uniqueness).
 */
export function UsernameCard({ id }: { id: string }) {
	const { data: user } = useSuspenseQuery(selfUserQueryOptions);
	const { t } = useTranslation(['account', 'common']);
	const current = user.displayUsername ?? user.username ?? '';

	const [username, setUsername] = useState(current);
	// Last finished availability check; `null` result = check failed (unknown).
	const [checked, setChecked] = useState<{
		username: string;
		available: boolean | null;
	} | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const valid = USERNAME_PATTERN.test(username);
	// The stored username is lowercased; the user's own handle is never "taken".
	const unchanged = username.toLowerCase() === (user.username ?? '').toLowerCase();
	const needsCheck = valid && !unchanged;

	// Derived, not stored: a stale result for another value reads as "checking".
	let availability: TAvailability = null;
	if (needsCheck) {
		if (checked?.username !== username) availability = 'checking';
		else if (checked.available !== null)
			availability = checked.available ? 'available' : 'taken';
	}

	useEffect(() => {
		if (!needsCheck) return;
		let cancelled = false;
		// Debounced external check; the result is synchronised back into state.
		const timer = setTimeout(async () => {
			const available = await isUsernameAvailable(username);
			if (!cancelled) setChecked({ username, available });
		}, 400);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [username, needsCheck]);

	const canSubmit =
		valid &&
		username !== current &&
		availability !== 'taken' &&
		availability !== 'checking' &&
		!pending;

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canSubmit) return;
		setError(null);
		setPending(true);
		try {
			await updateSelfUser({ username });
			await invalidateSelfUser();
			toast.success(t('username.saved'));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setPending(false);
		}
	}

	const invalid = username.length > 0 && !valid;

	return (
		<form id={id} onSubmit={handleSubmit} className='scroll-mt-4'>
			<Card size='sm'>
				<CardHeader>
					<CardTitle>{t('username.title')}</CardTitle>
					<CardDescription>{t('username.description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<Field data-invalid={invalid || availability === 'taken'}>
						<FieldLabel htmlFor='account-username' className='sr-only'>
							{t('username.title')}
						</FieldLabel>
						<InputGroup>
							<InputGroupAddon>
								<InputGroupText>@</InputGroupText>
							</InputGroupAddon>
							<InputGroupInput
								id='account-username'
								value={username}
								maxLength={30}
								autoComplete='username'
								disabled={pending}
								aria-invalid={invalid || availability === 'taken'}
								onChange={(event) => setUsername(event.target.value.trim())}
							/>
							{availability && (
								<InputGroupAddon align='inline-end'>
									{availability === 'checking' ? (
										<Loader2 className='animate-spin' />
									) : availability === 'available' ? (
										<Check className='text-emerald-600' />
									) : (
										<X className='text-destructive' />
									)}
								</InputGroupAddon>
							)}
						</InputGroup>
						<FieldDescription aria-live='polite'>
							{invalid
								? t('username.invalid')
								: availability === 'checking'
									? t('username.checking')
									: availability === 'available'
										? t('username.available')
										: availability === 'taken'
											? t('username.taken')
											: t('username.hint')}
						</FieldDescription>
						{error && (
							<p className='text-sm text-destructive' role='alert'>
								{error}
							</p>
						)}
					</Field>
				</CardContent>
				<CardFooter className='justify-end'>
					<Button type='submit' size='sm' disabled={!canSubmit}>
						{pending ? t('form.saving') : t('username.submit')}
					</Button>
				</CardFooter>
			</Card>
		</form>
	);
}
