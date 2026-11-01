import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { TPermissionGrant } from '../contracts/admin.contract';
import { DRIZZLE_TOKEN } from '@di/tokens';
import { members } from '@drizzle/schemas/auth.schema';
import { roles, type TRoleSelect } from '@drizzle/schemas/role.schema';
import type { TRoleListRequest, IRoleRepository } from '../contracts/repositories.interface';

/**
 * Drizzle implementation of {@link IRoleRepository} over the per-organization
 * role master data (`auth.roles`). Reads exclude soft-deleted rows; delete
 * is a soft delete so a name can be reused afterwards.
 */
@injectable()
export class RoleRepository implements IRoleRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async list(request: TRoleListRequest): Promise<TRoleSelect[]> {
		return this.database
			.select()
			.from(roles)
			.where(
				and(
					eq(roles.organizationId, request.organizationId),
					request.includeDeleted ? undefined : isNull(roles.deletedAt),
				),
			)
			.orderBy(asc(roles.rank), asc(roles.name));
	}

	async findById(roleId: string): Promise<TRoleSelect | null> {
		const [row] = await this.database
			.select()
			.from(roles)
			.where(and(eq(roles.id, roleId), isNull(roles.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findByName(
		organizationId: string,
		name: string,
	): Promise<TRoleSelect | null> {
		const [row] = await this.database
			.select()
			.from(roles)
			.where(
				and(
					eq(roles.organizationId, organizationId),
					eq(roles.name, name),
					isNull(roles.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findByNameIncludingDeleted(
		organizationId: string,
		name: string,
	): Promise<TRoleSelect | null> {
		const [row] = await this.database
			.select()
			.from(roles)
			.where(
				and(
					eq(roles.organizationId, organizationId),
					eq(roles.name, name),
					isNotNull(roles.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async create(input: {
		organizationId: string;
		name: string;
		rank: number;
		permissions: TPermissionGrant;
		isSystem: boolean;
	}): Promise<TRoleSelect> {
		const [row] = await this.database
			.insert(roles)
			.values({
				id: crypto.randomUUID(),
				organizationId: input.organizationId,
				name: input.name,
				rank: input.rank,
				permissions: input.permissions,
				isSystem: input.isSystem,
			})
			.returning();
		return row;
	}

	async update(
		roleId: string,
		patch: {
			name?: string;
			rank?: number;
			permissions?: TPermissionGrant;
		},
	): Promise<TRoleSelect> {
		// Deliberately NOT filtered on `deletedAt`: `create` revives a
		// soft-deleted role by updating it in place before undelete, so a
		// live-only predicate here would match zero rows, return `undefined`
		// and crash the caller. Whether a role may be edited is decided by
		// the service (rank guard, system-role rules), not by this query.
		const [row] = await this.database
			.update(roles)
			.set({ ...patch, updatedAt: new Date() })
			.where(eq(roles.id, roleId))
			.returning();
		return row;
	}

	async softDelete(roleId: string): Promise<void> {
		await this.database
			.update(roles)
			.set({ deletedAt: new Date() })
			.where(and(eq(roles.id, roleId), isNull(roles.deletedAt)));
	}

	async undelete(roleId: string): Promise<void> {
		await this.database
			.update(roles)
			.set({ deletedAt: null })
			.where(and(eq(roles.id, roleId), isNotNull(roles.deletedAt)));
	}

	async countMembers(organizationId: string, roleName: string): Promise<number> {
		const rows = await this.database
			.select({ userId: members.userId })
			.from(members)
			.where(
				and(
					eq(members.organizationId, organizationId),
					eq(members.role, roleName),
				),
			);
		return rows.length;
	}
}
