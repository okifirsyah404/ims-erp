import { DRIZZLE_TOKEN, REDIS_TOKEN } from '@di/provider';
import {
	TUserInsert,
	TUserSelect,
	users,
} from '@drizzle/schemas/auth.schema';
import { TPaginationResult } from '@ims-erp/common';
import { RedisClient } from 'bun';
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
} from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
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
		@inject(REDIS_TOKEN) private readonly redisClient: RedisClient,
	) {}

	private readonly cachePrefix = 'user';
	private readonly cacheTtlSeconds = 300;

	async paginate(
		request: TUserPaginationRequest,
	): Promise<TPaginationResult<TUserSelect>> {
		const { page, limit, email, name, username, role, banned } = request;

		const filters = [
			isNull(users.deletedAt),
			email ? ilike(users.email, `%${email}%`) : undefined,
			name ? ilike(users.name, `%${name}%`) : undefined,
			username ? ilike(users.username, `%${username}%`) : undefined,
			role ? eq(users.role, role) : undefined,
			banned === undefined ? undefined : eq(users.banned, banned),
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

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
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
		const cacheKey = `${this.cachePrefix}:all`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached) return JSON.parse(cached) as TUserSelect[];

		const rows = await this.database
			.select()
			.from(users)
			.where(isNull(users.deletedAt))
			.orderBy(asc(users.name));

		await this.redisClient.set(
			cacheKey,
			JSON.stringify(rows),
			'EX',
			this.cacheTtlSeconds,
		);
		return rows;
	}

	async findAllWithDeleted(): Promise<TUserSelect[]> {
		return this.database.select().from(users).orderBy(asc(users.name));
	}

	async findById(id: string | number): Promise<TUserSelect | null> {
		const cacheKey = `${this.cachePrefix}:id:${id}`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached === 'null') return null;
		if (cached) return JSON.parse(cached) as TUserSelect;

		const [row] = await this.database
			.select()
			.from(users)
			.where(and(eq(users.id, String(id)), isNull(users.deletedAt)));

		await this.redisClient.set(
			cacheKey,
			JSON.stringify(row ?? null),
			'EX',
			this.cacheTtlSeconds,
		);
		return row ?? null;
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

	private async softDeleteMany(ids: string[]): Promise<void> {
		await this.database
			.update(users)
			.set({ deletedAt: new Date() })
			.where(and(inArray(users.id, ids), isNull(users.deletedAt)));
		await this.invalidate(ids);
	}

	private async invalidate(ids: string[]): Promise<void> {
		await this.redisClient.del(
			`${this.cachePrefix}:all`,
			...ids.map((id) => `${this.cachePrefix}:id:${id}`),
		);
	}
}
