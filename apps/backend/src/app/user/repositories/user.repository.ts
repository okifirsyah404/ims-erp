import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import { USER_CACHE_PREFIX, USER_CACHE_TTL_SECONDS } from '../constants/cache';
import {
	TUserInsert,
	TUserSelect,
	users,
} from '@drizzle/schemas/auth.schema';
import { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	and,
	asc,
	count,
	eq,
	ilike,
	inArray,
	isNotNull,
	isNull,
	or,
} from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { cacheIdKey, cacheListKey } from '@utils/cache.util';
import type { ICacheClient } from '@cache/cache.client';
import type {
	IUserRepository,
	TUserPaginationRequest,
} from '../contracts/user.repository.interface';

/**
 * Drizzle + Redis implementation of {@link IUserRepository} over the
 * Better Auth–owned `auth.users` table.
 *
 * @remarks
 * Write surface is limited to `deletedAt` (soft delete/restore) — see the
 * contract. Hot reads (`findAll`, `findById`) use cache-aside with a
 * 5-minute TTL; every `deletedAt` write invalidates the affected keys.
 * `paginate` is never cached. All reads except the `*WithDeleted` /
 * `findSoftDeletedById` variants exclude soft-deleted rows. Because
 * Better Auth does not consult `deletedAt` during authentication, the
 * service must pair soft deletes with an admin-API ban.
 */
@injectable()
export class UserRepository implements IUserRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	/**
	 * Redis key namespace for this repository's cache entries.
	 *
	 * @remarks
	 * Imported from `../constants/cache` rather than hard-coded here: the
	 * user-management repository writes the same `auth.users` rows and must
	 * evict the exact same keys.
	 */
	private readonly cachePrefix = USER_CACHE_PREFIX;

	async paginate(
		request: TUserPaginationRequest,
	): Promise<TPaginationResult<TUserSelect>> {
		const { page, limit, email, name, username, role, banned, search } = request;

		const term = search ? `%${search}%` : undefined;
		const filters = [
			isNull(users.deletedAt),
			email ? ilike(users.email, `%${email}%`) : undefined,
			name ? ilike(users.name, `%${name}%`) : undefined,
			username ? ilike(users.username, `%${username}%`) : undefined,
			role ? eq(users.role, role) : undefined,
			banned === undefined ? undefined : eq(users.banned, banned),
			// Picker search: one box, three columns (OR).
			term
				? or(
						ilike(users.name, term),
						ilike(users.email, term),
						ilike(users.username, term),
					)
				: undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(users)
			.where(where);

		const data = await this.database
			.select()
			.from(users)
			.where(where)
			.orderBy(asc(users.name))
			.limit(limit)
			.offset((page - 1) * limit);

		return paginationResult({ page, limit }, total, data);
	}

	async create(item: TUserInsert): Promise<TUserSelect> {
		const [created] = await this.database.insert(users).values(item).returning();
		await this.invalidate([created.id]);
		return created;
	}

	async createMany(items: TUserInsert[]): Promise<TUserSelect[]> {
		const created = await this.database.insert(users).values(items).returning();
		await this.invalidate(created.map((row) => row.id));
		return created;
	}

	async findAll(): Promise<TUserSelect[]> {
		return this.cache.remember(
			cacheListKey(this.cachePrefix),
			() =>
				this.database
					.select()
					.from(users)
					.where(isNull(users.deletedAt))
					.orderBy(asc(users.name)),
			USER_CACHE_TTL_SECONDS,
		);
	}

	async findAllWithDeleted(): Promise<TUserSelect[]> {
		return this.database.select().from(users).orderBy(asc(users.name));
	}

	async findById(id: string | number): Promise<TUserSelect | null> {
		return this.cache.remember(
			cacheIdKey(this.cachePrefix, id),
			async () => {
				const [row] = await this.database
					.select()
					.from(users)
					.where(and(eq(users.id, String(id)), isNull(users.deletedAt)));
				return row ?? null;
			},
			USER_CACHE_TTL_SECONDS,
		);
	}

	async findByIds(ids: (string | number)[]): Promise<TUserSelect[]> {
		return this.database
			.select()
			.from(users)
			.where(
				and(inArray(users.id, ids.map(String)), isNull(users.deletedAt)),
			);
	}

	async findSoftDeletedById(id: string | number): Promise<TUserSelect | null> {
		const [row] = await this.database
			.select()
			.from(users)
			.where(and(eq(users.id, String(id)), isNotNull(users.deletedAt)));
		return row ?? null;
	}

	async update(
		id: string | number,
		item: Partial<TUserInsert>,
	): Promise<TUserSelect | null> {
		const [updated] = await this.database
			.update(users)
			.set(item)
			.where(and(eq(users.id, String(id)), isNull(users.deletedAt)))
			.returning();

		if (updated) await this.invalidate([updated.id]);
		return updated ?? null;
	}

	/**
	 * Marks the user soft-deleted. Callers (the service) must pair this
	 * with an admin-API ban: Better Auth ignores `deletedAt` when
	 * authenticating, so only the ban stops new logins.
	 */
	async delete(id: string | number): Promise<void> {
		await this.softDeleteMany([String(id)]);
	}

	async deleteMany(ids: (string | number)[]): Promise<void> {
		await this.softDeleteMany(ids.map(String));
	}

	async forceDelete(id: string | number): Promise<void> {
		await this.forceDeleteMany([id]);
	}

	/**
	 * Permanently removes users. Infra/purge only — feature code must use
	 * {@link delete} (soft-delete hard rule).
	 */
	async forceDeleteMany(ids: (string | number)[]): Promise<void> {
		await this.database.delete(users).where(inArray(users.id, ids.map(String)));
		await this.invalidate(ids.map(String));
	}

	async restore(id: string | number): Promise<TUserSelect | null> {
		const [restored] = await this.database
			.update(users)
			.set({ deletedAt: null })
			.where(and(eq(users.id, String(id)), isNotNull(users.deletedAt)))
			.returning();

		if (restored) await this.invalidate([restored.id]);
		return restored ?? null;
	}

	/**
	 * Bulk soft-delete: stamps `deletedAt` on alive rows and evicts their
	 * cache entries. Does NOT ban the users — the service must pair this
	 * with the admin-API ban to stop new logins.
	 */
	private async softDeleteMany(ids: string[]): Promise<void> {
		await this.database
			.update(users)
			.set({ deletedAt: new Date() })
			.where(and(inArray(users.id, ids), isNull(users.deletedAt)));
		await this.invalidate(ids);
	}

	/**
	 * Evicts the list cache and the per-id entries for the given users.
	 */
	private async invalidate(ids: string[]): Promise<void> {
		await this.cache.del(
			cacheListKey(this.cachePrefix),
			...ids.map((id) => cacheIdKey(this.cachePrefix, id)),
		);
	}
}
