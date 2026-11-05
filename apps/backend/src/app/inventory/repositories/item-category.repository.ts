import { DRIZZLE_TOKEN } from '@di/provider';
import {
	itemCategories,
	items,
	type TItemCategorySelect,
} from '@drizzle/schemas/inventory.schema';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	TItemCategoryCreateInput,
	TItemCategoryUpdateInput,
} from '../contracts/item-category.contract';
import type { IItemCategoryRepository } from '../contracts/item-category.repository.interface';

/** Drizzle implementation of {@link IItemCategoryRepository}. */
@injectable()
export class ItemCategoryRepository implements IItemCategoryRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	list(includeInactive: boolean): Promise<TItemCategorySelect[]> {
		return this.database
			.select()
			.from(itemCategories)
			.where(
				and(
					isNull(itemCategories.deletedAt),
					includeInactive ? undefined : eq(itemCategories.isActive, true),
				),
			)
			.orderBy(asc(itemCategories.sortOrder), asc(itemCategories.name));
	}

	async findById(id: string): Promise<TItemCategorySelect | null> {
		const [row] = await this.database
			.select()
			.from(itemCategories)
			.where(and(eq(itemCategories.id, id), isNull(itemCategories.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findBySlug(slug: string): Promise<TItemCategorySelect | null> {
		const [row] = await this.database
			.select()
			.from(itemCategories)
			.where(and(eq(itemCategories.slug, slug), isNull(itemCategories.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async create(data: TItemCategoryCreateInput): Promise<TItemCategorySelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(itemCategories)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(id: string, data: TItemCategoryUpdateInput): Promise<TItemCategorySelect | null> {
		const [row] = await this.database
			.update(itemCategories)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(itemCategories.id, id), isNull(itemCategories.deletedAt)))
			.returning();
		return row ?? null;
	}

	async archive(id: string): Promise<TItemCategorySelect | null> {
		const now = new Date();
		const [row] = await this.database
			.update(itemCategories)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(itemCategories.id, id), isNull(itemCategories.deletedAt)))
			.returning();
		return row ?? null;
	}

	async countLiveItems(id: string): Promise<number> {
		const [{ value }] = await this.database
			.select({ value: count() })
			.from(items)
			.where(and(eq(items.categoryId, id), isNull(items.deletedAt)));
		return value;
	}
}
