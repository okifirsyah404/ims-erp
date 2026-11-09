import { createFileRoute } from '@tanstack/react-router';

import { CashBankPage } from '@/components/finance/cash-bank-page';

/** Search params for the movement list. */
type TCashBankSearch = { page?: number };

/** `/finance/cash-bank` - cash/bank accounts + movements (M09 F3). */
export const Route = createFileRoute('/_authed/finance/cash-bank/')({
	validateSearch: (search: Record<string, unknown>): TCashBankSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: CashBankPage,
});
