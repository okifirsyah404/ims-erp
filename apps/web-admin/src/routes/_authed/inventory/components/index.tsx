import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { AdminOnly } from '@/components/inventory/admin-only';
import { ItemKindList } from '@/components/inventory/item-kind-list';

/** Search params for the item lists (URL-backed pagination). */
type TItemListSearch = {
	page?: number;
};

/** `/inventory/components` — the component slice of the item master. */
export const Route = createFileRoute('/_authed/inventory/components/')({
	validateSearch: (search: Record<string, unknown>): TItemListSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: ComponentsPage,
});

function ComponentsPage() {
	const { t } = useTranslation(['inventory', 'product']);
	const { page } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<AdminOnly>
			<ItemKindList
				kind='component'
				title={t('product:components.title')}
				page={page ?? 1}
				onPageChange={(next) =>
					void navigate({ search: (prev) => ({ ...prev, page: next }) })
				}
			/>
		</AdminOnly>
	);
}
