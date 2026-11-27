import { createFileRoute } from '@tanstack/react-router';

import { ExpenseList } from '@/components/finance/expense-list';

/** `/finance/expenses` - employee expense claims (ERP-0013). */
export const Route = createFileRoute('/_authed/finance/expenses/')({
	component: ExpenseList,
});
