import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/documents` — no page of its own; the registry lives at `/documents/files`. */
export const Route = createFileRoute('/_authed/documents/')({
	beforeLoad: () => {
		throw redirect({ to: '/documents/files' });
	},
});
