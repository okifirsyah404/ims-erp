/**
 * Pure breadcrumb-crumb derivation for the portal.
 *
 * @remarks
 * Copied from web-admin's version but keyed to the portal's own routes and to
 * the shared `nav` namespace, so it needs no edit when the admin's route list
 * changes and vice versa.
 *
 * `useMatches()` returns the chain **outermost first** (the admin's builder
 * relies on the same order), so the leaf is the last entry — reversing here
 * produced "Instalasi Demo > Projects" in the walk-through.
 */
import type { NavKey } from '@ims-erp/locales';

export type CrumbMatch = {
	routeId: string;
	fullPath: string;
	params: Record<string, string | undefined>;
	staticData?: { crumb?: NavKey } | undefined;
};

export type Crumb = {
	key: string;
	label: string;
	href: string | null;
	params: Record<string, string | undefined>;
};

/** Layout-only routes that contribute no URL segment and no crumb. */
const HIDDEN_ROUTE_IDS = new Set(['__root__', '/_authed']);

/** Static labels keyed by fullPath template. Values are `nav` keys. */
const LABELS: Record<string, NavKey> = {
	'/': 'breadcrumb.home',
	'/attendance': 'item.attendance',
	'/schedule': 'item.schedule',
	'/tasks': 'item.hrTasks',
	'/leave': 'item.leave',
	'/overtime': 'item.overtime',
	'/profile': 'item.employeeProfile',
	'/projects': 'item.projects',
	'/projects/$projectId': 'item.projects',
	'/documents': 'item.files',
	'/payslips': 'item.payroll',
};

function normalize(fullPath: string): string {
	return fullPath.length > 1 ? fullPath.replace(/\/$/, '') : fullPath;
}

/**
 * Builds the crumb trail for the current match chain.
 *
 * @param matches - `useMatches()`, outermost first
 * @param translate - Resolver for a `nav` key; injected so this stays pure
 */
export function buildCrumbs(
	matches: readonly CrumbMatch[],
	translate: (key: NavKey) => string,
): Crumb[] {
	const visible = matches.filter((match) => !HIDDEN_ROUTE_IDS.has(match.routeId));
	if (visible.length === 0) return [];

	const leafPath = normalize(visible.at(-1)!.fullPath);
	const params = Object.assign({}, ...visible.map((match) => match.params));

	const crumbs: Crumb[] = [];
	for (const match of visible) {
		const fullPath = normalize(match.fullPath);
		const labelKey = match.staticData?.crumb ?? LABELS[fullPath];
		if (!labelKey) continue;
		crumbs.push({
			key: match.routeId,
			label: translate(labelKey),
			href: fullPath,
			params,
		});
	}

	// `/` is the only page; a Home crumb above it would be a self-link.
	if (leafPath === '/') return crumbs.slice(-1);
	if (crumbs[0]?.href !== '/') {
		crumbs.unshift({ key: 'home', label: translate('breadcrumb.home'), href: '/', params: {} });
	}
	return crumbs;
}

