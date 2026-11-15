import { createFileRoute } from '@tanstack/react-router';

import { ReportsPage } from '@/components/finance/reports-page';

/**
 * `/reports` - the M12 entry point. Same component as `/finance/reports`: one
 * implementation, two URLs, so the finance menu and the reports section cannot
 * drift apart.
 */
export const Route = createFileRoute('/_authed/reports/')({
	component: ReportsPage,
});
