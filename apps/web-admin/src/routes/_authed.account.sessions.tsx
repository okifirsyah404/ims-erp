import { createFileRoute } from '@tanstack/react-router';
import { SessionsTable } from '@/components/account/sessions-table';

export const Route = createFileRoute('/_authed/account/sessions')({
	component: AccountSessionsPage,
});

function AccountSessionsPage() {
	return <SessionsTable />;
}
