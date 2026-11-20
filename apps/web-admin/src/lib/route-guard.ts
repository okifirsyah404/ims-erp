import type { QueryClient } from '@tanstack/react-query';
import { navSections } from '@/components/sidebar/nav-config';
import { findNavLeaf, leafVisible } from '@/components/sidebar/filter-nav';
import type { SidebarItem } from '@/components/sidebar/sidebar-item';
import { hasRole } from '@ims-erp/common';
import { hasInternalRole } from '@/lib/internal-role';
import { myOrganizationsQueryOptions } from '@/lib/organization-api';
import type { Permission } from '@/lib/permissions';
import { myWarehousesQueryOptions } from '@/lib/warehouse-api';
import { orgPermissionQueryOptions } from '@/components/sidebar/use-nav-permissions';

type GuardSession = {
	user: { role?: string | null };
	session: { userId: string; activeOrganizationId?: string | null };
};

/**
 * Whether the pathname may render, using the same nav rules as the sidebar.
 *
 * @remarks
 * `/` is always allowed: the Dashboard component renders empty for users
 * without an internal role, so redirecting there would loop. A path no nav
 * leaf covers is allowed here; the backend still enforces it. Lookup errors
 * deny (fail closed).
 */
export async function canOpenPath(
	pathname: string,
	session: GuardSession,
	queryClient: QueryClient,
): Promise<boolean> {
	// Creating an organization is platform administration, not an org
	// permission: the nav leaf for `/organizations` only carries
	// `organization.read`.
	if (pathname === '/organizations/new') return hasRole(session.user.role, 'admin');

	// Same reasoning for a new warehouse: a person-in-charge grant carries
	// `read`/`update`/`archive`/`import`/`export` but never `create`
	// (ADR-0017 §2, plan decision 22), so the page behind this path would only
	// render a "not allowed" card for a PIC.
	if (pathname === '/warehouses/new') {
		return hasRole(session.user.role, 'admin');
	}

	const leaf: SidebarItem | null = findNavLeaf(navSections, pathname);
	if (!leaf || leaf.url === '/') return true;

	try {
		const isAppAdmin = hasRole(session.user.role, 'admin');
		const orgs = await queryClient.ensureQueryData(myOrganizationsQueryOptions);
		const activeOrgId = session.session.activeOrganizationId ?? '';

		const permissions = [
			...(Array.isArray(leaf.permission) ? leaf.permission : leaf.permission ? [leaf.permission] : []),
			...(leaf.anyPermission ?? []),
		];
		const granted = new Set<Permission>();
		if (activeOrgId) {
			await Promise.all(
				permissions.map(async (permission) => {
					const ok = await queryClient.fetchQuery(
						orgPermissionQueryOptions(session.session.userId, activeOrgId, permission),
					);
					if (ok) granted.add(permission);
				}),
			);
		}

		return leafVisible(leaf, {
			can: (list) => list.every((p) => granted.has(p)),
			isAppAdmin,
			hasInternalRole: orgs.some((org) => hasInternalRole(org.role)),
			isPic: await isWarehousePic(queryClient, leaf, isAppAdmin),
		});
	} catch {
		return false;
	}
}

/**
 * Whether the caller is a person in charge of at least one live warehouse.
 *
 * @remarks
 * Only asked for a leaf that declares `warehousePic`, and never for an app
 * admin (who passes that leaf anyway): a grant query on every navigation would
 * be a wasted round trip for everyone else.
 */
async function isWarehousePic(
	queryClient: QueryClient,
	leaf: SidebarItem,
	isAppAdmin: boolean,
): Promise<boolean> {
	if (!leaf.warehousePic || isAppAdmin) return false;
	const warehouses = await queryClient.ensureQueryData(myWarehousesQueryOptions());
	return warehouses.length > 0;
}
