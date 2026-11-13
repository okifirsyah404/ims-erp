import { describe, expect, test } from 'bun:test';
import { findNavLeaf } from '../../src/components/sidebar/filter-nav';
import type { SidebarItem } from '../../src/components/sidebar/sidebar-item';

const leaf = (url: string, extra: Partial<SidebarItem> = {}) =>
	({ titleKey: 'x' as SidebarItem['titleKey'], url, ...extra }) as SidebarItem;

const sections = [
	{
		items: [
			leaf('/', { internalRole: true }),
			{
				titleKey: 'x' as SidebarItem['titleKey'],
				url: '/inventory',
				items: [
					leaf('/inventory/stock', { permission: 'stock.read' }),
					leaf('/inventory/stock/adjustments', { permission: 'stock_adjustment.read' }),
				],
			},
		],
	},
];

describe('findNavLeaf', () => {
	test('exact and child paths map to their leaf', () => {
		expect(findNavLeaf(sections, '/inventory/stock')?.url).toBe('/inventory/stock');
		expect(findNavLeaf(sections, '/inventory/stock/42')?.url).toBe('/inventory/stock');
	});

	test('longest url wins over a shorter prefix', () => {
		expect(findNavLeaf(sections, '/inventory/stock/adjustments/9')?.url).toBe(
			'/inventory/stock/adjustments',
		);
	});

	test('"/" matches only itself', () => {
		expect(findNavLeaf(sections, '/')?.url).toBe('/');
		expect(findNavLeaf(sections, '/unknown')).toBeNull();
	});

	test('prefix without a slash boundary does not match', () => {
		expect(findNavLeaf(sections, '/inventory/stockpile')).toBeNull();
	});
});
