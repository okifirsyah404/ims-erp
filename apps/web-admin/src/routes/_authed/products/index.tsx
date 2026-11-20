import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { AdminOnly } from '@/components/inventory/admin-only';
import { ItemKindList } from '@/components/inventory/item-kind-list';

/** Search params for the item lists (URL-backed pagination). */
type TItemListSearch = {
	page?: number;
};

/**
 * `/products` — the product slice of the item master.
 *
 * @remarks
 * One route per kind mirrors the sidebar vocabulary (`item.products`,
 * `item.components`, …) instead of a single list with filter chips: each kind
 * has its own domain rules (tools may only be borrowed; only products may be
 * sold or applied to warranty), and the route name states which rule set is
 * in play.
 *
 * Only `page` lives in the URL; the page size is a frontend constant, so a
 * shared link never pins a stale limit.
 */
export const Route = createFileRoute('/_authed/products/')({
	validateSearch: (search: Record<string, unknown>): TItemListSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: ProductsPage,
});

function ProductsPage() {
	const { t } = useTranslation(['inventory', 'product']);
	const { page } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<AdminOnly>
			<ItemKindList
				kind='product'
				title={t('product:products.title')}
				page={page ?? 1}
				onPageChange={(next) =>
					void navigate({ search: (prev) => ({ ...prev, page: next }) })
				}
			/>
		</AdminOnly>
	);
}
