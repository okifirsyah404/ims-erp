import { LoginForm } from '@/components/form/login-form';
import { loginErrorKey } from '@/lib/login-error';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	createFileRoute,
	isRedirect,
	redirect,
	useNavigate,
} from '@tanstack/react-router';
import { getSession } from '@/lib/auth-client';
import { resetAndNavigate, safeRedirectPath } from '@/lib/account-switch';

/**
 * `redirect` carries the path the user originally requested (set by the
 * `_authed` guard); after sign-in they are sent straight back to it.
 * `error` is appended by Better Auth when a Google sign-in is refused
 * (ERP-0109: unknown email, pending invitation, deactivated account, no ERP
 * role).
 */
const loginSearchSchema = z.object({
	redirect: z.string().optional(),
	error: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/login/')({
	validateSearch: loginSearchSchema,
	// Inverse of the `_authed` guard: a user who already has a session has
	// no business on the login page. Honors the `redirect` param set by the
	// guard, otherwise goes to the app root.
	beforeLoad: async ({ search }) => {
		try {
			const { data } = await getSession();
			if (data) throw redirect({ href: safeRedirectPath(search.redirect) });
		} catch (error) {
			// A failed session check (e.g. network) must not block the login
			// form — only real redirects are re-thrown.
			if (isRedirect(error)) throw error;
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate({ from: Route.fullPath });
	const search = Route.useSearch();
	const { t } = useTranslation('auth');
	// Read the Google error once; it is cleared from the URL so a reload or a
	// shared link does not repeat it.
	const [initialErrorKey] = useState(() => loginErrorKey(search.error));

	useEffect(() => {
		if (!search.error) return;
		void navigate({
			search: { redirect: search.redirect },
			replace: true,
		});
	}, [search.error, search.redirect, navigate]);

	return (
		<div className='flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10'>
			<div className='w-full max-w-sm md:max-w-4xl'>
				<LoginForm
					redirect={search.redirect}
					initialError={initialErrorKey ? t(initialErrorKey) : null}
					onSuccess={() =>
						// Full page load with an empty cache, so the new account
						// never sees the previous one's cached data or buttons.
						// The path is kept verbatim (same-origin paths only).
						resetAndNavigate(search.redirect ?? '/')
					}
				/>
			</div>
		</div>
	);
}
