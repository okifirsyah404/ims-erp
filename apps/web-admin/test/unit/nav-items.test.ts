import { describe, expect, test } from 'bun:test';

import { findNavLeaf } from '../../src/components/sidebar/filter-nav';
import { navSections } from '../../src/components/sidebar/nav-config';
import type { SidebarItem } from '../../src/components/sidebar/sidebar-item';

const inventory = navSections.find((section) => section.labelKey === 'section.inventory');

describe('inventory nav', () => {
	test('Products is its own item, not inside the Items group', () => {
		const products = inventory?.items.find((item) => item.titleKey === 'item.products');
		expect(products?.url).toBe('/products');
		expect(products?.items).toBeUndefined();
		expect(products?.permission).toBe('product.read');

		const group = inventory?.items.find((item) => item.titleKey === 'item.items');
		expect(group?.items?.map((child) => child.titleKey)).not.toContain('item.products');
		expect(group?.items?.map((child) => child.titleKey)).toContain('item.components');
	});

	test('item categories point at the real route and are gated by product.read', () => {
		const group = inventory?.items.find((item) => item.titleKey === 'item.items');
		const categories = group?.items?.find((child: SidebarItem) => child.titleKey === 'item.itemCategories');
		expect(categories?.url).toBe('/product-categories');
		expect(categories?.permission).toBe('product.read');
	});

	test('detail and edit routes resolve to the menu of their kind', () => {
		expect(findNavLeaf(navSections, '/products/abc')?.titleKey).toBe('item.products');
		expect(findNavLeaf(navSections, '/products/abc/edit')?.titleKey).toBe('item.products');
		expect(findNavLeaf(navSections, '/inventory/components/abc')?.titleKey).toBe('item.components');
		expect(findNavLeaf(navSections, '/inventory/materials/abc/edit')?.titleKey).toBe('item.materials');
	});

	test('categories do not fall under the Products menu', () => {
		expect(findNavLeaf(navSections, '/product-categories')?.titleKey).toBe('item.itemCategories');
	});
});
