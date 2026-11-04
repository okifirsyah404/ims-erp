import { createFileRoute } from '@tanstack/react-router';

import { AssetToolSetList } from '@/components/assets/asset-tool-set-list';

/** Search params for the tool-set list. */
type TToolSetsSearch = {
	page?: number;
};

/** `/assets/tool-sets` — tool kit management (Phase A-4 / D11). */
export const Route = createFileRoute('/_authed/assets/tool-sets/')({
	validateSearch: (search: Record<string, unknown>): TToolSetsSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: AssetToolSetList,
});
