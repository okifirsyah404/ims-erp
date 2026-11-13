import { describe, expect, test } from 'bun:test';
import { filterNav } from '../../src/components/sidebar/filter-nav';
import type { SidebarItem } from '../../src/components/sidebar/sidebar-item';

const ctx = (perms: string[], isAppAdmin = false) => ({
	can: (list: string[]) => list.every((p) => perms.includes(p)),
	isAppAdmin,
});

const sec = (items: SidebarItem[]) => ({ labelKey: 'section.x' as SidebarItem['titleKey'], items });
const leaf = (titleKey: string, extra: Partial<SidebarItem> = {}) =>
	({ titleKey, url: '/x', ...extra }) as SidebarItem;

describe('filterNav', () => {
	test('no permission, no open, no appAdminOnly is hidden', () => {
		const out = filterNav([sec([leaf('a')])], ctx([]));
		expect(out).toEqual([]);
	});

	test('open item shows for everyone', () => {
		const out = filterNav([sec([leaf('a', { open: true })])], ctx([]));
		expect(out[0].items.map((i) => i.titleKey)).toEqual(['a']);
	});

	test('permission item shows only when granted', () => {
		const items = [leaf('a', { permission: 'quotation.read' as never })];
		expect(filterNav([sec(items)], ctx([]))).toEqual([]);
		expect(filterNav([sec(items)], ctx(['quotation.read']))[0].items).toHaveLength(1);
	});

	test('appAdminOnly ignores permissions and needs admin', () => {
		const items = [leaf('a', { appAdminOnly: true })];
		expect(filterNav([sec(items)], ctx(['x.y']))).toEqual([]);
		expect(filterNav([sec(items)], ctx([], true))[0].items).toHaveLength(1);
	});

	test('parent hidden when no child passes', () => {
		const parent = leaf('p', { items: [leaf('c', { permission: 'x.y' as never })] } as never);
		expect(filterNav([sec([parent])], ctx([]))).toEqual([]);
	});

	test('parent keeps only passing children', () => {
		const parent = leaf('p', {
			items: [leaf('c1', { open: true }), leaf('c2', { permission: 'x.y' as never })],
		} as never);
		const out = filterNav([sec([parent])], ctx([]));
		expect(out[0].items[0].items?.map((i) => i.titleKey)).toEqual(['c1']);
	});
});
