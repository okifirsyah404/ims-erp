import { ClaimInvitationForm } from '@/components/form/claim-invitation-form';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { resolveClaimToken, type TClaimTarget } from '@/lib/claim-api';

/**
 * Public invitation-claim page (`/invite/:token`): resolves the token from
 * the invitation email, shows the invitee context, and hosts the claim form.
 * Invalid/expired tokens render a friendly error with a way to sign in.
 */
export const Route = createFileRoute('/invite/$token')({
	component: InviteClaimPage,
});

function InviteClaimPage() {
	const { token } = Route.useParams();
	const navigate = useNavigate();
	const { t } = useTranslation(['claim', 'common']);
	const [target, setTarget] = useState<TClaimTarget | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		resolveClaimToken(token)
			.then((resolved) => {
				if (!cancelled) setTarget(resolved);
			})
			.catch((resolveError: unknown) => {
				if (!cancelled) {
					setError(
						resolveError instanceof Error
							? resolveError.message
							: t('invalid'),
					);
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [token, t]);

	if (loading) {
		return (
			<div className='flex min-h-svh items-center justify-center bg-muted p-6'>
				<p className='text-muted-foreground'>{t('common:state.loading')}</p>
			</div>
		);
	}

	if (error || !target) {
		return (
			<div className='flex min-h-svh flex-col items-center justify-center gap-4 bg-muted p-6 text-center'>
				<h1 className='text-xl font-semibold'>{t('invalidTitle')}</h1>
				<p className='max-w-sm text-sm text-muted-foreground'>
					{error ?? t('invalid')}
				</p>
				<Link
					to='/login'
					className='inline-flex h-9 items-center justify-center rounded-md border border-input bg-transparent px-4 text-sm font-medium shadow-xs hover:bg-accent'
				>
					{t('backToLogin')}
				</Link>
			</div>
		);
	}

	return (
		<div className='flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10'>
			<div className='w-full max-w-sm'>
				<ClaimInvitationForm
					token={token}
					target={target}
					onSuccess={() => {
						// The claim response set the session cookie; a full reload
						// picks it up and the authed layout takes over.
						void navigate({ to: '/' });
					}}
				/>
			</div>
		</div>
	);
}
