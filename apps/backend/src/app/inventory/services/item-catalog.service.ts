import type { TItemCategorySelect, TItemSelect } from '@drizzle/schemas/inventory.schema';
import { documentImageUrl } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { BALANCE_REPOSITORY_TOKEN, ITEM_CATEGORY_REPOSITORY_TOKEN, ITEM_REPOSITORY_TOKEN } from '../constants/di';
import type { IBalanceRepository } from '../contracts/balance.repository.interface';
import type { IItemCategoryRepository } from '../contracts/item-category.repository.interface';
import type { IItemRepository } from '../contracts/item.repository.interface';

/** What the website catalog (M04) may know of an item. */
export type TCatalogItem = Pick<
	TItemSelect,
	'id' | 'sku' | 'name' | 'description' | 'specification' | 'brand' | 'unitLabel' | 'sellingPrice' | 'isStockTracked' | 'imageObjectKey'
> & { category: Pick<TItemCategorySelect, 'id' | 'slug' | 'name' | 'shortName'> | null };

export type TCatalogCategory = Pick<TItemCategorySelect, 'id' | 'slug' | 'name' | 'shortName' | 'sortOrder'>;

/**
 * Inventory contract for the website catalog (M04 stage 1): live items with
 * their category, available stock and photo URL. Read-only; the catalog
 * module never touches inventory tables.
 */
@injectable()
export class ItemCatalogService {
	constructor(
		@inject(ITEM_REPOSITORY_TOKEN) private readonly itemRepository: Pick<IItemRepository, 'findActiveByIds'>,
		@inject(ITEM_CATEGORY_REPOSITORY_TOKEN) private readonly categories: Pick<IItemCategoryRepository, 'list'>,
		@inject(BALANCE_REPOSITORY_TOKEN) private readonly balances: Pick<IBalanceRepository, 'availableByItems'>,
		@inject(OBJECT_STORAGE_TOKEN) private readonly storage: Pick<IObjectStorage, 'presignGet'>,
	) {}

	/** Active categories, in display order. */
	async listCategories(): Promise<TCatalogCategory[]> {
		const rows = await this.categories.list(false);
		return rows.map(({ id, slug, name, shortName, sortOrder }) => ({ id, slug, name, shortName, sortOrder }));
	}

	/** Live, active items among `ids` (archived or inactive ones are left out). */
	async items(ids: string[]): Promise<TCatalogItem[]> {
		if (ids.length === 0) return [];
		const [rows, categories] = await Promise.all([this.itemRepository.findActiveByIds(ids), this.categories.list(true)]);
		const byId = new Map(categories.map((category) => [category.id, category]));
		return rows
			.filter((row) => row.isActive)
			.map((row) => {
				const category = row.categoryId ? byId.get(row.categoryId) : undefined;
				return {
					id: row.id,
					sku: row.sku,
					name: row.name,
					description: row.description,
					specification: row.specification,
					brand: row.brand,
					unitLabel: row.unitLabel,
					sellingPrice: row.sellingPrice,
					isStockTracked: row.isStockTracked,
					imageObjectKey: row.imageObjectKey,
					category: category && category.isActive ? { id: category.id, slug: category.slug, name: category.name, shortName: category.shortName } : null,
				};
			});
	}

	/** Available quantity per item over every warehouse. */
	async available(ids: string[]): Promise<Map<string, number>> {
		return new Map((await this.balances.availableByItems(ids)).map((row) => [row.itemId, row.available]));
	}

	/** A short-lived URL of the item photo. */
	imageUrl(objectKey: string | null): string | null {
		return documentImageUrl(this.storage, objectKey);
	}
}
