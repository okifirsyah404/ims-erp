import { createFileRoute } from '@tanstack/react-router';

import { AccountList } from '@/components/finance/account-list';

/** Search params for the account list. */
type TAccountsSearch = { page?: number };

/** `/finance/accounts` - chart of accounts (M09 F2). */
export const Route = createFileRoute('/_authed/finance/accounts/')({
	validateSearch: (search: Record<string, unknown>): TAccountsSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: AccountList,
});
