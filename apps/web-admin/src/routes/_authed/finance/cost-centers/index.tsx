import { createFileRoute } from '@tanstack/react-router';

import { CostCentersPage } from '@/components/finance/cost-centers-page';

/** Search params for the cost-centre list. */
type TCostCenterSearch = { page?: number; search?: string };

/** `/finance/cost-centers` - cost-centre master data (ERP-0127). */
export const Route = createFileRoute('/_authed/finance/cost-centers/')({
	validateSearch: (search: Record<string, unknown>): TCostCenterSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		search: typeof search.search === 'string' && search.search.trim() ? search.search.trim() : undefined,
	}),
	component: CostCentersPage,
});
