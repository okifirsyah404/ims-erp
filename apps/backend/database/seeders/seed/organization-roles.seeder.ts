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
 * Guardian for the closed organization-role Postgres enum type
 * (`auth.organization_role`).
 *
 * Roles are a closed enum: the 19 values of `erpRoleNames` from
 * `@ims-erp/common`, stored as a native Postgres enum (see
 * `drizzle/schemas/role.schema.ts` and the migration that created it).
 * There is no per-organization role master data to seed any more.
 *
 * This seeder's only job is to keep the database enum type in sync with the
 * code catalog:
 * - Creates the type when it is missing (`CREATE TYPE` has no
 *   `IF NOT EXISTS`, hence the guarded `DO` block).
 * - Adds any catalog value the type does not have yet
 *   (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`), so adding a role to
 *   `erpRoleNames` needs no hand-written migration.
 */
export async function seedOrganizationRoles(): Promise<void> {
	// Enum labels are catalog constants, not user input: quote+escape them
	// inline (Postgres does not accept bind parameters in DDL).
	const label = (value: string): string => `'${value.replaceAll("'", "''")}'`;
	const labels = erpRoleNames.map(label).join(', ');

	await drizzleDB.execute(
		sql.raw(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1
					FROM pg_type t
					JOIN pg_namespace n ON n.oid = t.typnamespace
					WHERE t.typname = 'organization_role'
					  AND n.nspname = 'auth'
				) THEN
					CREATE TYPE "auth"."organization_role" AS ENUM (${labels});
				END IF;
			END
			$$;
		`),
	);

	for (const role of erpRoleNames) {
		await drizzleDB.execute(
			sql.raw(
				`ALTER TYPE "auth"."organization_role" ADD VALUE IF NOT EXISTS ${label(role)}`,
			),
		);
	}

	logger.info(
		{ roles: erpRoleNames.length },
		'organization_role enum type verified',
	);
}
