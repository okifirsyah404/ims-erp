import { createFileRoute } from '@tanstack/react-router';
import { ChangeEmailForm } from '@/components/account/change-email-form';

export const Route = createFileRoute('/_authed/account/email')({
	component: AccountEmailPage,
});

function AccountEmailPage() {
	return <ChangeEmailForm />;
}
