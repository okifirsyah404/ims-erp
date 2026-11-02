import { Layers, Package, Repeat, Warehouse } from 'lucide-react';

import type { SidebarItem } from './sidebar-item';
import SidebarSection from './sidebar-section';

/**
 * Inventory navigation.
 *
 * Visibility is gated by `main-sidebar` on the self user's platform role
 * (`user.role === 'admin'`). UX only - the backend enforces every
 * operation behind these routes.
 *
 * No `'#'` sentinels remain: S3 shipped the movement ledger, so
 * `item.itemMovements` now points at the real route instead of a non-link.
 */
const items: SidebarItem[] = [
	{
		titleKey: 'item.warehouses',
		icon: Warehouse,
		url: '/inventory/warehouses',
	},
	{
		titleKey: 'item.stock',
		icon: Layers,
		url: '/inventory/stock',
	},
	{
		// S4: equipment leaving the warehouse under someone's custody. A
		// borrowing is the only path that both moves stock and expects it back,
		// so it sits beside Stock rather than inside the item catalogue.
		titleKey: 'item.borrowings',
		icon: Repeat,
		url: '/inventory/borrowings',
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
				url: '/inventory/stock/movements',
			},
		],
	},
];

export function NavInventory() {
	return <SidebarSection labelKey='section.inventory' items={items} />;
}
