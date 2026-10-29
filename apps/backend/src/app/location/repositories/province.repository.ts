import { DRIZZLE_TOKEN, REDIS_TOKEN } from '@di/provider';
import {
	TProvinceInsert,
	TProvinceSelect,
	province,
} from '@drizzle/schemas/location.schema';
import { TPaginationResult } from '@ims-erp/common';
import { RedisClient } from 'bun';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, ilike, inArray, isNotNull, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IProvinceRepository,
	TProvincePaginationRequest,
} from '../contracts/province.repository.interface';

/**
 * Drizzle + Redis implementation of {@link IProvinceRepository}.
 *
 * @remarks
 * Hot reads (`findAll`, `findById`, `findByIds`) use cache-aside with a
 * 5-minute TTL; every write invalidates the affected keys explicitly.
 * `paginate`, `findAllWithDeleted`, and `findSoftDeletedById` are never
 * cached. All reads except the `*WithDeleted`/`findSoftDeletedById`
 * variants exclude soft-deleted rows.
 */
@injectable()
export class ProvinceRepository implements IProvinceRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(REDIS_TOKEN) private readonly redisClient: RedisClient,
	) {}

	private readonly cachePrefix = 'location:province';
	private readonly cacheTtlSeconds = 300;

	async paginate(
		request: TProvincePaginationRequest,
	): Promise<TPaginationResult<TProvinceSelect>> {
		const { page, limit, code, name } = request;

		const filters = [
			isNull(province.deletedAt),
			code ? ilike(province.code, `%${code}%`) : undefined,
			name ? ilike(province.name, `%${name}%`) : undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(province)
			.where(where);

		const data = await this.database
			.select()
			.from(province)
			.where(where)
			.orderBy(asc(province.name))
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	async create(item: TProvinceInsert): Promise<TProvinceSelect> {
		const [created] = await this.database
			.insert(province)
			.values(item)
			.returning();

		await this.invalidate([created.id]);
		return created;
	}

	async createMany(items: TProvinceInsert[]): Promise<TProvinceSelect[]> {
		const created = await this.database
			.insert(province)
			.values(items)
			.returning();

		await this.invalidate(created.map((row) => row.id));
		return created;
	}

	async findAll(): Promise<TProvinceSelect[]> {
		const cacheKey = `${this.cachePrefix}:all`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached) return JSON.parse(cached) as TProvinceSelect[];

		const rows = await this.database
			.select()
			.from(province)
			.where(isNull(province.deletedAt))
			.orderBy(asc(province.name));

		await this.redisClient.set(cacheKey, JSON.stringify(rows), 'EX', this.cacheTtlSeconds);
		return rows;
	}

	async findAllWithDeleted(): Promise<TProvinceSelect[]> {
		return this.database.select().from(province).orderBy(asc(province.name));
	}

	async findById(id: string | number): Promise<TProvinceSelect | null> {
		const cacheKey = `${this.cachePrefix}:id:${id}`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached === 'null') return null;
		if (cached) return JSON.parse(cached) as TProvinceSelect;

		const [row] = await this.database
			.select()
			.from(province)
			.where(and(eq(province.id, String(id)), isNull(province.deletedAt)));

		await this.redisClient.set(cacheKey, JSON.stringify(row ?? null), 'EX', this.cacheTtlSeconds);
		return row ?? null;
	}

	async findByIds(ids: (string | number)[]): Promise<TProvinceSelect[]> {
		return this.database
			.select()
			.from(province)
			.where(
				and(inArray(province.id, ids.map(String)), isNull(province.deletedAt)),
			);
	}

	async findSoftDeletedById(id: string | number): Promise<TProvinceSelect | null> {
		const [row] = await this.database
			.select()
			.from(province)
			.where(and(eq(province.id, String(id)), isNotNull(province.deletedAt)));
		return row ?? null;
	}

	async update(
		id: string | number,
		item: Partial<TProvinceInsert>,
	): Promise<TProvinceSelect | null> {
		const [updated] = await this.database
			.update(province)
			.set(item)
			.where(and(eq(province.id, String(id)), isNull(province.deletedAt)))
			.returning();

		if (updated) await this.invalidate([updated.id]);
		return updated ?? null;
	}

	async delete(id: string | number): Promise<void> {
		await this.softDeleteMany([String(id)]);
	}

	async deleteMany(ids: (string | number)[]): Promise<void> {
		await this.softDeleteMany(ids.map(String));
	}

	async forceDelete(id: string | number): Promise<void> {
		await this.forceDeleteMany([id]);
	}

	async forceDeleteMany(ids: (string | number)[]): Promise<void> {
		await this.database
			.delete(province)
			.where(inArray(province.id, ids.map(String)));
		await this.invalidate(ids.map(String));
	}

	async restore(id: string | number): Promise<TProvinceSelect | null> {
		const [restored] = await this.database
			.update(province)
			.set({ deletedAt: null })
			.where(and(eq(province.id, String(id)), isNotNull(province.deletedAt)))
			.returning();

		if (restored) await this.invalidate([restored.id]);
		return restored ?? null;
	}

	/**
	 * Marks the given rows deleted and invalidates their cache entries.
	 */
	private async softDeleteMany(ids: string[]): Promise<void> {
		await this.database
			.update(province)
			.set({ deletedAt: new Date() })
			.where(and(inArray(province.id, ids), isNull(province.deletedAt)));
		await this.invalidate(ids);
	}

	/**
	 * Evicts the list cache and the per-id entries for the given rows.
	 */
	private async invalidate(ids: string[]): Promise<void> {
		await this.redisClient.del(
			`${this.cachePrefix}:all`,
			...ids.map((id) => `${this.cachePrefix}:id:${id}`),
		);
	}
}
