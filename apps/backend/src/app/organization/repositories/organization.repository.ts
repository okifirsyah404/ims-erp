import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import {
	members,
	TOrganizationSelect,
	users,
	organizations,
} from '@drizzle/schemas/auth.schema';
import { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	and,
	asc,
	count,
	eq,
	inArray,
	isNull,
	sql,
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

	/** Live organizations where `userId` is a member, with that member's role. */
	async listMemberRoles(): Promise<{ organizationId: string; userId: string; role: string }[]> {
		return this.db
			.select({ organizationId: members.organizationId, userId: members.userId, role: members.role })
			.from(members)
			.innerJoin(organizations, eq(members.organizationId, organizations.id))
			.where(isNull(organizations.deletedAt));
	}

	async findMembershipsForUser(
		userId: string,
	): Promise<{ organization: TOrganizationSelect; role: string }[]> {
		const rows = await this.db
			.select({ organization: organizations, role: members.role })
			.from(members)
			.innerJoin(organizations, eq(members.organizationId, organizations.id))
			.where(and(eq(members.userId, userId), isNull(organizations.deletedAt)))
			.orderBy(asc(organizations.createdAt));
		return rows;
	}

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

		return paginationResult({ page, limit }, Number(totalRow?.value ?? 0), withCounts);
	}

	/**
	 * Enriches a page of organization rows with aggregate counts.
	 *
	 * @remarks
	 * Grouped query limited to the page's org ids (no N+1): live member rows.
	 *
	 * `warehousesCount` is **not** computed here any more: this repository used
	 * to import `inventory.schema`, which is a cross-module boundary violation
	 * (ADR-0024 P1). Warehouse links are read through
	 * `ExportedWarehouseService` (inventory) injected into the service, and the
	 * service fills the count. Until that wiring lands the value stays 0.
	 * `projectCount` is a reserved placeholder until a projects concept exists.
	 */
	private async attachCounts(
		rows: TOrganizationSelect[],
	): Promise<TOrganizationWithCounts[]> {
		const ids = rows.map((row) => row.id);
		const membersCount = new Map<string, number>();

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
		}

		return rows.map((row) => ({
			...row,
			membersCount: membersCount.get(row.id) ?? 0,
			warehousesCount: 0,
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
		await this.invalidateCache(id);
	}

	/**
	 * Restores a soft-deleted organization by clearing `deletedAt`.
	 */
	async restore(id: string): Promise<void> {
		await this.db
			.update(organizations)
			.set({ deletedAt: null })
			.where(eq(organizations.id, id));
		await this.invalidateCache(id);
	}

	/**
	 * Sets `logo` to an object key (or `null`) and invalidates the cache.
	 * Service write path (upload / clear); see the interface note.
	 */
	async setLogo(id: string, logo: string | null): Promise<void> {
		await this.db
			.update(organizations)
			.set({ logo })
			.where(eq(organizations.id, id));
		await this.invalidateCache(id);
	}

	/**
	 * Sets `logo` only when it is still empty.
	 *
	 * @remarks
	 * The `logo IS NULL` predicate is what makes the generated-fallback worker
	 * safe: its earlier `findById` may already be stale, so the check has to
	 * live in the UPDATE rather than in the caller.
	 */
	async setLogoIfEmpty(id: string, logo: string): Promise<boolean> {
		const updated = await this.db
			.update(organizations)
			.set({ logo })
			.where(and(eq(organizations.id, id), isNull(organizations.logo)))
			.returning({ id: organizations.id });
		if (updated.length === 0) return false;
		await this.invalidateCache(id);
		return true;
	}

	/**
	 * Evicts the per-id cache entry used by {@link findById}.
	 */
	async invalidateCache(id: string): Promise<void> {
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
			// Multi-role members are comma-joined (ERP-0041); the wrapped list
			// matches a whole entry, not a substring ('sales' does not match
			// 'sales_manager').
			conditions.push(
				sql`(',' || ${members.role} || ',') LIKE ${`%,${role},%`}`,
			);
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

		return paginationResult(
			{ page, limit },
			Number(totalRow?.value ?? 0),
			rows.map((row) => ({
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
		);
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
