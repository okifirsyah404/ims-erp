import { LoginForm } from '@/components/form/login-form';
import { z } from 'zod';
import {
	createFileRoute,
	isRedirect,
	redirect,
	useRouter,
} from '@tanstack/react-router';
import { getSession } from '@/lib/auth-client';

/**
 * `redirect` carries the URL the user originally requested (set by the
 * `_authed` guard); after sign-in they are sent straight back to it.
 */
const loginSearchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute('/login/')({
	validateSearch: loginSearchSchema,
	// Inverse of the `_authed` guard: a user who already has a session has
	// no business on the login page. Honors the `redirect` param (full URL)
	// set by the guard, otherwise goes to the app root.
	beforeLoad: async ({ search }) => {
		try {
			const { data } = await getSession();
			if (data) throw redirect({ href: search.redirect ?? '/' });
		} catch (error) {
			// A failed session check (e.g. network) must not block the login
			// form — only real redirects are re-thrown.
			if (isRedirect(error)) throw error;
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const router = useRouter();
	const search = Route.useSearch();
	return (
		<div className='flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10'>
			<div className='w-full max-w-sm md:max-w-4xl'>
				<LoginForm
					redirect={search.redirect}
					onSuccess={() =>
						// The param is a full URL; history.push is the right tool
						// (navigate would re-run search serialization on it).
						router.history.push(search.redirect ?? '/')
					}
				/>
			</div>
		</div>
	);
}
