import { describe, expect, test } from 'bun:test';
import { filterNav } from '../../src/components/sidebar/filter-nav';
import type { SidebarItem } from '../../src/components/sidebar/sidebar-item';

const ctx = (
	perms: string[],
	isAppAdmin = false,
	hasInternalRole = true,
	isPic = false,
) => ({
	can: (list: string[]) => list.every((p) => perms.includes(p)),
	isAppAdmin,
	hasInternalRole,
	isPic,
});

const sec = (items: SidebarItem[]) => ({ labelKey: 'section.x' as SidebarItem['titleKey'], items });
const leaf = (titleKey: string, extra: Partial<SidebarItem> = {}) =>
	({ titleKey, url: '/x', ...extra }) as SidebarItem;

describe('filterNav', () => {
	test('internalRole item hides for investor-only users, shows with an internal role', () => {
		const items = [leaf('a', { internalRole: true }), leaf('b', { open: true })];
		const onlyInvestor = filterNav([sec(items)], ctx([], false, false));
		expect(onlyInvestor[0].items.map((i) => i.titleKey)).toEqual(['b']);
		const internal = filterNav([sec(items)], ctx([], false, true));
		expect(internal[0].items).toHaveLength(2);
	});

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

	test('orAppAdmin shows for the permission or for an app admin', () => {
		const items = [leaf('a', { permission: 'code_number.read' as never, orAppAdmin: true })];
		expect(filterNav([sec(items)], ctx([]))).toEqual([]);
		expect(filterNav([sec(items)], ctx(['code_number.read']))[0].items).toHaveLength(1);
		expect(filterNav([sec(items)], ctx([], true))[0].items).toHaveLength(1);
	});

	test('appAdminOnly ignores permissions and needs admin', () => {
		const items = [leaf('a', { appAdminOnly: true })];
		expect(filterNav([sec(items)], ctx(['x.y']))).toEqual([]);
		expect(filterNav([sec(items)], ctx([], true))[0].items).toHaveLength(1);
	});

	test('warehousePic shows for an app admin or a person in charge, nobody else', () => {
		const items = [leaf('a', { warehousePic: true })];
		expect(filterNav([sec(items)], ctx([]))).toEqual([]);
		expect(filterNav([sec(items)], ctx([], false, true, true))[0].items).toHaveLength(1);
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
