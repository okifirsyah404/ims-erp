import { createFileRoute } from '@tanstack/react-router';

import { TaxTypeList } from '@/components/tax/tax-type-list';

/** Search params for the rate list. */
type TTypesSearch = { page?: number };

/** `/finance/tax/types` - effective-dated rate rows (Phase 2, ERP-0016). */
export const Route = createFileRoute('/_authed/finance/tax/types/')({
	validateSearch: (search: Record<string, unknown>): TTypesSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: TaxTypeList,
});
