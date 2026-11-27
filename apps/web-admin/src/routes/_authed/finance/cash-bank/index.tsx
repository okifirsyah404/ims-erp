import { createFileRoute } from '@tanstack/react-router';

import { CashBankPage } from '@/components/finance/cash-bank-page';

/** `/finance/cash-bank` - cash/bank accounts + movements (M09 F3). */
export const Route = createFileRoute('/_authed/finance/cash-bank/')({
	component: CashBankPage,
});
