import { createFileRoute } from '@tanstack/react-router';

import { ReconciliationPage } from '@/components/finance/reconciliation-page';

/** `/finance/reconciliation` - bank reconciliation workflow (M09 F6). */
export const Route = createFileRoute('/_authed/finance/reconciliation/')({
	component: ReconciliationPage,
});
