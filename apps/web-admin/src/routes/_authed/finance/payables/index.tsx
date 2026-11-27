import { createFileRoute } from '@tanstack/react-router';

import { PayablesPage } from '@/components/finance/payables-page';

/** `/finance/payables` - AP aging + supplier bills (M09 F5). */
export const Route = createFileRoute('/_authed/finance/payables/')({
	component: PayablesPage,
});
