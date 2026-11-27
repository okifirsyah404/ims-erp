import { createFileRoute } from '@tanstack/react-router';

import { AccountList } from '@/components/finance/account-list';

/** `/finance/accounts` - chart of accounts (M09 F2). */
export const Route = createFileRoute('/_authed/finance/accounts/')({
	component: AccountList,
});
