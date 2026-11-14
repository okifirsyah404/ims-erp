import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { hasInternalRole } from '@/lib/internal-role';
import { myOrganizationsQueryOptions } from '@/lib/organization-api';

/**
 * `/` renders the Dashboard only for users with an internal role. Others get
 * an empty page, not a redirect: a redirect to `/` from `/` would loop (see
 * `canOpenPath`).
 */
function DashboardGate() {
	const { data, isPending } = useQuery(myOrganizationsQueryOptions);
	if (isPending) return null;
	const allowed = (data ?? []).some((org) => hasInternalRole(org.role));
	return allowed ? <DashboardPage /> : null;
}

export const Route = createFileRoute('/_authed/')({
	component: DashboardGate,
});
