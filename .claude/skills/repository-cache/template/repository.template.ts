/**
 * Template: cached repository (cache-aside, Redis + Drizzle).
 *
 * Replace ALL `{{...}}` placeholders. Delete the parent-scoped members
 * (`{{parentKey}}`, `{{ParentEntity}}`) for a leaf entity (see
 * `province.repository.ts`). For a child entity with per-parent caching,
 * mirror `district.repository.ts` / `village.repository.ts`.
 *
 * Conventions (see ../SKILL.md):
 *   keys   {prefix}:all | {prefix}:id:{id} | {prefix}:{{parentKey}}:{parentId}
 *   TTL    300s
 *   cache  findAll, findById, findBy{{ParentEntity}}Id
 *   skip   paginate, findAllWithDeleted, findSoftDeletedById, findByIds,
 *          findBy*Ids, findBy*Codes
 */
import { DRIZZLE_TOKEN, REDIS_TOKEN } from '@di/provider';
import { T{{Entity}}Insert, T{{Entity}}Select, {{entity}} } from '@drizzle/schemas/{{domain}}.schema';
import { TPaginationResult } from '@ims-erp/common';
import { RedisClient } from 'bun';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, ilike, inArray, isNotNull, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	I{{Entity}}Repository,
	T{{Entity}}PaginationRequest,
} from '../contracts/{{entity}}.repository.interface';

/**
 * Drizzle + Redis implementation of {@link I{{Entity}}Repository}.
 *
 * @remarks
 * Cache-aside with a 5-minute TTL on hot reads (`findAll`, `findById`,
 * `findBy{{ParentEntity}}Id`), explicit invalidation on writes. `paginate`,
 * soft-delete views, and multi-id/code lookups are never cached.
 */
@injectable()
export class {{Entity}}Repository implements I{{Entity}}Repository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(REDIS_TOKEN) private readonly redisClient: RedisClient,
	) {}

	private readonly cachePrefix = '{{domain}}:{{entity}}';
	private readonly cacheTtlSeconds = 300;

	// ---------------------------------------------------------------------
	// Never cached
	// ---------------------------------------------------------------------

	async paginate(
		request: T{{Entity}}PaginationRequest,
	): Promise<TPaginationResult<T{{Entity}}Select>> {
		const { page, limit, code, name } = request;

		const filters = [
			isNull({{entity}}.deletedAt),
			code ? ilike({{entity}}.code, `%${code}%`) : undefined,
			name ? ilike({{entity}}.name, `%${name}%`) : undefined,
			// {{parentEntity}}Id ? eq({{entity}}.{{parentEntity}}Id, {{parentEntity}}Id) : undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from({{entity}})
			.where(where);

		const data = await this.database
			.select()
			.from({{entity}})
			.where(where)
			.orderBy(asc({{entity}}.name))
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	async findAllWithDeleted(): Promise<T{{Entity}}Select[]> {
		return this.database.select().from({{entity}}).orderBy(asc({{entity}}.name));
	}

	async findByIds(ids: (string | number)[]): Promise<T{{Entity}}Select[]> {
		if (ids.length === 0) return [];
		return this.database
			.select()
			.from({{entity}})
			.where(and(inArray({{entity}}.id, ids.map(String)), isNull({{entity}}.deletedAt)));
	}

	async findSoftDeletedById(id: string | number): Promise<T{{Entity}}Select | null> {
		const [row] = await this.database
			.select()
			.from({{entity}})
			.where(and(eq({{entity}}.id, String(id)), isNotNull({{entity}}.deletedAt)));
		return row ?? null;
	}

	// ---------------------------------------------------------------------
	// Cached reads
	// ---------------------------------------------------------------------

	async findAll(): Promise<T{{Entity}}Select[]> {
		const cacheKey = `${this.cachePrefix}:all`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached) return JSON.parse(cached) as T{{Entity}}Select[];

		const rows = await this.database
			.select()
			.from({{entity}})
			.where(isNull({{entity}}.deletedAt))
			.orderBy(asc({{entity}}.name));

		await this.redisClient.set(cacheKey, JSON.stringify(rows), 'EX', this.cacheTtlSeconds);
		return rows;
	}

	async findById(id: string | number): Promise<T{{Entity}}Select | null> {
		const cacheKey = `${this.cachePrefix}:id:${id}`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached === 'null') return null;
		if (cached) return JSON.parse(cached) as T{{Entity}}Select;

		const [row] = await this.database
			.select()
			.from({{entity}})
			.where(and(eq({{entity}}.id, String(id)), isNull({{entity}}.deletedAt)));

		await this.redisClient.set(
			cacheKey,
			JSON.stringify(row ?? null),
			'EX',
			this.cacheTtlSeconds,
		);
		return row ?? null;
	}

	/** Parent-scoped read — cached per parent id. Omit for a leaf entity. */
	async findBy{{ParentEntity}}Id({{parentEntity}}Id: string): Promise<T{{Entity}}Select[]> {
		const cacheKey = `${this.cachePrefix}:{{parentKey}}:${ {{parentEntity}}Id }`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached) return JSON.parse(cached) as T{{Entity}}Select[];

		const rows = await this.database
			.select()
			.from({{entity}})
			.where(and(eq({{entity}}.{{parentEntity}}Id, {{parentEntity}}Id), isNull({{entity}}.deletedAt)))
			.orderBy(asc({{entity}}.name));

		await this.redisClient.set(cacheKey, JSON.stringify(rows), 'EX', this.cacheTtlSeconds);
		return rows;
	}

	/** Multi-parent read — never cached. Omit for a leaf entity. */
	async findBy{{ParentEntity}}Ids({{parentEntity}}Ids: string[]): Promise<T{{Entity}}Select[]> {
		if ({{parentEntity}}Ids.length === 0) return [];
		return this.database
			.select()
			.from({{entity}})
			.where(
				and(
					inArray({{entity}}.{{parentEntity}}Id, {{parentEntity}}Ids),
					isNull({{entity}}.deletedAt),
				),
			)
			.orderBy(asc({{entity}}.name));
	}

	// ---------------------------------------------------------------------
	// Writes — always invalidate after the DB write
	// ---------------------------------------------------------------------

	async create(item: T{{Entity}}Insert): Promise<T{{Entity}}Select> {
		const [created] = await this.database.insert({{entity}}).values(item).returning();

		// Leaf entity: await this.invalidate([created.id]);
		await this.invalidate([created.id], [created.{{parentEntity}}Id]);
		return created;
	}

	async createMany(items: T{{Entity}}Insert[]): Promise<T{{Entity}}Select[]> {
		const created = await this.database.insert({{entity}}).values(items).returning();

		await this.invalidate(
			created.map((row) => row.id),
			[...new Set(created.map((row) => row.{{parentEntity}}Id).filter(Boolean))],
		);
		return created;
	}

	async update(
		id: string | number,
		item: Partial<T{{Entity}}Insert>,
	): Promise<T{{Entity}}Select | null> {
		const [updated] = await this.database
			.update({{entity}})
			.set(item)
			.where(and(eq({{entity}}.id, String(id)), isNull({{entity}}.deletedAt)))
			.returning();

		if (updated) await this.invalidate([updated.id], [updated.{{parentEntity}}Id]);
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
			.delete({{entity}})
			.where(inArray({{entity}}.id, ids.map(String)))
			.returning({ id: {{entity}}.id, {{parentEntity}}Id: {{entity}}.{{parentEntity}}Id });
		await this.invalidate(
			affected.map((row) => row.id),
			[...new Set(affected.map((row) => row.{{parentEntity}}Id).filter(Boolean))],
		);
	}

	async restore(id: string | number): Promise<T{{Entity}}Select | null> {
		const [restored] = await this.database
			.update({{entity}})
			.set({ deletedAt: null })
			.where(and(eq({{entity}}.id, String(id)), isNotNull({{entity}}.deletedAt)))
			.returning();

		if (restored) await this.invalidate([restored.id], [restored.{{parentEntity}}Id]);
		return restored ?? null;
	}

	// ---------------------------------------------------------------------
	// Cache invalidation
	// ---------------------------------------------------------------------

	/**
	 * Marks the given rows deleted and invalidates their cache entries.
	 */
	private async softDeleteMany(ids: string[]): Promise<void> {
		const affected = await this.database
			.update({{entity}})
			.set({ deletedAt: new Date() })
			.where(and(inArray({{entity}}.id, ids), isNull({{entity}}.deletedAt)))
			.returning({ id: {{entity}}.id, {{parentEntity}}Id: {{entity}}.{{parentEntity}}Id });
		await this.invalidate(
			affected.map((row) => row.id),
			[...new Set(affected.map((row) => row.{{parentEntity}}Id).filter(Boolean))],
		);
	}

	/**
	 * Evicts the list cache, per-id entries, and parent-scoped entries.
	 *
	 * Leaf entity: `invalidate(ids: string[])` and drop the parent clause.
	 */
	private async invalidate(
		ids: string[],
		{{parentEntity}}Ids: (string | null)[],
	): Promise<void> {
		await this.redisClient.del(
			`${this.cachePrefix}:all`,
			...ids.map((id) => `${this.cachePrefix}:id:${id}`),
			...{{parentEntity}}Ids.map((pid) => `${this.cachePrefix}:{{parentKey}}:${pid}`),
		);
	}
}
