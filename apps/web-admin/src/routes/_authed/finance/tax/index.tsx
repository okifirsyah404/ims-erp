import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * `/finance/tax` - the tax module entry. Redirects to the period recap, the
 * canonical landing page behind the sidebar's "Tax Recap" item; the recap's
 * year/month live on that one URL so there is exactly one active period.
 */
export const Route = createFileRoute('/_authed/finance/tax/')({
	beforeLoad: () => {
		throw redirect({ to: '/finance/tax/recap' });
	},
});
