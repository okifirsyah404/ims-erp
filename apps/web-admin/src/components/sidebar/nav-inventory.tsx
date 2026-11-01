import { Package, Warehouse } from 'lucide-react';

import type { SidebarItem } from './sidebar-item';
import SidebarSection from './sidebar-section';

/**
 * Administration navigation (platform admins only).
 *
 * Visibility is gated by `main-sidebar` on the self user's platform role
 * (`user.role === 'admin'`). UX only - the backend enforces every
 * operation behind these routes.
 */
const items: SidebarItem[] = [
	{
		title: 'Warehouses',
		icon: Warehouse,
		url: '/inventory/warehouses',
	},
	{
		title: 'Items',
		icon: Package,
		items: [
			{
				title: 'Products',
				url: '/inventory/products',
			},
			{
				title: 'Components',
				url: '/inventory/components',
			},
			{
				title: 'Materials',
				url: '/inventory/materials',
			},
			{
				title: 'Tools',
				url: '/inventory/tools',
			},
			{
				title: 'Item Movements',
				url: '/inventory/item-movements',
			},
		],
	},
];

export function NavInventory() {
	return <SidebarSection label='Inventory' items={items} />;
}
