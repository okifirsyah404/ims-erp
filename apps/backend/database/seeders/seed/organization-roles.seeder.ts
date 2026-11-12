import { drizzleDB } from '../../../drizzle/db';
import { erpRoleNames } from '@ims-erp/common';
import { sql } from 'drizzle-orm';
import pino from 'pino';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Verifies the org-role storage shape for the closed ERP role catalog.
 *
 * @remarks
 * Since ERP-0041, roles are stored comma-joined in plain `text` columns
 * (`auth.members.role` — Better Auth-owned — and `auth.user_invitations`
 * `org_role`). The old Postgres enum type `auth.organization_role` is
 * dropped by the ERP-0041 migration; this seeder's remaining job is to
 * check the enum type is really gone and to log the closed catalog, so a
 * stale database is reported loudly instead of silently diverging from the
 * `erpRoleNames` catalog in `@ims-erp/common`.
 */
export async function seedOrganizationRoles(): Promise<void> {
	const stale = await drizzleDB.execute<{ count: string }>(
		sql.raw(`
			SELECT count(*)::text AS count
			FROM pg_type t
			JOIN pg_namespace n ON n.oid = t.typnamespace
			WHERE t.typname = 'organization_role'
			  AND n.nspname = 'auth'
		`),
	);
	const rows = (stale as unknown as { rows?: Array<{ count: string }> }).rows ?? [];
	if ((rows[0]?.count ?? '0') !== '0') {
		logger.warn(
			'organization_role enum type still exists (pre-ERP-0041 database); run the ERP-0041 migration to drop it',
		);
	}

	logger.info(
		{ roles: erpRoleNames.length, storage: 'text comma-joined' },
		'organization role catalog verified',
	);
}
