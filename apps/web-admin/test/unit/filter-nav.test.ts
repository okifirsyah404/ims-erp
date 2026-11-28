import { describe, expect, test } from 'bun:test';
import { filterNav } from '../../src/components/sidebar/filter-nav';
import { navSections } from '../../src/components/sidebar/nav-config';
import type { SidebarItem } from '../../src/components/sidebar/sidebar-item';

const ctx = (
	perms: string[],
	isAppAdmin = false,
	hasInternalRole = true,
	isPic = false,
	isOwner = false,
) => ({
	can: (list: string[]) => list.every((p) => perms.includes(p)),
	isAppAdmin,
	hasInternalRole,
	isOwner,
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

describe('nav-config M07 (ERP-0108)', () => {
	test('every M07 leaf carries a gate (deny-by-default would hide it)', () => {
		const m07 = navSections.find((section) => section.labelKey === 'section.projects')!;
		expect(m07.items.length).toBeGreaterThan(0);
		const leaves = m07.items.flatMap((item) => item.items ?? [item]);
		for (const item of leaves) {
			expect(item.permission ?? item.anyPermission ?? item.open ?? item.internalRole).toBeTruthy();
		}
	});
	test('Projects, Tickets, Warranty and Subscription point at their own top-level URLs', () => {
		const m07 = navSections.find((section) => section.labelKey === 'section.projects')!;
		expect(m07.items.map((item) => item.url)).toEqual([
			'/projects',
			'/tickets',
			'/warranties',
			'/subscription',
		]);
	});
});

describe('nav section order', () => {
	test('sections follow the product order, Subscription lives inside Projects', () => {
		expect(navSections.map((section) => section.labelKey)).toEqual([
			'section.dashboard',
			'section.crmSales',
			'section.finance',
			'section.projects',
			'section.inventory',
			'section.hr',
			'section.documents',
			'section.reports',
			'section.integrations',
			'section.administration',
			'section.settings',
		]);
	});

	test('Subscription & Licensing is a Projects leaf, not its own section', () => {
		const projects = navSections.find((section) => section.labelKey === 'section.projects')!;
		expect(projects.items.map((item) => item.titleKey)).toContain('item.subscription');
		expect(navSections.some((section) => section.labelKey === 'section.subscription')).toBe(
			false,
		);
	});
});
describe('organization settings entry (M12-2)', () => {
	const item = () =>
		leaf('item.organizations', { url: '/settings/organizations', ownerOnly: true });

	test('ownerOnly shows for the owner and for an app admin, not for other members', () => {
		expect(filterNav([sec([item()])], ctx([], false, true, false, true))[0].items).toHaveLength(1);
		expect(filterNav([sec([item()])], ctx([], true))[0].items).toHaveLength(1);
		// organization.read alone is not enough: the page edits the company profile.
		expect(filterNav([sec([item()])], ctx(['organization.read']))).toEqual([]);
	});

	test('the Organizations entry moved out of Administration into Settings', () => {
		const administration = navSections.find(
			(section) => section.labelKey === 'section.administration',
		)!;
		const settings = navSections.find((section) => section.labelKey === 'section.settings')!;
		expect(administration.items.map((entry) => entry.titleKey)).not.toContain(
			'item.organizations',
		);
		const entry = settings.items.find((row) => row.titleKey === 'item.organizations');
		expect(entry?.url).toBe('/settings/organizations');
		expect(entry?.ownerOnly).toBe(true);
	});
});
