import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { AdminOnly } from '@/components/inventory/admin-only';
import { ItemKindList } from '@/components/inventory/item-kind-list';

/**
 * `/inventory/products` — the product slice of the item master.
 *
 * @remarks
 * One route per kind mirrors the sidebar vocabulary (`item.products`,
 * `item.components`, …) instead of a single list with filter chips: each kind
 * has its own domain rules (tools may only be borrowed; only products may be
 * sold or applied to warranty), and the route name states which rule set is
 * in play.
 */
export const Route = createFileRoute('/_authed/inventory/products/')({
	component: ProductsPage,
});

function ProductsPage() {
	const { t } = useTranslation(['inventory']);
	return (
		<AdminOnly>
			<ItemKindList kind='product' title={t('inventory:products.title')} />
		</AdminOnly>
	);
}
