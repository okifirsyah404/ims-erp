import { describe, expect, test } from 'bun:test';

import {
	buildCrumbs,
	type CrumbEnricher,
	type CrumbMatch,
} from '../src/components/layout/build-crumbs';

/** Identity translator: labels come back as the i18next keys the module chose. */
const identity = (key: string) => key;

function match(routeId: string, fullPath: string, params: CrumbMatch['params'] = {}): CrumbMatch {
	return { routeId, fullPath, params };
}

/** Matches of a detail page mounted under `prefix` (`/products`, `/inventory/materials`, ...). */
function detail(prefix: string, id: string): CrumbMatch[] {
	return [
		match('__root__', '/'),
		match('/_authed', '/'),
		match(`/_authed${prefix}/$productId/`, `${prefix}/$productId/`, { productId: id }),
	];
}

describe('buildCrumbs - item routes', () => {
	test('a detail page under a grouping prefix has no crumb for the prefix', () => {
		const exists = (template: string) =>
			['/inventory/components', '/inventory/components/$productId'].includes(template);
		const crumbs = buildCrumbs(detail('/inventory/components', 'p1'), identity, undefined, exists);
		expect(crumbs.map((crumb) => crumb.label)).toEqual(['breadcrumb.home', 'item.components', 'p1']);
		expect(crumbs.map((crumb) => crumb.href)).toEqual(['/', '/inventory/components', null]);
	});

	test('without a route check the unrouted prefix is kept (legacy behaviour)', () => {
		const crumbs = buildCrumbs(detail('/inventory/materials', 'p1'), identity);
		expect(crumbs.map((crumb) => crumb.key)).toContain('/inventory');
	});

	test('the enricher supplies the item name for the detail crumb', () => {
		const enrich: CrumbEnricher = (fullPath) => (fullPath === '/products/$productId' ? 'Camera X' : undefined);
		const crumbs = buildCrumbs(detail('/products', 'p9'), identity, enrich);
		expect(crumbs.at(-1)?.label).toBe('Camera X');
		expect(crumbs.at(-2)?.label).toBe('item.products');
	});

	test('edit pages are labelled Edit and link back to the detail', () => {
		const crumbs = buildCrumbs(
			[
				match('__root__', '/'),
				match('/_authed', '/'),
				match('/_authed/products/$productId/edit', '/products/$productId/edit', { productId: 'p1' }),
			],
			identity,
		);
		expect(crumbs.at(-1)).toMatchObject({ label: 'breadcrumb.quotationEdit', href: null });
		expect(crumbs.find((crumb) => crumb.key === '/products/$productId')?.href).toBe('/products/$productId');
	});

	test('stock pages are translated', () => {
		const exists = (template: string) => template !== '/inventory';
		const crumbs = buildCrumbs(
			[
				match('__root__', '/'),
				match('/_authed', '/'),
				match('/_authed/inventory/stock/movements', '/inventory/stock/movements'),
			],
			identity,
			undefined,
			exists,
		);
		expect(crumbs.map((crumb) => crumb.label)).toEqual([
			'breadcrumb.home',
			'item.stock',
			'item.itemMovements',
		]);
	});
});
