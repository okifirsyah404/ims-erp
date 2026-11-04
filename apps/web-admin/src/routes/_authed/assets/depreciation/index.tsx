import { createFileRoute } from '@tanstack/react-router';

import { AssetDepreciationList } from '@/components/assets/asset-depreciation-list';

/** Search params for the depreciation page. */
type TDepreciationSearch = {
	page?: number;
};

/** `/assets/depreciation` — manual depreciation log (Phase A-4 / D14). */
export const Route = createFileRoute('/_authed/assets/depreciation/')({
	validateSearch: (search: Record<string, unknown>): TDepreciationSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: AssetDepreciationList,
});
