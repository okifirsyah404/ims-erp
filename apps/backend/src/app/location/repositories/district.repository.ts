import { DRIZZLE_TOKEN, REDIS_TOKEN } from '@di/provider';
import {
	TDistrictInsert,
	TDistrictSelect,
	district,
	regency,
} from '@drizzle/schemas/location.schema';
import { TPaginationResult } from '@ims-erp/common';
import { RedisClient } from 'bun';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, ilike, inArray, isNotNull, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IDistrictRepository,
	TDistrictPaginationRequest,
} from '../contracts/district.repository.interface';

/**
 * Drizzle + Redis implementation of {@link IDistrictRepository}.
 *
 * @remarks
 * Mirrors the regency repository: cache-aside with a 5-minute TTL on hot
 * reads, explicit invalidation on writes, per-parent-regency caching for
 * the `findByRegency*` lookups.
 */
@injectable()
export class DistrictRepository implements IDistrictRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(REDIS_TOKEN) private readonly redisClient: RedisClient,
	) {}

	private readonly cachePrefix = 'location:district';
	private readonly cacheTtlSeconds = 300;

	async paginate(
		request: TDistrictPaginationRequest,
	): Promise<TPaginationResult<TDistrictSelect>> {
		const { page, limit, code, name, regencyId } = request;

		const filters = [
			isNull(district.deletedAt),
			code ? ilike(district.code, `%${code}%`) : undefined,
			name ? ilike(district.name, `%${name}%`) : undefined,
			regencyId ? eq(district.regencyId, regencyId) : undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(district)
			.where(where);

		const data = await this.database
			.select()
			.from(district)
			.where(where)
			.orderBy(asc(district.name))
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	async create(item: TDistrictInsert): Promise<TDistrictSelect> {
		const [created] = await this.database
			.insert(district)
			.values(item)
			.returning();

		await this.invalidate([created.id], [created.regencyId]);
		return created;
	}

	async createMany(items: TDistrictInsert[]): Promise<TDistrictSelect[]> {
		const created = await this.database
			.insert(district)
			.values(items)
			.returning();

		await this.invalidate(
			created.map((row) => row.id),
			[...new Set(created.map((row) => row.regencyId).filter(Boolean))],
		);
		return created;
	}

	async findAll(): Promise<TDistrictSelect[]> {
		const cacheKey = `${this.cachePrefix}:all`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached) return JSON.parse(cached) as TDistrictSelect[];

		const rows = await this.database
			.select()
			.from(district)
			.where(isNull(district.deletedAt))
			.orderBy(asc(district.name));

		await this.redisClient.set(cacheKey, JSON.stringify(rows), 'EX', this.cacheTtlSeconds);
		return rows;
	}

	async findAllWithDeleted(): Promise<TDistrictSelect[]> {
		return this.database.select().from(district).orderBy(asc(district.name));
	}

	async findById(id: string | number): Promise<TDistrictSelect | null> {
		const cacheKey = `${this.cachePrefix}:id:${id}`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached === 'null') return null;
		if (cached) return JSON.parse(cached) as TDistrictSelect;

		const [row] = await this.database
			.select()
			.from(district)
			.where(and(eq(district.id, String(id)), isNull(district.deletedAt)));

		await this.redisClient.set(cacheKey, JSON.stringify(row ?? null), 'EX', this.cacheTtlSeconds);
		return row ?? null;
	}

	async findByIds(ids: (string | number)[]): Promise<TDistrictSelect[]> {
		return this.database
			.select()
			.from(district)
			.where(
				and(inArray(district.id, ids.map(String)), isNull(district.deletedAt)),
			);
	}

	async findSoftDeletedById(id: string | number): Promise<TDistrictSelect | null> {
		const [row] = await this.database
			.select()
			.from(district)
			.where(and(eq(district.id, String(id)), isNotNull(district.deletedAt)));
		return row ?? null;
	}

	async update(
		id: string | number,
		item: Partial<TDistrictInsert>,
	): Promise<TDistrictSelect | null> {
		const [updated] = await this.database
			.update(district)
			.set(item)
			.where(and(eq(district.id, String(id)), isNull(district.deletedAt)))
			.returning();

		if (updated) await this.invalidate([updated.id], [updated.regencyId]);
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
		const affected = await this.database
			.delete(district)
			.where(inArray(district.id, ids.map(String)))
			.returning({ id: district.id, regencyId: district.regencyId });
		await this.invalidate(
			affected.map((row) => row.id),
			[...new Set(affected.map((row) => row.regencyId).filter(Boolean))],
		);
	}

	async restore(id: string | number): Promise<TDistrictSelect | null> {
		const [restored] = await this.database
			.update(district)
			.set({ deletedAt: null })
			.where(and(eq(district.id, String(id)), isNotNull(district.deletedAt)))
			.returning();

		if (restored) await this.invalidate([restored.id], [restored.regencyId]);
		return restored ?? null;
	}

	async findByRegencyId(regencyId: string): Promise<TDistrictSelect[]> {
		const cacheKey = `${this.cachePrefix}:regency:${regencyId}`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached) return JSON.parse(cached) as TDistrictSelect[];

		const rows = await this.database
			.select()
			.from(district)
			.where(and(eq(district.regencyId, regencyId), isNull(district.deletedAt)))
			.orderBy(asc(district.name));

		await this.redisClient.set(cacheKey, JSON.stringify(rows), 'EX', this.cacheTtlSeconds);
		return rows;
	}

	async findByRegencyIds(regencyIds: string[]): Promise<TDistrictSelect[]> {
		if (regencyIds.length === 0) return [];
		return this.database
			.select()
			.from(district)
			.where(
				and(
					inArray(district.regencyId, regencyIds),
					isNull(district.deletedAt),
				),
			)
			.orderBy(asc(district.name));
	}

	async findByRegencyCode(regencyCode: string): Promise<TDistrictSelect[]> {
		return this.findByRegencyCodes([regencyCode]);
	}

	async findByRegencyCodes(regencyCodes: string[]): Promise<TDistrictSelect[]> {
		if (regencyCodes.length === 0) return [];

		const parents = await this.database
			.select({ id: regency.id })
			.from(regency)
			.where(inArray(regency.code, regencyCodes));
		if (parents.length === 0) return [];

		return this.findByRegencyIds(parents.map((row) => row.id));
	}

	/**
	 * Marks the given rows deleted and invalidates their cache entries.
	 */
	private async softDeleteMany(ids: string[]): Promise<void> {
		const affected = await this.database
			.update(district)
			.set({ deletedAt: new Date() })
			.where(and(inArray(district.id, ids), isNull(district.deletedAt)))
			.returning({ id: district.id, regencyId: district.regencyId });
		await this.invalidate(
			affected.map((row) => row.id),
			[...new Set(affected.map((row) => row.regencyId).filter(Boolean))],
		);
	}

	/**
	 * Evicts the list cache, per-id entries, and parent-scoped entries.
	 */
	private async invalidate(ids: string[], regencyIds: (string | null)[]): Promise<void> {
		await this.redisClient.del(
			`${this.cachePrefix}:all`,
			...ids.map((id) => `${this.cachePrefix}:id:${id}`),
			...(regencyIds.length
				? regencyIds.map((rid) => `${this.cachePrefix}:regency:${rid}`)
				: []),
		);
	}
}
