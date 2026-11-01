/**
 * Drizzle-backed {@link IPermissionResolver} (phase 3, decision D4).
 *
 * Unions the `permissions` grants of the caller's live `auth.roles` rows for
 * the validated organization. Fallback: when NO live row matches the member's
 * role names (legacy members created before the role table), the static shared
 * catalog (`authorizeErpPermissions`) decides - an org WITH matching dynamic
 * rows never falls back, its grant set is authoritative.
 */
import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { ErpPermissionRequest } from '@ims-erp/common';
import { DRIZZLE_TOKEN } from '@di/tokens';
import { roles } from '@drizzle/schemas/role.schema';
import { authorizeErpPermissions } from '@providers/better-auth/ac/organization-ac';
import { grantsAllow, type IPermissionResolver } from './permission-resolver';

@injectable()
export class DynamicPermissionResolver implements IPermissionResolver {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async hasPermission(
		organizationId: string,
		roleNames: readonly string[],
		request: ErpPermissionRequest,
	): Promise<boolean> {
		if (roleNames.length === 0) return false;

		const rows = await this.database
			.select({ name: roles.name, permissions: roles.permissions })
			.from(roles)
			.where(
				and(
					eq(roles.organizationId, organizationId),
					inArray(roles.name, [...roleNames]),
					isNull(roles.deletedAt),
				),
			);

		if (rows.length === 0) {
			return authorizeErpPermissions(roleNames, request);
		}

		return grantsAllow(
			rows.map((row) => row.permissions),
			request,
		);
	}
}
