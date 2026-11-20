import type { TProductCategorySelect } from '@drizzle/schemas/product.schema';
import type {
	TProductCategoryCreateInput,
	TProductCategoryUpdateInput,
} from './product-category.contract';

/** Persistence port for `inventory.item_categories` (live rows only). */
export interface IProductCategoryRepository {
	/** Live categories ordered by `sort_order`, then name. */
	list(includeInactive: boolean): Promise<TProductCategorySelect[]>;

	findById(id: string): Promise<TProductCategorySelect | null>;

	findBySlug(slug: string): Promise<TProductCategorySelect | null>;

	create(data: TProductCategoryCreateInput): Promise<TProductCategorySelect>;

	update(id: string, data: TProductCategoryUpdateInput): Promise<TProductCategorySelect | null>;

	/** Soft-deletes the category. */
	archive(id: string): Promise<TProductCategorySelect | null>;

	/** Live (not archived) items in the category. */
	countLiveProducts(id: string): Promise<number>;
}
