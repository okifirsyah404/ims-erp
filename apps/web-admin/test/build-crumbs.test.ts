import { describe, expect, test } from 'bun:test';

import {
	buildCrumbs,
	collapseCrumbs,
	type CrumbEnricher,
	type CrumbMatch,
} from '../src/components/layout/build-crumbs';

/**
 * `buildCrumbs` is React-free and takes a translator, so these tests inject an
 * identity function: labels then come back as the i18next *keys* the module
 * resolved, which is what we actually want to assert on (the wording lives in
 * the locale bundles and is covered by the parity test there).
 */
const identity = (key: string) => key;

function match(
	routeId: string,
	fullPath: string,
	params: CrumbMatch['params'] = {},
	staticData?: CrumbMatch['staticData'],
): CrumbMatch {
	return { routeId, fullPath, params, staticData };
}

/** Maps keys to human labels, mimicking what `t` does in the app. */
const labels: Record<string, string> = {
	'breadcrumb.home': 'Home',
	'item.organizations': 'Organization',
};
const lookup = (key: string) => labels[key] ?? key;

describe('buildCrumbs', () => {
	test('dashboard renders a single Home page crumb', () => {
		const crumbs = buildCrumbs(
			[
				match('__root__', '/'),
				match('/_authed', '/'),
				match('/_authed/', '/'),
			],
			lookup,
		);
		expect(crumbs).toEqual([
			{ key: 'home', label: 'Home', href: null, params: {} },
		]);
	});

	test('skips layout-only routes and labels the organization settings page', () => {
		const crumbs = buildCrumbs(
			[
				match('__root__', '/'),
				match('/_authed', '/'),
				match('/_authed/settings/organizations/', '/settings/organizations/'),
			],
			lookup,
		);
		expect(crumbs.map((crumb) => crumb.label)).toEqual([
			'Home',
			'Settings',
			'Organization',
		]);
		expect(crumbs.at(-1)?.href).toBeNull();
	});

	test('enricher overrides dynamic labels', () => {
		const enrich: CrumbEnricher = (fullPath) =>
			fullPath === '/products/$productId' ? 'Access controller' : undefined;
		const crumbs = buildCrumbs(
			[match('/_authed/products/$productId', '/products/$productId', {
				productId: 'p-1',
			})],
			lookup,
			enrich,
		);
		expect(crumbs.at(-1)?.label).toBe('Access controller');
	});

	test('staticData.crumb wins over every fallback', () => {
		// `staticData.crumb` holds an i18next key, so it goes through `t`.
		const crumbs = buildCrumbs(
			[
				match(
					'/_authed/widgets/$widgetId',
					'/widgets/$widgetId',
					{},
					{ crumb: 'breadcrumb.home' },
				),
			],
			lookup,
		);
		expect(crumbs.at(-1)?.label).toBe('Home');
	});

	test('unknown routes prettify their last path segment', () => {
		const crumbs = buildCrumbs(
			[
				match('/_authed/widgets/$widgetId', '/widgets/$widgetId', {
					widgetId: 'w-9',
				}),
			],
			identity,
		);
		expect(crumbs.at(-1)?.label).toBe('w-9');
		const crumbs2 = buildCrumbs(
			[match('/_authed/widgets/', '/widgets/')],
			identity,
		);
		expect(crumbs2.at(-1)?.label).toBe('Widgets');
	});

	test('static labels are emitted as keys, not English text', () => {
		const crumbs = buildCrumbs(
			[match('/_authed/settings/organizations/', '/settings/organizations/')],
			identity,
		);
		expect(crumbs.map((crumb) => crumb.label)).toEqual([
			'breadcrumb.home',
			'Settings',
			'item.organizations',
		]);
	});
});

describe('collapseCrumbs', () => {
	const trail = (n: number) =>
		Array.from({ length: n }, (_, i) => ({
			key: `c${i}`,
			label: `C${i}`,
			href: `/c${i}`,
			params: {},
		}));

	test('short trails pass through untouched', () => {
		const { shown, hidden } = collapseCrumbs(trail(4));
		expect(shown).toHaveLength(4);
		expect(hidden).toHaveLength(0);
	});

	test('long trails keep first and last two, hide the middle', () => {
		const { shown, hidden } = collapseCrumbs(trail(6));
		expect(shown.map((crumb) => crumb.key)).toEqual(['c0', 'c4', 'c5']);
		expect(hidden.map((crumb) => crumb.key)).toEqual(['c1', 'c2', 'c3']);
	});
});
