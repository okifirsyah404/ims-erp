import { DRIZZLE_TOKEN } from '@di/provider';
import {
	members,
	TOrganizationSelect,
	users,
	organizations,
} from '@drizzle/schemas/auth.schema';
import { TPaginationResult } from '@ims-erp/common';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	and,
	asc,
	count,
	eq,
	isNull,
} from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IOrganizationRepository,
	TMemberPaginationRequest,
	TOrganizationPaginationRequest,
} from '../contracts/organization.repository.interface';
import type { TOrganizationMember } from '../contracts/organization.contract';

/**
 * Drizzle implementation of {@link IOrganizationRepository} over the
 * Better Auth–owned `auth.organizations` / `auth.members` tables.
 *
 * @remarks
 * Write surface is limited to `deletedAt` (soft delete/restore). Membership
 * and organization profile mutations go through the Better Auth organization
 * API (see the auth gateway). Reads here are direct SQL so the module can
 * paginate, join users, and count owners without round-tripping Better Auth.
 */
@injectable()
export class OrganizationRepository implements IOrganizationRepository {
	constructor(
		@inject(DRIZZLE_TOKEN)
		private readonly db: BunSQLDatabase<Record<string, never>>,
	) {}

	async paginate(
		request: TOrganizationPaginationRequest,
	): Promise<TPaginationResult<TOrganizationSelect>> {
		const { page, limit, includeDeleted = false } = request;
		const base = this.db.select().from(organizations);
		const rows = includeDeleted
			? await base
					.orderBy(asc(organizations.createdAt))
					.limit(limit)
					.offset((page - 1) * limit)
			: await base
					.where(isNull(organizations.deletedAt))
					.orderBy(asc(organizations.createdAt))
					.limit(limit)
					.offset((page - 1) * limit);

		const [totalRow] = includeDeleted
			? await this.db.select({ value: count() }).from(organizations)
			: await this.db
					.select({ value: count() })
					.from(organizations)
					.where(isNull(organizations.deletedAt));

		return {
			meta: {
				page,
				limit,
				total: Number(totalRow?.value ?? 0),
				totalPages: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / limit)),
			},
			data: rows,
		};
	}

	async findById(id: string): Promise<TOrganizationSelect | null> {
		const [row] = await this.db
			.select()
			.from(organizations)
			.where(eq(organizations.id, id))
			.limit(1);
		return row ?? null;
	}

	async existsAny(): Promise<boolean> {
		const [row] = await this.db
			.select({ value: count() })
			.from(organizations)
			.limit(1);
		return Number(row?.value ?? 0) > 0;
	}

	async softDelete(id: string): Promise<void> {
		await this.db
			.update(organizations)
			.set({ deletedAt: new Date() })
			.where(and(eq(organizations.id, id), isNull(organizations.deletedAt)));
	}

	async restore(id: string): Promise<void> {
		await this.db
			.update(organizations)
			.set({ deletedAt: null })
			.where(eq(organizations.id, id));
	}

	async paginateMembers(
		organizationId: string,
		request: TMemberPaginationRequest,
	): Promise<TPaginationResult<TOrganizationMember>> {
		const { page, limit, role } = request;
		const conditions = [eq(members.organizationId, organizationId)];
		if (role) {
			// ponytail: exact single-role match only; comma-separated multi-role
			// members won't match a partial filter. Add SQL LIKE splitting when
			// multi-role members actually exist.
			conditions.push(eq(members.role, role));
		}

		const rows = await this.db
			.select({
				id: members.id,
				organizationId: members.organizationId,
				userId: members.userId,
				role: members.role,
				createdAt: members.createdAt,
				userName: users.name,
				userEmail: users.email,
				userImage: users.image,
			})
			.from(members)
			.leftJoin(users, eq(users.id, members.userId))
			.where(and(...conditions))
			.orderBy(asc(members.createdAt))
			.limit(limit)
			.offset((page - 1) * limit);

		const [totalRow] = await this.db
			.select({ value: count() })
			.from(members)
			.where(and(...conditions));

		return {
			meta: {
				page,
				limit,
				total: Number(totalRow?.value ?? 0),
				totalPages: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / limit)),
			},
			data: rows.map((row) => ({
				id: row.id,
				organizationId: row.organizationId,
				userId: row.userId,
				role: row.role,
				createdAt: row.createdAt,
				user:
					row.userName && row.userEmail
						? { name: row.userName, email: row.userEmail, image: row.userImage }
						: null,
			})),
		};
	}

	async findMemberById(
		organizationId: string,
		memberId: string,
	): Promise<TOrganizationMember | null> {
		const [row] = await this.db
			.select({
				id: members.id,
				organizationId: members.organizationId,
				userId: members.userId,
				role: members.role,
				createdAt: members.createdAt,
				userName: users.name,
				userEmail: users.email,
				userImage: users.image,
			})
			.from(members)
			.leftJoin(users, eq(users.id, members.userId))
			.where(
				and(eq(members.id, memberId), eq(members.organizationId, organizationId)),
			)
			.limit(1);
		if (!row) return null;
		return {
			id: row.id,
			organizationId: row.organizationId,
			userId: row.userId,
			role: row.role,
			createdAt: row.createdAt,
			user:
				row.userName && row.userEmail
					? { name: row.userName, email: row.userEmail, image: row.userImage }
					: null,
		};
	}

	async countOwners(organizationId: string): Promise<number> {
		const rows = await this.db
			.select({ role: members.role })
			.from(members)
			.where(eq(members.organizationId, organizationId));
		return rows.filter((row) => row.role.split(',').includes('owner')).length;
	}
}
