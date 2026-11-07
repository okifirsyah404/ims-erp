import { createFileRoute } from '@tanstack/react-router';

import { ReportsPage } from '@/components/finance/reports-page';

/** `/finance/reports` - P&L / balance sheet / cash flow (M09 F6). */
export const Route = createFileRoute('/_authed/finance/reports/')({
	component: ReportsPage,
});
