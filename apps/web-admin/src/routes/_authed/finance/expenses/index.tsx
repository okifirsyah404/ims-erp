import { createFileRoute } from '@tanstack/react-router';

import { useTranslation } from 'react-i18next';
import { AdvancesPanel } from '@/components/finance/advances-panel';
import { ExpenseList } from '@/components/finance/expense-list';
import { PaymentsTable } from '@/components/finance/payments-table';
import type { TExpenseClaimStatus } from '@/lib/finance-api';

/** Search params for the expense-claim list. */
type TExpensesSearch = {
	page?: number;
	status?: TExpenseClaimStatus;
	from?: string;
	to?: string;
	search?: string;
};

const date = (value: unknown) =>
	typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;

/** `/finance/expenses` - employee expense claims (ERP-0013). */
export const Route = createFileRoute('/_authed/finance/expenses/')({
	validateSearch: (search: Record<string, unknown>): TExpensesSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		status: typeof search.status === 'string' ? (search.status as TExpenseClaimStatus) : undefined,
		from: date(search.from),
		to: date(search.to),
		search: typeof search.search === 'string' && search.search ? search.search : undefined,
	}),
	component: ExpensesPage,
});

/** Claims, then advances and settlements, then the employee payments that pay them (ERP-0144). */
function ExpensesPage() {
	const { t } = useTranslation(['finance']);
	return (
		<div className='space-y-6'>
			<ExpenseList />
			<AdvancesPanel />
			<PaymentsTable paymentType='employee_payment' title={t('finance:payments.type.employee_payment')} />
		</div>
	);
}
