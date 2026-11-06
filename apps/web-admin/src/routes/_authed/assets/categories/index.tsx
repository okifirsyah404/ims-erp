import { createFileRoute } from '@tanstack/react-router';

import { AssetCategoryList } from '@/components/assets/asset-category-list';

/** Search params for the category list. */
type TCategoriesSearch = {
	page?: number;
	search?: string;
};

/** `/assets/categories` — category management (Phase A-4). */
export const Route = createFileRoute('/_authed/assets/categories/')({
	validateSearch: (search: Record<string, unknown>): TCategoriesSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		search:
			typeof search.search === 'string' && search.search
				? search.search
				: undefined,
	}),
	component: AssetCategoryList,
});
