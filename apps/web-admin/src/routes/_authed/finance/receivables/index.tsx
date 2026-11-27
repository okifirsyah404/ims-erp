import { createFileRoute } from '@tanstack/react-router';

import { ReceivablesPage } from '@/components/finance/receivables-page';

/** `/finance/receivables` - AR aging on demand (M09 F4). */
export const Route = createFileRoute('/_authed/finance/receivables/')({
	component: ReceivablesPage,
});
