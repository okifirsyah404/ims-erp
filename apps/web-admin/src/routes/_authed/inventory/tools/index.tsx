import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { AdminOnly } from '@/components/inventory/admin-only';
import { ItemKindList } from '@/components/inventory/item-kind-list';

/**
 * `/inventory/tools` — the tool slice of the item master.
 *
 * @remarks
 * Tools may only be borrowed. They never reach `sold` or `applied_warranty`;
 * the unit screens hide those transitions for this kind rather than letting
 * the user discover the rule through a 422.
 */
export const Route = createFileRoute('/_authed/inventory/tools/')({
	component: ToolsPage,
});

function ToolsPage() {
	const { t } = useTranslation(['inventory']);
	return (
		<AdminOnly>
			<ItemKindList kind='tool' title={t('inventory:tools.title')} />
		</AdminOnly>
	);
}
