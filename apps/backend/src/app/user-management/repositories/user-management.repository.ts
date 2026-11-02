import { DRIZZLE_TOKEN, REDIS_TOKEN } from '@di/provider';
import { RedisClient } from 'bun';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	and,
	count,
	desc,
	eq,
	ilike,
	inArray,
	isNotNull,
	isNull,
	ne,
	or,
} from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import type { TUserSelect } from '@drizzle/schemas/auth.schema';
import { members, organizations, users } from '@drizzle/schemas/auth.schema';
import type {
	IUserManagementRepository,
	TAdminUserRow,
	TUserListRequest,
} from '../contracts/repositories.interface';
import {
	USER_CACHE_PREFIX,
	userCacheKey,
	userListCacheKey,
} from '../../user/constants/cache';

/**
 * Drizzle implementation of {@link IUserManagementRepository}: the
 * user-management module's write surface over `auth.users` is limited to
 * the lifecycle columns it owns (`status`, `phone`, `deletedAt`) plus the
 * invitation-time pre-creation (name + email, no credentials). Passwords,
 * usernames, and every other Better Auth-owned column flow through the
 * auth gateway, never through here.
 */
@injectable()
export class UserManagementRepository implements IUserManagementRepository {
	/**
	 * Prefix shared with {@link import('../../user/repositories/user.repository').UserRepository}.
	 * Both repositories cache/`auth.users` reads under `user:*` keys, so a
	 * write through this one must evict the same keys or the read side serves
	 * a stale row for up to {@link USER_CACHE_TTL_SECONDS}.
	 */
	private readonly cachePrefix = USER_CACHE_PREFIX;

	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(REDIS_TOKEN) private readonly redisClient: RedisClient,
	) {}

	async findById(id: string): Promise<TUserSelect | null> {
		const [row] = await this.database
			.select()
			.from(users)
			.where(and(eq(users.id, id), isNull(users.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findByEmail(email: string): Promise<TUserSelect | null> {
		const [row] = await this.database
			.select()
			.from(users)
			.where(and(ilike(users.email, email), isNull(users.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async isUsernameAvailable(username: string): Promise<boolean> {
		const [row] = await this.database
			.select({ id: users.id })
			.from(users)
			.where(and(ilike(users.username, username), isNull(users.deletedAt)))
			.limit(1);
		return !row;
	}

	async isPhoneAvailable(phone: string): Promise<boolean> {
		const [row] = await this.database
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.phone, phone), isNull(users.deletedAt)))
			.limit(1);
		return !row;
	}

	async createPendingUser(input: {
		name: string;
		email: string;
	}): Promise<{ id: string }> {
		const [row] = await this.database
			.insert(users)
			.values({
				id: crypto.randomUUID(),
				name: input.name,
				email: input.email,
				emailVerified: true,
				status: 'pending',
			})
			.returning({ id: users.id });
		// A new row also stales the list cache.
		await this.invalidate(row.id);
		return { id: row.id };
	}

	async setStatus(id: string, status: TUserSelect['status']): Promise<void> {
		await this.database
			.update(users)
			.set({ status })
			.where(and(eq(users.id, id), isNull(users.deletedAt)));
		await this.invalidate(id);
	}

	async setClaimed(
		id: string,
		input: { phone: string },
	): Promise<void> {
		await this.database
			.update(users)
			.set({ phone: input.phone, status: 'active' })
			.where(and(eq(users.id, id), isNull(users.deletedAt)));
		await this.invalidate(id);
	}

	async delete(id: string): Promise<void> {
		await this.database
			.update(users)
			.set({ deletedAt: new Date() })
			.where(and(eq(users.id, id), isNull(users.deletedAt)));
		await this.invalidate(id);
	}

	async findAnyByEmail(email: string): Promise<TUserSelect | null> {
		const [row] = await this.database
			.select()
			.from(users)
			.where(ilike(users.email, email))
			.limit(1);
		return row ?? null;
	}

	async restore(id: string): Promise<void> {
		await this.database
			.update(users)
			.set({ deletedAt: null, status: 'pending' })
			.where(and(eq(users.id, id), isNotNull(users.deletedAt)));
		await this.invalidate(id);
	}

	async findAnyById(id: string): Promise<TUserSelect | null> {
		const [row] = await this.database
			.select()
			.from(users)
			.where(eq(users.id, id))
			.limit(1);
		return row ?? null;
	}

	async reactivate(id: string): Promise<void> {
		await this.database
			.update(users)
			.set({ status: 'active' })
			.where(and(eq(users.id, id), isNull(users.deletedAt)));
		await this.invalidate(id);
	}

	async listMemberships(
		userId: string,
	): Promise<Array<{ id: string; name: string; role: string }>> {
		const rows = await this.database
			.select({
				id: members.organizationId,
				name: organizations.name,
				role: members.role,
			})
			.from(members)
			.innerJoin(organizations, eq(members.organizationId, organizations.id))
			.where(and(eq(members.userId, userId)));
		return rows;
	}

	async listUsers(
		request: TUserListRequest,
	): Promise<TPaginationResult<TAdminUserRow>> {
		const { status, role, search, includeDeleted, page, limit } = request;
		const filters = [
			includeDeleted ? undefined : isNull(users.deletedAt),
			status ? eq(users.status, status) : undefined,
			role ? eq(users.role, role) : undefined,
			search
				? or(
						ilike(users.name, `%${search}%`),
						ilike(users.email, `%${search}%`),
						ilike(users.username, `%${search}%`),
					)
				: undefined,
		].filter(Boolean);
		const where = filters.length > 0 ? and(...filters) : undefined;

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(users)
			.where(where);

		const rows = await this.database
			.select()
			.from(users)
			.where(where)
			.orderBy(desc(users.createdAt))
			.offset((page - 1) * limit)
			.limit(limit);

		// One membership query for the page, then group in memory — avoids a
		// per-row round trip on the admin table.
		const ids = rows.map((row) => row.id);
		const memberships = ids.length
			? await this.database
					.select({
						userId: members.userId,
						organizationId: members.organizationId,
						role: members.role,
						name: organizations.name,
					})
					.from(members)
					.innerJoin(organizations, eq(members.organizationId, organizations.id))
					.where(inArray(members.userId, ids))
			: [];

		const byUser = new Map<string, TAdminUserRow['organizations']>();
		for (const row of memberships) {
			const bucket = byUser.get(row.userId) ?? [];
			bucket.push({
				id: row.organizationId,
				name: row.name,
				role: row.role,
			});
			byUser.set(row.userId, bucket);
		}

		return {
			data: rows.map((user) => ({
				user,
				organizations: byUser.get(user.id) ?? [],
			})),
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
		};
	}

	/**
	 * Evicts the `auth.users` list cache and the per-id entry for `id`.
	 *
	 * @remarks
	 * Same key layout as
	 * {@link import('../../user/repositories/user.repository').UserRepository#invalidate}
	 * (both sides share {@link USER_CACHE_PREFIX}). Without this, an admin
	 * soft-delete/restore changed `deletedAt` in Postgres but the self-service
	 * read path kept serving the cached row for the full TTL — a deleted user
	 * stayed visible on `/users/me` for up to 5 minutes.
	 */
	private async invalidate(id: string): Promise<void> {
		await this.redisClient.del(userListCacheKey(), userCacheKey(id));
	}
}

/** (Reserved) exclusion helper for future claim-availability checks. */
export const excludeUserById = (id: string) => ne(users.id, id);
