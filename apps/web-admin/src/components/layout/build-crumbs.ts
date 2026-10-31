/**
 * Pure breadcrumb-crumb derivation from TanStack Router match objects.
 * Kept free of React so it can be unit-tested without a DOM.
 */

export type CrumbMatch = {
	/** Full route id, e.g. `/_authed/organizations/$organizationId`. */
	routeId: string;
	/** URL path template, e.g. `/organizations/$organizationId`. */
	fullPath: string;
	params: Record<string, string | undefined>;
	/** Route-level `staticData`; a `crumb` value overrides every fallback. */
	staticData?: { crumb?: string } | undefined;
};

export type Crumb = {
	key: string;
	label: string;
	/** URL path template; `null` marks the current page (not a link). */
	href: string | null;
	params: Record<string, string | undefined>;
};

/**
 * Layout-only routes that contribute no URL segment and no crumb
 * (the root and the `_authed` pathless layout).
 */
const HIDDEN_ROUTE_IDS = new Set(['__root__', '/_authed']);

/** Static labels keyed by fullPath template (trailing slash optional). */
const LABELS: Record<string, string> = {
	'/': 'Home',
	'/organizations/': 'Organizations',
	'/organizations/new': 'New organization',
	'/organizations/$organizationId/edit': 'Edit',
	'/organizations/$organizationId/members/new': 'Add member',
	'/organizations/$organizationId/members/$memberId/edit': 'Edit member',
};

/** Optional dynamic labels. Return a label, or `undefined` to fall through to LABELS/prettify. */
export type CrumbEnricher = (
	fullPath: string,
	params: Record<string, string | undefined>,
) => string | undefined;

function labelFor(template: string): string | undefined {
	return LABELS[template] ?? LABELS[`${template}/`];
}
function prettifySegment(template: string, params: Record<string, string | undefined>): string {
	const segments = template.split('/').filter(Boolean);
	const last = segments.at(-1) ?? '';
	if (last.startsWith('$')) {
		// Raw ids are not prose; never prettify them.
		return params[last.slice(1)] ?? last.slice(1);
	}
	const prettified = last.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
	return prettified || template;
}

function normalizePath(path: string): string {
	return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** Prefix templates of a fullPath: `/a/b/c` → ['/a', '/a/b', '/a/b/c']. */
function ancestorTemplates(fullPath: string): string[] {
	const parts = normalizePath(fullPath).split('/').filter(Boolean);
	return parts.map((_, index) => `/${parts.slice(0, index + 1).join('/')}`);
}

/**
 * Build the crumb trail from the matched route chain.
 *
 * Index routes only match at their own path, so ancestor crumbs (e.g.
 * "Organizations" while on `/organizations/x/edit`) are synthesized from the
 * path-prefix templates of the matched routes. Layout-only routes are
 * skipped, and a Home crumb is prepended unless already on `/`.
 */
export function buildCrumbs(
	matches: readonly CrumbMatch[],
	enrich?: CrumbEnricher,
): Crumb[] {
	const visible = matches.filter((match) => !HIDDEN_ROUTE_IDS.has(match.routeId));
	if (visible.length === 0) return [];

	// Ordered, de-duplicated templates across the whole match chain.
	const templates: string[] = [];
	const seen = new Set<string>();
	for (const match of visible) {
		for (const template of ancestorTemplates(match.fullPath)) {
			if (!seen.has(template)) {
				seen.add(template);
				templates.push(template);
			}
		}
	}

	// All params along the chain (each match already carries its parents').
	const params = Object.assign({}, ...visible.map((match) => match.params));
	const leafFullPath = normalizePath(visible.at(-1)!.fullPath);

	if (leafFullPath === '/') {
		return [{ key: 'home', label: LABELS['/']!, href: null, params: {} }];
	}

	const crumbs: Crumb[] = [
		{ key: 'home', label: LABELS['/']!, href: '/', params: {} },
	];
	for (const template of templates) {
		const label =
			visible.find((match) => match.fullPath === template)?.staticData?.crumb ??
			enrich?.(template, params) ??
			labelFor(template) ??
			prettifySegment(template, params);
		crumbs.push({
			key: template,
			label,
			href: template === leafFullPath ? null : template,
			params,
		});
	}
	return crumbs;
}

export type CollapsedCrumbs = {
	shown: Crumb[];
	/** Crumbs collapsed behind the ellipsis dropdown, in original order. */
	hidden: Crumb[];
};

/**
 * Collapse long trails: keep the first and last two crumbs, hide the middle
 * ones behind an ellipsis. Short trails pass through untouched.
 */
export function collapseCrumbs(crumbs: readonly Crumb[], maxVisible = 4): CollapsedCrumbs {
	if (crumbs.length <= maxVisible) {
		return { shown: [...crumbs], hidden: [] };
	}
	return {
		shown: [crumbs[0]!, crumbs.at(-2)!, crumbs.at(-1)!],
		hidden: crumbs.slice(1, -2),
	};
}
