import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import {
	productCategories,
	products,
	type TProductCategorySelect,
} from '@drizzle/schemas/product.schema';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { cacheIdKey, cacheListKey } from '@utils/cache.util';
import type { ICacheClient } from '@cache/cache.client';
import type {
	TProductCategoryCreateInput,
	TProductCategoryUpdateInput,
} from '../contracts/product-category.contract';
import type { IProductCategoryRepository } from '../contracts/product-category.repository.interface';

/**
 * Drizzle + Redis implementation of {@link IProductCategoryRepository}.
 *
 * @remarks
 * Categories are near-immutable reference data, so hot reads
 * (`list(false)`, `findById`, `findBySlug`) use cache-aside with a
 * 5-minute TTL; every write evicts the affected keys explicitly. The
 * unfiltered admin list (`list(true)`) is never cached: it exists for the
 * management screen where staleness is least acceptable. `countLiveProducts`
 * is a write-path guard (used before archive) and also stays uncached.
 */
@injectable()
export class ProductCategoryRepository implements IProductCategoryRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	/** Redis key namespace for this repository's cache entries. */
	private readonly cachePrefix = 'inventory:product-category';

	async list(includeInactive: boolean): Promise<TProductCategorySelect[]> {
		if (includeInactive) {
			return this.database
				.select()
				.from(productCategories)
				.where(isNull(productCategories.deletedAt))
				.orderBy(asc(productCategories.sortOrder), asc(productCategories.name));
		}

		const cacheKey = cacheListKey(this.cachePrefix);
		return this.cache.remember(
			cacheKey,
			() =>
				this.database
					.select()
					.from(productCategories)
					.where(and(isNull(productCategories.deletedAt), eq(productCategories.isActive, true)))
					.orderBy(asc(productCategories.sortOrder), asc(productCategories.name)),
		);
	}

	/**
	 * Fetches one live category by id.
	 *
	 * @remarks
	 * Cache-aside with negative caching: an absent row is cached as `null`
	 * so repeated misses do not hit the database.
	 */
	async findById(id: string): Promise<TProductCategorySelect | null> {
		return this.cache.remember(cacheIdKey(this.cachePrefix, id), async () => {
			const [row] = await this.database
				.select()
				.from(productCategories)
				.where(and(eq(productCategories.id, id), isNull(productCategories.deletedAt)))
				.limit(1);
			return row ?? null;
		});
	}

	/**
	 * Fetches one live category by slug, cache-aside like {@link findById}.
	 */
	async findBySlug(slug: string): Promise<TProductCategorySelect | null> {
		return this.cache.remember(`${this.cachePrefix}:slug:${slug}`, async () => {
			const [row] = await this.database
				.select()
				.from(productCategories)
				.where(and(eq(productCategories.slug, slug), isNull(productCategories.deletedAt)))
				.limit(1);
			return row ?? null;
		});
	}

	/** Inserts a category and evicts the list cache. */
	async create(data: TProductCategoryCreateInput): Promise<TProductCategorySelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(productCategories)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		await this.invalidate(row);
		return row;
	}

	/** Updates a live category and evicts its cache entries. */
	async update(id: string, data: TProductCategoryUpdateInput): Promise<TProductCategorySelect | null> {
		const [row] = await this.database
			.update(productCategories)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(productCategories.id, id), isNull(productCategories.deletedAt)))
			.returning();
		if (row) await this.invalidate(row);
		return row ?? null;
	}

	/** Soft-deletes a live category and evicts its cache entries. */
	async archive(id: string): Promise<TProductCategorySelect | null> {
		const now = new Date();
		const [row] = await this.database
			.update(productCategories)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(productCategories.id, id), isNull(productCategories.deletedAt)))
			.returning();
		if (row) await this.invalidate(row);
		return row ?? null;
	}

	async countLiveProducts(id: string): Promise<number> {
		const [{ value }] = await this.database
			.select({ value: count() })
			.from(products)
			.where(and(eq(products.productCategoryId, id), isNull(products.deletedAt)));
		return value;
	}

	/**
	 * Evicts the list cache plus the id and slug entries for the row.
	 */
	private async invalidate(row: TProductCategorySelect): Promise<void> {
		await this.cache.del(
			cacheListKey(this.cachePrefix),
			cacheIdKey(this.cachePrefix, row.id),
			`${this.cachePrefix}:slug:${row.slug}`,
		);
	}
}
