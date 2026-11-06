import { createFileRoute } from '@tanstack/react-router';

import { AssetDisposalList } from '@/components/assets/asset-disposal-list';

/** Search params for the disposals list. */
type TDisposalsSearch = {
	page?: number;
};

/** `/assets/disposals` — disposal workflow (Phase A-4 / D21). */
export const Route = createFileRoute('/_authed/assets/disposals/')({
	validateSearch: (search: Record<string, unknown>): TDisposalsSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: AssetDisposalList,
});
