import { createFileRoute } from '@tanstack/react-router';

import { AccountList } from '@/components/finance/account-list';
import { ACCOUNT_TYPES, type TAccountType } from '@/lib/finance-api';

/** Tri-state URL flag (`true` / `false` / absent). */
function toBool(value: unknown): boolean | undefined {
	if (value === true || value === 'true') return true;
	if (value === false || value === 'false') return false;
	return undefined;
}

/** Search params for the chart-of-accounts table (URL-backed filters). */
type TAccountsSearch = {
	page?: number;
	search?: string;
	accountType?: TAccountType;
	isActive?: boolean;
	isPostable?: boolean;
};

/** `/finance/accounts` - chart of accounts (M09 F2). */
export const Route = createFileRoute('/_authed/finance/accounts/')({
	validateSearch: (search: Record<string, unknown>): TAccountsSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		search:
			typeof search.search === 'string' && search.search ? search.search : undefined,
		accountType: ACCOUNT_TYPES.includes(search.accountType as TAccountType)
			? (search.accountType as TAccountType)
			: undefined,
		isActive: toBool(search.isActive),
		isPostable: toBool(search.isPostable),
	}),
	component: AccountList,
});
