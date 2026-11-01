import { ForgotPasswordForm } from '@/components/form/forgot-password-form';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/forgot-password/')({
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	return (
		<div className='flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10'>
			<div className='w-full max-w-sm'>
				<ForgotPasswordForm />
			</div>
		</div>
	);
}
