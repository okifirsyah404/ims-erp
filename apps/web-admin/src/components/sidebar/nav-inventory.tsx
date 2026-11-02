import { Package, Warehouse } from 'lucide-react';

import type { SidebarItem } from './sidebar-item';
import SidebarSection from './sidebar-section';

/**
 * Inventory navigation.
 *
 * Visibility is gated by `main-sidebar` on the self user's platform role
 * (`user.role === 'admin'`). UX only - the backend enforces every
 * operation behind these routes.
 *
 * Routes that are planned but not built yet use the `'#'` sentinel that
 * `sidebar-section` renders as a non-link, rather than pointing at a 404:
 * `item-movements` lands with slice S3.
 */
const items: SidebarItem[] = [
	{
		titleKey: 'item.warehouses',
		icon: Warehouse,
		url: '/inventory/warehouses',
	},
	{
		titleKey: 'item.items',
		icon: Package,
		items: [
			{
				titleKey: 'item.products',
				url: '/inventory/products',
			},
			{
				titleKey: 'item.components',
				url: '/inventory/components',
			},
			{
				titleKey: 'item.materials',
				url: '/inventory/materials',
			},
			{
				titleKey: 'item.tools',
				url: '/inventory/tools',
			},
			{
				titleKey: 'item.newItem',
				url: '/inventory/items/new',
			},
			{
				titleKey: 'item.itemMovements',
				url: '#',
			},
		],
	},
];

export function NavInventory() {
	return <SidebarSection labelKey='section.inventory' items={items} />;
}
