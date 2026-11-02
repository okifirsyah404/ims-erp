import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { AdminOnly } from '@/components/inventory/admin-only';
import { ItemKindList } from '@/components/inventory/item-kind-list';

/** `/inventory/components` — the component slice of the item master. */
export const Route = createFileRoute('/_authed/inventory/components/')({
	component: ComponentsPage,
});

function ComponentsPage() {
	const { t } = useTranslation(['inventory']);
	return (
		<AdminOnly>
			<ItemKindList kind='component' title={t('inventory:components.title')} />
		</AdminOnly>
	);
}
