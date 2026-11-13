import type { Permission } from '@/lib/permissions';
import type { SidebarItem } from './sidebar-item';

export type NavContext = {
	/** True when every permission in the list is granted in the active organization. */
	can: (permissions: Permission[]) => boolean;
	isAppAdmin: boolean;
	/** True when the user holds an internal role in at least one organization. */
	hasInternalRole: boolean;
};

/**
 * Whether one leaf item is visible. Deny by default: no `permission`, no
 * `open`, and no `appAdminOnly` means hidden.
 */
function leafVisible(item: SidebarItem, ctx: NavContext): boolean {
	if (item.appAdminOnly) return ctx.isAppAdmin;
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
