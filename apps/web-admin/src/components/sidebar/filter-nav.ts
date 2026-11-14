import type { Permission } from '@/lib/permissions';
import type { SidebarItem } from './sidebar-item';

export type NavContext = {
	/** True when every permission in the list is granted in the active organization. */
	can: (permissions: Permission[]) => boolean;
	isAppAdmin: boolean;
	/** True when the user holds an internal role in at least one organization. */
	hasInternalRole: boolean;
	/**
	 * True when the user is a person in charge of at least one live warehouse
	 * (ADR-0017).
	 *
	 * @remarks
	 * Resolved from `GET /warehouses/mine`, not from an organization
	 * permission: the grant is a table row and survives having no organization
	 * link at all.
	 */
	isPic: boolean;
};

/**
 * Whether one leaf item is visible. Deny by default: no `permission`, no
 * `open`, no `appAdminOnly`, and no `warehousePic` means hidden.
 */
export function leafVisible(item: SidebarItem, ctx: NavContext): boolean {
	if (item.appAdminOnly) return ctx.isAppAdmin;
	if (item.warehousePic) return ctx.isAppAdmin || ctx.isPic;
	if (item.open) return true;
	if (item.internalRole) return ctx.hasInternalRole;
	if (item.permission) {
		const list = Array.isArray(item.permission) ? item.permission : [item.permission];
		return ctx.can(list);
	}
	return false;
}

/** Every organization permission named anywhere in the nav tree (deduplicated). */
export function collectPermissions(sections: { items: SidebarItem[] }[]): Permission[] {
	const found = new Set<Permission>();
	const visit = (items: SidebarItem[]) => {
		for (const item of items) {
			if (item.permission) {
				for (const p of Array.isArray(item.permission) ? item.permission : [item.permission]) {
					found.add(p);
				}
			}
			if (item.items) visit(item.items);
		}
	};
	for (const section of sections) visit(section.items);
	return [...found];
}

/**
 * Nav leaf governing a pathname, or null. Longest matching url wins; `/`
 * matches only itself.
 */
export function findNavLeaf(
	sections: { items: SidebarItem[] }[],
	pathname: string,
): SidebarItem | null {
	const all = sections.flatMap((section) => section.items.flatMap(leavesOf));
	let best: SidebarItem | null = null;
	for (const leaf of all) {
		const url = leaf.url;
		if (!url) continue;
		const matches =
			url === '/' ? pathname === '/' : pathname === url || pathname.startsWith(`${url}/`);
		if (matches && url.length > (best?.url?.length ?? -1)) best = leaf;
	}
	return best;
}

function leavesOf(item: SidebarItem): SidebarItem[] {
	return item.items ? item.items.flatMap(leavesOf) : [item];
}

/**
 * Pure nav filter (UX only; the backend enforces every route).
 *
 * @remarks
 * A parent with children stays only while at least one child passes. A parent
 * without children follows the leaf rule. Sections with no visible item are
 * dropped.
 */
export function filterNav<S extends { items: SidebarItem[] }>(
	sections: S[],
	ctx: NavContext,
): S[] {
	return sections
		.map((section) => ({
			...section,
			items: section.items.flatMap((item) => {
				if (item.items) {
					const children = item.items.filter((child) => leafVisible(child, ctx));
					return children.length > 0 ? [{ ...item, items: children }] : [];
				}
				return leafVisible(item, ctx) ? [item] : [];
			}),
		}))
		.filter((section) => section.items.length > 0);
}
