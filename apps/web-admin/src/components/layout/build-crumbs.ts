/**
 * Pure breadcrumb-crumb derivation from TanStack Router match objects.
 * Kept free of React so it can be unit-tested without a DOM.
 */
import type { NavKey } from '@ims-erp/locales';

export type CrumbMatch = {
	/** Full route id, e.g. `/_authed/organizations/$organizationId`. */
	routeId: string;
	/** URL path template, e.g. `/organizations/$organizationId`. */
	fullPath: string;
	params: Record<string, string | undefined>;
	/**
	 * Route-level `staticData`; a `crumb` value overrides every fallback.
	 * The value is an i18next key in the `nav` namespace, not display text —
	 * this module stays React-free, so it never calls `t` itself.
	 */
	staticData?: { crumb?: NavKey } | undefined;
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

/** Static labels keyed by fullPath template. Values are `nav` i18next keys. */
const LABELS: Record<string, NavKey> = {
	'/': 'breadcrumb.home',
	'/organizations/': 'breadcrumb.organizations',
	'/organizations/new': 'breadcrumb.organizationNew',
	'/organizations/$organizationId/edit': 'breadcrumb.organizationEdit',
	'/organizations/$organizationId/members/new': 'breadcrumb.memberNew',
	'/organizations/$organizationId/members/$memberId/edit':
		'breadcrumb.memberEdit',
	'/admin/settings': 'item.settings',
	'/admin/settings/numbering': 'item.documentNumbering',
	'/inventory/categories': 'item.itemCategories',
	'/crm/customers': 'item.customers',
	'/crm/leads': 'item.leads',
	'/sales': 'item.sales',
	'/sales/quotes': 'item.quotes',
	'/sales/orders': 'item.salesOrders',
	'/sales/deliveries': 'item.deliveryNotes',
	'/sales/deliveries/new': 'breadcrumb.deliveryNoteNew',
	'/sales/deliveries/$deliveryNoteId/print': 'breadcrumb.print',
	'/procurement': 'item.procurement',
	'/procurement/suppliers': 'item.suppliers',
	'/procurement/purchase-orders': 'item.purchaseOrders',
	'/procurement/purchase-orders/new': 'breadcrumb.purchaseOrderNew',
	'/procurement/receipts': 'item.goodsReceipts',
	'/procurement/receipts/new': 'breadcrumb.goodsReceiptNew',
	'/procurement/purchase-orders/$purchaseOrderId/edit': 'breadcrumb.quotationEdit',
	'/procurement/purchase-orders/$purchaseOrderId/print': 'breadcrumb.print',
	'/sales/quotes/new': 'breadcrumb.quotationNew',
	'/sales/quotes/$quotationId/edit': 'breadcrumb.quotationEdit',
	'/sales/quotes/$quotationId/print': 'breadcrumb.print',
};

/**
 * Optional dynamic labels. Return a label, or `undefined` to fall through to LABELS/prettify.
 */
export type CrumbEnricher = (
	fullPath: string,
	params: Record<string, string | undefined>,
) => string | undefined;

/**
 * Resolves a `nav` i18next key to display text. Injected rather than imported
 * so this module stays free of React/i18n and unit-testable without a DOM.
 */
export type CrumbTranslator = (key: NavKey) => string;

function labelFor(template: string): NavKey | undefined {
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
	translate: CrumbTranslator,
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
		return [
			{ key: 'home', label: translate(LABELS['/']!), href: null, params: {} },
		];
	}

	const crumbs: Crumb[] = [
		{ key: 'home', label: translate(LABELS['/']!), href: '/', params: {} },
	];
	for (const template of templates) {
		// Route-level `staticData.crumb` is a key; derive display text from it.
		const staticCrumb = visible.find(
			(match) => match.fullPath === template,
		)?.staticData?.crumb;
		const label =
			(staticCrumb ? translate(staticCrumb) : undefined) ??
			enrich?.(template, params) ??
			(labelFor(template) ? translate(labelFor(template)!) : undefined) ??
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
