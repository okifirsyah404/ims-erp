import { createFileRoute } from '@tanstack/react-router';

import { ExpenseDetail } from '@/components/finance/expense-detail';

/** `/finance/expenses/$claimId` - one expense claim (ERP-0013). */
export const Route = createFileRoute('/_authed/finance/expenses/$claimId/')({
	component: ExpenseDetail,
});
