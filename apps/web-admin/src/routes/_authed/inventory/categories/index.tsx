import { createFileRoute } from '@tanstack/react-router';

import { ItemCategoryList } from '@/components/inventory/item-category-list';

/** `/inventory/categories` — item categories (ADR-0011). */
export const Route = createFileRoute('/_authed/inventory/categories/')({
	component: ItemCategoryList,
});
