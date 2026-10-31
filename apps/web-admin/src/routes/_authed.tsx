import { createFileRoute, isRedirect, redirect, Outlet } from '@tanstack/react-router';
import MainLayout from '@/components/layout/main-layout';
import { getSession } from '@/lib/auth-client';

/**
 * Authenticated shell: redirects to /login when no valid session cookie is
 * present. Session resolution goes through Better Auth (`getSession`), so
 * the backend remains authoritative. The original URL is preserved in the
 * `redirect` search param so login can return the user to their target
 * (deep links survive session expiry).
 */
export const Route = createFileRoute('/_authed')({
	beforeLoad: async ({ location }) => {
		try {
			const { data } = await getSession();
			if (!data) {
				throw redirect({ to: '/login', search: { redirect: location.href } });
			}
			return { session: data };
		} catch (error) {
			// Re-throw real redirects; network/other failures also go to login.
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
