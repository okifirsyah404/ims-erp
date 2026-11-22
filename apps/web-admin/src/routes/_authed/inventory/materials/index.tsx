import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { AdminOnly } from '@/components/inventory/admin-only';
import { ItemKindList } from '@/components/inventory/item-kind-list';
import { EMPTY_ITEM_FILTERS as EMPTY_FILTERS, validateItemListSearch } from '@/lib/item-list-search';

/**
 * `/inventory/materials` - the material slice of the item master.
 *
 * @remarks
 * One route per kind mirrors the sidebar, and each kind has its own detail and
 * edit routes below it. page, q, categoryId and ctiveOnly live in the
 * URL; the page size is a frontend constant, so a shared link never pins a
 * stale limit.
 */
export const Route = createFileRoute('/_authed/inventory/materials/')({
	validateSearch: validateItemListSearch,
	component: MaterialsPage,
});

function MaterialsPage() {
	const { t } = useTranslation(['inventory', 'product']);
	const { page, ...filters } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<AdminOnly>
			<ItemKindList
				kind='material'
				title={t('product:materials.title')}
				page={page ?? 1}
				filters={filters}
				onPageChange={(next) =>
					void navigate({ search: (prev) => ({ ...prev, page: next }) })
				}
				onFiltersChange={(next) =>
					void navigate({
						search: (prev) => ({ ...prev, ...EMPTY_FILTERS, ...next, page: undefined }),
					})
				}
			/>
		</AdminOnly>
	);
}