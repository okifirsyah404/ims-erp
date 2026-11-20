import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { PageSkeleton } from '@/components/page-skeleton';
import { useIsAppAdmin } from '@/lib/use-is-app-admin';

export const Route = createFileRoute('/_authed/admin')({
	component: AdminLayout,
});

/**
 * Guards the `/admin/*` surface for application administrators.
 *
 * @remarks
 * Renders an in-place 403 rather than redirecting: a link sent to an
 * organization admin should say why it does not open, not silently bounce
 * them somewhere else. UX only — the backend refuses these endpoints on its
 * own, and an organization admin's own members/invitations live under
 * `/organizations/:id`.
 */
function AdminLayout() {
	const { isAppAdmin, isPending } = useIsAppAdmin();
	const navigate = useNavigate();
	const { t } = useTranslation(['admin', 'common']);

	// The session is already resolved by `_authed`; this avoids flashing the
	// 403 while the client-side session query settles.
	if (isPending) return <PageSkeleton />;

	if (!isAppAdmin) {
		return (
			<Card className='mx-auto max-w-lg'>
				<CardContent className='flex flex-col items-center gap-3 py-10 text-center'>
					<h1 className='text-lg font-semibold'>{t('accessDenied.title')}</h1>
					<p className='text-sm text-muted-foreground'>
						{t('accessDenied.description')}
					</p>
					<Button variant='outline' onClick={() => void navigate({ to: '/' })}>
						{t('accessDenied.back')}
					</Button>
				</CardContent>
			</Card>
		);
	}

	return <Outlet />;
}
