import { ResetPasswordForm } from '@/components/form/reset-password-form';
import { z } from 'zod';
import { createFileRoute, useRouter } from '@tanstack/react-router';

/**
 * Better Auth appends the reset token to `redirectTo` as `?token=…`.
 */
const resetPasswordSearchSchema = z.object({
	token: z.string().min(1),
});

export const Route = createFileRoute('/reset-password/')({
	validateSearch: resetPasswordSearchSchema,
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const router = useRouter();
	const { token } = Route.useSearch();
	return (
		<div className='flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10'>
			<div className='w-full max-w-sm'>
				<ResetPasswordForm
					token={token}
					onSuccess={() => router.navigate({ to: '/login' })}
				/>
			</div>
		</div>
	);
}
