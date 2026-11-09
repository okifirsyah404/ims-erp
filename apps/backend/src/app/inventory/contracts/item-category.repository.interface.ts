import type { TItemCategorySelect } from '@drizzle/schemas/inventory.schema';
import type {
	TItemCategoryCreateInput,
	TItemCategoryUpdateInput,
} from './item-category.contract';

/** Persistence port for `inventory.item_categories` (live rows only). */
export interface IItemCategoryRepository {
	/** Live categories ordered by `sort_order`, then name. */
	list(includeInactive: boolean): Promise<TItemCategorySelect[]>;

	findById(id: string): Promise<TItemCategorySelect | null>;

	findBySlug(slug: string): Promise<TItemCategorySelect | null>;

	create(data: TItemCategoryCreateInput): Promise<TItemCategorySelect>;

	update(id: string, data: TItemCategoryUpdateInput): Promise<TItemCategorySelect | null>;

	/** Soft-deletes the category. */
	archive(id: string): Promise<TItemCategorySelect | null>;

	/** Live (not archived) items in the category. */
	countLiveItems(id: string): Promise<number>;
}
