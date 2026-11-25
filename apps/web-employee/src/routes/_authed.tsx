import { createFileRoute, isRedirect, Outlet, redirect } from '@tanstack/react-router';
import MainLayout from '@/components/layout/main-layout';
import { canEnterPortal } from '@/lib/portal-guard';
import { getSession } from '@/lib/auth-client';
import { queryClient } from '@/lib/query-client';

/**
 * Authenticated shell.
 *
 * @remarks
 * 1. No session -> `/login` (the original URL travels in `redirect`).
 * 2. Session, but no employee record in any organization, or an excluded app
 *    role (`admin`, `investor`, `customer`) -> the session is revoked and
 *    `/login?error=portal-denied` explains why. Keeping the cookie would leave
 *    the user logged into an app that can never serve them.
 */
export const Route = createFileRoute('/_authed')({
	beforeLoad: async ({ location }) => {
		try {
			const { data } = await getSession();
			if (!data) {
				throw redirect({ to: '/login', search: { redirect: location.href } });
			}
			const entry = await canEnterPortal(data, queryClient);
			if (entry.kind === 'denied') {
				throw redirect({ to: '/login', search: { error: 'portal-denied', redirect: undefined } });
			}
			return { session: data };
		} catch (error) {
			if (isRedirect(error)) throw error;
			throw redirect({ to: '/login', search: { redirect: location.href } });
		}
	},
	component: () => (
		<MainLayout>
			<Outlet />
		</MainLayout>
	),
});
