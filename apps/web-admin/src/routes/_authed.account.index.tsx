import { createFileRoute } from '@tanstack/react-router';
import { ChangePasswordForm } from '@/components/account/change-password-form';

export const Route = createFileRoute('/_authed/account/')({
	component: AccountPage,
});

function AccountPage() {
	return <ChangePasswordForm />;
}
