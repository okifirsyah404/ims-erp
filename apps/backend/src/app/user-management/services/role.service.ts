import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE_TOKEN } from '@di/provider';
import { roles, type TRoleSelect } from '@drizzle/schemas/role.schema';
import { RoleNotFoundError } from './invitation.errors';

/**
 * Read-only access to the per-org role master data (`auth.roles`). Seeded
 * from the shared ERP catalog; owner/app-admin CRUD arrives with phase 3.
 */
@injectable()
export class RoleService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async findById(roleId: string): Promise<TRoleSelect | null> {
		const [role] = await this.database
			.select()
			.from(roles)
			.where(and(eq(roles.id, roleId), isNull(roles.deletedAt)))
			.limit(1);
		return role ?? null;
	}

	/**
	 * Resolves a live role for an organization.
	 *
	 * @throws RoleNotFoundError when the role does not exist in this org's
	 * master data (single-invite path rejects typos; the bulk path falls
	 * back to `member` upstream)
	 */
	async requireRoleForOrganization(
		roleId: string,
		organizationId: string,
	): Promise<TRoleSelect> {
		const role = await this.findById(roleId);
		if (!role || role.organizationId !== organizationId) {
			throw new RoleNotFoundError(roleId);
		}
		return role;
	}

	/** Resolves the org's `member` role (bulk typo fallback). */
	async findMemberRole(organizationId: string): Promise<TRoleSelect | null> {
		const [role] = await this.database
			.select()
			.from(roles)
			.where(
				and(
					eq(roles.organizationId, organizationId),
					eq(roles.name, 'member'),
					isNull(roles.deletedAt),
				),
			)
			.limit(1);
		return role ?? null;
	}
}
