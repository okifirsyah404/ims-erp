import { createFileRoute } from '@tanstack/react-router';

import { WithholdingList } from '@/components/tax/withholding-list';

/** Search params for the withholding list. */
type TWithholdingSearch = { page?: number };

/** `/finance/tax/withholding` - withholding records (Phase 2, ERP-0016). */
export const Route = createFileRoute('/_authed/finance/tax/withholding/')({
	validateSearch: (search: Record<string, unknown>): TWithholdingSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: WithholdingList,
});
