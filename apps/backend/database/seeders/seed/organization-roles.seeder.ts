import { drizzleDB } from '../../../drizzle/db';
import {
	organizations,
} from '../../../drizzle/schemas/auth.schema';
import {
	roles as rolesTable,
} from '../../../drizzle/schemas/role.schema';
import { erpRoleGrants, erpRoleNames } from '@ims-erp/common';
import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Escalation-guard ranks for the seeded system roles. Custom roles created
 * at runtime must rank below their creator's role rank (enforced in the
 * user-management module).
 */
export const SYSTEM_ROLE_RANKS: Record<string, number> = {
	owner: 100,
	admin: 80,
	hr: 60,
	member: 10,
};

const DEFAULT_CATALOG_RANK = 50;

/**
 * Idempotent per-organization role seeder: materializes the shared role
 * catalog (`erpRoleNames` / `erpRoleGrants` from @ims-erp/common) as
 * `auth.roles` master data for every organization.
 *
 * - Existence check is the live (non-soft-deleted) `(orgId, name)` row
 *   itself: missing rows are inserted, existing rows are left untouched
 *   (re-runs never overwrite admin-edited permissions).
 * - `isSystem = true`: catalog roles cannot be deleted through the role
 *   management API; permissions remain editable by owner/app admin.
 * - Role semantics stay single-sourced in the shared catalog; this seeder
 *   only copies them into per-org master data (role-as-master-data, so
 *   invitation role validation is a DB lookup, not a code constant).
 */
export async function seedOrganizationRoles(): Promise<void> {
	const orgs = await drizzleDB
		.select({ id: organizations.id, name: organizations.name })
		.from(organizations);

	if (orgs.length === 0) {
		logger.info('No organizations; skipping role seeding');
		return;
	}

	let inserted = 0;
	for (const org of orgs) {
		for (const roleName of erpRoleNames) {
			const [existing] = await drizzleDB
				.select({ id: rolesTable.id })
				.from(rolesTable)
				.where(
					and(
						eq(rolesTable.organizationId, org.id),
						eq(rolesTable.name, roleName),
						isNull(rolesTable.deletedAt),
					),
				)
				.limit(1);

			if (existing) continue;

			await drizzleDB.insert(rolesTable).values({
				id: crypto.randomUUID(),
				organizationId: org.id,
				name: roleName,
				rank: SYSTEM_ROLE_RANKS[roleName] ?? DEFAULT_CATALOG_RANK,
				permissions: erpRoleGrants[roleName],
				isSystem: true,
			});
			inserted += 1;
		}
	}

	logger.info(
		{ organizations: orgs.length, rolesInserted: inserted },
		'Organization role seeding complete',
	);
}

/**
 * Re-syncs EXISTING catalog (system) role rows with the shared catalog
 * grants. Used when the catalog itself changed (e.g. the built-in
 * organization statements were merged into it) and already-seeded
 * organizations must pick the new grants up.
 *
 * Deliberately separate from the seeder: the seeder never overwrites
 * existing rows, because system-role permissions stay admin-editable.
 * Custom roles (names outside the catalog) are never touched.
 *
 * @returns number of rows updated
 */
export async function refreshSystemRoleGrants(): Promise<number> {
	let updated = 0;

	for (const roleName of erpRoleNames) {
		const grants = erpRoleGrants[roleName];
		const rows = await drizzleDB
			.select({ id: rolesTable.id, permissions: rolesTable.permissions })
			.from(rolesTable)
			.where(
				and(
					eq(rolesTable.name, roleName),
					eq(rolesTable.isSystem, true),
					isNull(rolesTable.deletedAt),
				),
			);

		for (const row of rows) {
			if (sameGrants(row.permissions, grants)) continue;
			await drizzleDB
				.update(rolesTable)
				.set({ permissions: grants })
				.where(eq(rolesTable.id, row.id));
			updated += 1;
		}
	}

	logger.info({ rolesUpdated: updated }, 'System role grants refreshed');
	return updated;
}

/** Compares two grant maps ignoring action order. */
function sameGrants(
	a: Record<string, readonly string[]> | null | undefined,
	b: Record<string, readonly string[]>,
): boolean {
	if (!a) return false;
	const aKeys = Object.keys(a).sort();
	const bKeys = Object.keys(b).sort();
	if (aKeys.length !== bKeys.length) return false;
	if (aKeys.some((key, index) => key !== bKeys[index])) return false;
	return aKeys.every((key) => {
		const left = [...(a[key] ?? [])].sort();
		const right = [...(b[key] ?? [])].sort();
		return (
			left.length === right.length &&
			left.every((action, index) => action === right[index])
		);
	});
}
