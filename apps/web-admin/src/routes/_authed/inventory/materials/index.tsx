import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { AdminOnly } from '@/components/inventory/admin-only';
import { ItemKindList } from '@/components/inventory/item-kind-list';

/** Search params for the item lists (URL-backed pagination). */
type TItemListSearch = {
	page?: number;
};

/** `/inventory/materials` — the material slice of the item master. */
export const Route = createFileRoute('/_authed/inventory/materials/')({
	validateSearch: (search: Record<string, unknown>): TItemListSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: MaterialsPage,
});

function MaterialsPage() {
	const { t } = useTranslation(['inventory']);
	const { page } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<AdminOnly>
			<ItemKindList
				kind='material'
				title={t('inventory:materials.title')}
				page={page ?? 1}
				onPageChange={(next) =>
					void navigate({ search: (prev) => ({ ...prev, page: next }) })
				}
			/>
		</AdminOnly>
	);
}
