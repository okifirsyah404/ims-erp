import { LoginForm } from '@/components/form/login-form';
import { z } from 'zod';
import { createFileRoute, useRouter } from '@tanstack/react-router';

/**
 * `redirect` carries the URL the user originally requested (set by the
 * `_authed` guard); after sign-in they are sent straight back to it.
 */
const loginSearchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute('/login/')({
	validateSearch: loginSearchSchema,
	component: LoginPage,
});

function LoginPage() {
	const router = useRouter();
	const search = Route.useSearch();
	return (
		<div className='flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10'>
			<div className='w-full max-w-sm md:max-w-4xl'>
				<LoginForm
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
