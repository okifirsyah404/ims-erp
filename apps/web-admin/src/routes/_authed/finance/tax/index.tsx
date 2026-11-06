import { createFileRoute } from '@tanstack/react-router';

import { TaxRecap } from '@/components/tax/tax-recap';

/** Search params for the recap page. */
type TRecapSearch = {
	year?: number;
	month?: number;
};

/** `/finance/tax` - period recap with CSV export (Phase 2, ERP-0016). */
export const Route = createFileRoute('/_authed/finance/tax/')({
	validateSearch: (search: Record<string, unknown>): TRecapSearch => ({
		year: search.year ? Number(search.year) || undefined : undefined,
		month: search.month ? Number(search.month) || undefined : undefined,
	}),
	component: TaxRecap,
});
