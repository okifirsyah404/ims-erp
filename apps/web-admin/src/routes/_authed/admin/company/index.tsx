import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/admin/company` moved to `/settings/company` (Settings section). */
export const Route = createFileRoute('/_authed/admin/company/')({
	beforeLoad: () => {
		throw redirect({ to: '/settings/company' });
	},
});
