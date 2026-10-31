import { describe, expect, test } from 'bun:test';

import {
	buildCrumbs,
	collapseCrumbs,
	type CrumbMatch,
} from '../src/components/layout/build-crumbs';

function match(
	routeId: string,
	fullPath: string,
	params: CrumbMatch['params'] = {},
	staticData?: CrumbMatch['staticData'],
): CrumbMatch {
	return { routeId, fullPath, params, staticData };
}

describe('buildCrumbs', () => {
	test('dashboard renders a single Home page crumb', () => {
		const crumbs = buildCrumbs([
			match('__root__', '/'),
			match('/_authed', '/'),
			match('/_authed/', '/'),
		]);
		expect(crumbs).toEqual([{ key: 'home', label: 'Home', href: null, params: {} }]);
	});

	test('skips layout-only routes and labels the organizations list', () => {
		const crumbs = buildCrumbs([
			match('__root__', '/'),
			match('/_authed', '/'),
			match('/_authed/organizations/', '/organizations/'),
		]);
		expect(crumbs.map((crumb) => crumb.label)).toEqual(['Home', 'Organizations']);
		expect(crumbs.at(-1)?.href).toBeNull();
	});

	test('org detail trail: Home > Organizations > {id}', () => {
		const crumbs = buildCrumbs([
			match('__root__', '/'),
			match('/_authed', '/'),
			match(
				'/_authed/organizations/$organizationId',
				'/organizations/$organizationId',
				{ organizationId: 'org-1' },
			),
		]);
		expect(crumbs.map((crumb) => crumb.label)).toEqual(['Home', 'Organizations', 'org-1']);
		// Last crumb is the current page, earlier crumbs are links.
		expect(crumbs.map((crumb) => crumb.href)).toEqual([
			'/',
			'/organizations',
			null,
		]);
	});

	test('edit trail synthesizes the index-route ancestor', () => {
		const crumbs = buildCrumbs([
			match('__root__', '/'),
			match('/_authed', '/'),
			match(
				'/_authed/organizations/$organizationId',
				'/organizations/$organizationId',
				{ organizationId: 'org-1' },
			),
			match(
				'/_authed/organizations/$organizationId/edit',
				'/organizations/$organizationId/edit',
				{ organizationId: 'org-1' },
			),
		]);
		expect(crumbs.map((crumb) => crumb.label)).toEqual([
			'Home',
			'Organizations',
			'org-1',
			'Edit',
		]);
	});

	test('member edit falls back to the static label', () => {
		const crumbs = buildCrumbs([
			match(
				'/_authed/organizations/$organizationId',
				'/organizations/$organizationId',
				{ organizationId: 'org-1' },
			),
			match(
				'/_authed/organizations/$organizationId/members/$memberId/edit',
				'/organizations/$organizationId/members/$memberId/edit',
				{ organizationId: 'org-1', memberId: 'mem-1' },
			),
		]);
		expect(crumbs.at(-1)?.label).toBe('Edit member');
	});

	test('enricher overrides dynamic labels', () => {
		const crumbs = buildCrumbs(
			[match('/_authed/organizations/$organizationId', '/organizations/$organizationId', { organizationId: 'org-1' })],
			(fullPath) =>
				fullPath === '/organizations/$organizationId' ? 'Acme Inc' : undefined,
		);
		expect(crumbs.at(-1)?.label).toBe('Acme Inc');
	});

	test('staticData.crumb wins over every fallback', () => {
		const crumbs = buildCrumbs(
			[match('/_authed/organizations/$organizationId/edit', '/organizations/$organizationId/edit', {}, { crumb: 'Rename' })],
		);
		expect(crumbs.at(-1)?.label).toBe('Rename');
	});

	test('unknown routes prettify their last path segment', () => {
		const crumbs = buildCrumbs([match('/_authed/widgets/$widgetId', '/widgets/$widgetId', { widgetId: 'w-9' })]);
		expect(crumbs.at(-1)?.label).toBe('w-9');
		const crumbs2 = buildCrumbs([match('/_authed/widgets/', '/widgets/')]);
		expect(crumbs2.at(-1)?.label).toBe('Widgets');
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
