import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/admin/code-numbers` moved to `/settings/code-numbers` (Settings section). */
export const Route = createFileRoute('/_authed/admin/code-numbers/')({
	beforeLoad: () => {
		throw redirect({ to: '/settings/code-numbers' });
	},
});
