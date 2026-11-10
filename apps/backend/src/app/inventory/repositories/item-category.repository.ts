import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import {
	itemCategories,
	items,
	type TItemCategorySelect,
} from '@drizzle/schemas/inventory.schema';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { cacheIdKey, cacheListKey } from '@utils/cache.util';
import type { ICacheClient } from '@cache/cache.client';
import type {
	TItemCategoryCreateInput,
	TItemCategoryUpdateInput,
} from '../contracts/item-category.contract';
import type { IItemCategoryRepository } from '../contracts/item-category.repository.interface';

/**
 * Drizzle + Redis implementation of {@link IItemCategoryRepository}.
 *
 * @remarks
 * Categories are near-immutable reference data, so hot reads
 * (`list(false)`, `findById`, `findBySlug`) use cache-aside with a
 * 5-minute TTL; every write evicts the affected keys explicitly. The
 * unfiltered admin list (`list(true)`) is never cached: it exists for the
 * management screen where staleness is least acceptable. `countLiveItems`
 * is a write-path guard (used before archive) and also stays uncached.
 */
@injectable()
export class ItemCategoryRepository implements IItemCategoryRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	/** Redis key namespace for this repository's cache entries. */
	private readonly cachePrefix = 'inventory:item-category';

	async list(includeInactive: boolean): Promise<TItemCategorySelect[]> {
		if (includeInactive) {
			return this.database
				.select()
				.from(itemCategories)
				.where(isNull(itemCategories.deletedAt))
				.orderBy(asc(itemCategories.sortOrder), asc(itemCategories.name));
		}

		const cacheKey = cacheListKey(this.cachePrefix);
		return this.cache.remember(
			cacheKey,
			() =>
				this.database
					.select()
					.from(itemCategories)
					.where(and(isNull(itemCategories.deletedAt), eq(itemCategories.isActive, true)))
					.orderBy(asc(itemCategories.sortOrder), asc(itemCategories.name)),
		);
	}

	/**
	 * Fetches one live category by id.
	 *
	 * @remarks
	 * Cache-aside with negative caching: an absent row is cached as `null`
	 * so repeated misses do not hit the database.
	 */
	async findById(id: string): Promise<TItemCategorySelect | null> {
		return this.cache.remember(cacheIdKey(this.cachePrefix, id), async () => {
			const [row] = await this.database
				.select()
				.from(itemCategories)
				.where(and(eq(itemCategories.id, id), isNull(itemCategories.deletedAt)))
				.limit(1);
			return row ?? null;
		});
	}

	/**
	 * Fetches one live category by slug, cache-aside like {@link findById}.
	 */
	async findBySlug(slug: string): Promise<TItemCategorySelect | null> {
		return this.cache.remember(`${this.cachePrefix}:slug:${slug}`, async () => {
			const [row] = await this.database
				.select()
				.from(itemCategories)
				.where(and(eq(itemCategories.slug, slug), isNull(itemCategories.deletedAt)))
				.limit(1);
			return row ?? null;
		});
	}

	/** Inserts a category and evicts the list cache. */
	async create(data: TItemCategoryCreateInput): Promise<TItemCategorySelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(itemCategories)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		await this.invalidate(row);
		return row;
	}

	/** Updates a live category and evicts its cache entries. */
	async update(id: string, data: TItemCategoryUpdateInput): Promise<TItemCategorySelect | null> {
		const [row] = await this.database
			.update(itemCategories)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(itemCategories.id, id), isNull(itemCategories.deletedAt)))
			.returning();
		if (row) await this.invalidate(row);
		return row ?? null;
	}

	/** Soft-deletes a live category and evicts its cache entries. */
	async archive(id: string): Promise<TItemCategorySelect | null> {
		const now = new Date();
		const [row] = await this.database
			.update(itemCategories)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(itemCategories.id, id), isNull(itemCategories.deletedAt)))
			.returning();
		if (row) await this.invalidate(row);
		return row ?? null;
	}

	async countLiveItems(id: string): Promise<number> {
		const [{ value }] = await this.database
			.select({ value: count() })
			.from(items)
			.where(and(eq(items.categoryId, id), isNull(items.deletedAt)));
		return value;
	}

	/**
	 * Evicts the list cache plus the id and slug entries for the row.
	 */
	private async invalidate(row: TItemCategorySelect): Promise<void> {
		await this.cache.del(
			cacheListKey(this.cachePrefix),
			cacheIdKey(this.cachePrefix, row.id),
			`${this.cachePrefix}:slug:${row.slug}`,
		);
	}
}
