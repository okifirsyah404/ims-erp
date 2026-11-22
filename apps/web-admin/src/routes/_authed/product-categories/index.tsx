import { createFileRoute } from '@tanstack/react-router';

import { ItemCategoryList } from '@/components/inventory/item-category-list';

/** `/product-categories` — item categories (ADR-0011). */
export const Route = createFileRoute('/_authed/product-categories/')({
	component: ItemCategoryList,
});
