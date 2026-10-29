import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getSession } from '@/lib/auth-client';

/**
 * Authenticated shell: redirects to /login when no valid session cookie is
 * present. Session resolution goes through Better Auth (`getSession`), so
 * the backend remains authoritative.
 */
export const Route = createFileRoute('/_authed')({
	beforeLoad: async () => {
		const { data } = await getSession();
		if (!data) {
			throw redirect({ to: '/login' });
		}
		return { session: data };
	},
	component: Outlet,
});
