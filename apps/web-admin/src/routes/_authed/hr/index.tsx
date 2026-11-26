import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/hr` has no page of its own: the Human Resource section opens on the employee list. */
export const Route = createFileRoute('/_authed/hr/')({
	beforeLoad: () => {
		throw redirect({ to: '/hr/employees' });
	},
});
