import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/hr` — the HR area opens on the employee list (M08). */
export const Route = createFileRoute('/_authed/hr/')({
	beforeLoad: () => {
		throw redirect({ to: '/hr/employees' });
	},
});
