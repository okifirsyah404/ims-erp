import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import {
	members,
	TOrganizationSelect,
	users,
	organizations,
} from '@drizzle/schemas/auth.schema';
import { warehouseOrganizations } from '@drizzle/schemas/inventory.schema';
import { TPaginationResult } from '@ims-erp/common';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	and,
	asc,
	count,
	eq,
	inArray,
	isNull,
} from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { cacheIdKey } from '@utils/cache.util';
import type { ICacheClient } from '@cache/cache.client';
import type {
	IOrganizationRepository,
	TMemberPaginationRequest,
	TOrganizationPaginationRequest,
	TOrganizationWithCounts,
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
 *
 * @remarks
 * Only `findById` is cached (cache-aside, 5-minute TTL, key
 * `organization:id:{id}`) and it includes soft-deleted rows, matching the
 * interface contract. Member reads (`countOwners`, `findMemberById`,
 * `paginateMembers`) are never cached: membership mutations happen through
 * the Better Auth organization API outside this repository, so there would
 * be no invalidation hook. `softDelete`/`restore` invalidate `findById`.
 */
@injectable()
export class OrganizationRepository implements IOrganizationRepository {
	constructor(
		@inject(DRIZZLE_TOKEN)
		private readonly db: BunSQLDatabase<Record<string, never>>,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	/** Redis key namespace; only the `findById` read is cached. */
	private readonly cachePrefix = 'organization';

	/**
	 * Paginated organization listing, ordered by creation time.
	 *
	 * @param request - Page settings; `includeDeleted` widens the window to
	 * soft-deleted rows (admin-visibility escape hatch)
	 */
	async paginate(
		request: TOrganizationPaginationRequest,
	): Promise<TPaginationResult<TOrganizationWithCounts>> {
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

		const withCounts = await this.attachCounts(rows);

		return {
			meta: {
				page,
				limit,
				total: Number(totalRow?.value ?? 0),
				totalPages: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / limit)),
			},
			data: withCounts,
		};
	}

	/**
	 * Enriches a page of organization rows with aggregate counts.
	 *
	 * Grouped queries limited to the page's org ids (no N+1): live member rows
	 * and live warehouse links (`warehouseOrganizations`). `projectCount` is
	 * a reserved placeholder (0) until a projects concept exists.
	 */
	private async attachCounts(
		rows: TOrganizationSelect[],
	): Promise<TOrganizationWithCounts[]> {
		const ids = rows.map((row) => row.id);
		const membersCount = new Map<string, number>();
		const warehousesCount = new Map<string, number>();

		if (ids.length > 0) {
			const memberRows = await this.db
				.select({
					organizationId: members.organizationId,
					value: count(),
				})
				.from(members)
				.where(inArray(members.organizationId, ids))
				.groupBy(members.organizationId);
			for (const row of memberRows) {
				membersCount.set(row.organizationId, Number(row.value));
			}

			const warehouseRows = await this.db
				.select({
					organizationId: warehouseOrganizations.organizationId,
					value: count(),
				})
				.from(warehouseOrganizations)
				.where(
					and(
						inArray(warehouseOrganizations.organizationId, ids),
						isNull(warehouseOrganizations.deletedAt),
					),
				)
				.groupBy(warehouseOrganizations.organizationId);
			for (const row of warehouseRows) {
				warehousesCount.set(row.organizationId, Number(row.value));
			}
		}

		return rows.map((row) => ({
			...row,
			membersCount: membersCount.get(row.id) ?? 0,
			warehousesCount: warehousesCount.get(row.id) ?? 0,
			projectCount: 0,
		}));
	}

	/**
	 * Finds one organization by id, soft-deleted rows included.
	 *
	 * @remarks
	 * The only cached read in this repository (cache-aside with negative
	 * caching: an absent row is cached as the literal string `'null'`).
	 * Because `findById` includes deleted rows, `softDelete`/`restore` must
	 * invalidate — handled via {@link invalidate}.
	 *
	 * @returns The organization, or `null` when absent
	 */
	async findById(id: string): Promise<TOrganizationSelect | null> {
		return this.cache.remember(cacheIdKey(this.cachePrefix, id), async () => {
			const [row] = await this.db
				.select()
				.from(organizations)
				.where(eq(organizations.id, id))
				.limit(1);
			return row ?? null;
		});
	}

	/** Live rows only: a soft-deleted organization cannot receive invites. */
	async findBySlug(slug: string): Promise<TOrganizationSelect | null> {
		const [row] = await this.db
			.select()
			.from(organizations)
			.where(and(eq(organizations.slug, slug), isNull(organizations.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Counts live (non-soft-deleted) organizations. Backs the
	 * last-organization guard so an operator can never delete the final
	 * usable organization and strand every member on a dead context.
	 */
	async countActive(): Promise<number> {
		const [row] = await this.db
			.select({ value: count() })
			.from(organizations)
			.where(isNull(organizations.deletedAt));
		return Number(row?.value ?? 0);
	}

	/**
	 * Soft-deletes an organization by stamping `deletedAt`. No-op when
	 * already deleted.
	 */
	async softDelete(id: string): Promise<void> {
		await this.db
			.update(organizations)
			.set({ deletedAt: new Date() })
			.where(and(eq(organizations.id, id), isNull(organizations.deletedAt)));
		await this.invalidate(id);
	}

	/**
	 * Restores a soft-deleted organization by clearing `deletedAt`.
	 */
	async restore(id: string): Promise<void> {
		await this.db
			.update(organizations)
			.set({ deletedAt: null })
			.where(eq(organizations.id, id));
		await this.invalidate(id);
	}

	/**
	 * Evicts the per-id cache entry used by {@link findById}.
	 */
	private async invalidate(id: string): Promise<void> {
		await this.cache.del(cacheIdKey(this.cachePrefix, id));
	}

	/**
	 * Paginated member list joined with user identity fields.
	 *
	 * @remarks
	 * Never cached: membership mutations happen through the Better Auth
	 * organization API outside this repository, so there is no invalidation
	 * hook to keep a cache coherent.
	 *
	 * @param organizationId - The organization whose members are listed
	 * @param request - Page settings plus an optional exact role filter
	 */
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

	/**
	 * Finds one member of an organization (for last-owner checks). Never
	 * cached, same reasoning as {@link paginateMembers}.
	 *
	 * @returns The member with joined user identity, or `null` when the
	 * member does not belong to the organization
	 */
	async findMemberRole(organizationId: string, userId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ role: members.role })
			.from(members)
			.where(and(eq(members.organizationId, organizationId), eq(members.userId, userId)))
			.limit(1);
		return row?.role ?? null;
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

	/**
	 * Counts members whose role list includes `owner`.
	 *
	 * @remarks
	 * Roles are compared in JS (not SQL) because Better Auth stores
	 * multi-role members as comma-separated strings.
	 */
	async countOwners(organizationId: string): Promise<number> {
		const rows = await this.db
			.select({ role: members.role })
			.from(members)
			.where(eq(members.organizationId, organizationId));
		return rows.filter((row) => row.role.split(',').includes('owner')).length;
	}
}
