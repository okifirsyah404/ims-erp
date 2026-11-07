import { createFileRoute } from '@tanstack/react-router';

import { OpeningBalancePage } from '@/components/finance/opening-balance-page';

/** `/finance/opening-balances` - draft batch + one-shot post (M09 F3). */
export const Route = createFileRoute('/_authed/finance/opening-balances/')({
	component: OpeningBalancePage,
});
