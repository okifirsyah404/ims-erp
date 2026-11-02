import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { AdminOnly } from '@/components/inventory/admin-only';
import { ItemKindList } from '@/components/inventory/item-kind-list';

/** `/inventory/materials` — the material slice of the item master. */
export const Route = createFileRoute('/_authed/inventory/materials/')({
	component: MaterialsPage,
});

function MaterialsPage() {
	const { t } = useTranslation(['inventory']);
	return (
		<AdminOnly>
			<ItemKindList kind='material' title={t('inventory:materials.title')} />
		</AdminOnly>
	);
}
