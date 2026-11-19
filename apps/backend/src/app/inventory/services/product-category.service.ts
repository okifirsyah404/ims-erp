import type { TProductCategorySelect } from '@drizzle/schemas/inventory.schema';
import { inject, injectable } from 'tsyringe';
import { PRODUCT_CATEGORY_REPOSITORY_TOKEN } from '../constants/di';
import type {
	TProductCategoryCreateInput,
	TProductCategoryUpdateInput,
} from '../contracts/product-category.contract';
import type { IProductCategoryRepository } from '../contracts/product-category.repository.interface';
import {
	ProductCategoryHasProductsError,
	ProductCategoryNotFoundError,
	ProductCategorySlugTakenError,
} from '../errors/inventory.errors';

/**
 * Product category use cases (ADR-0011): one level, company-wide.
 *
 * @remarks
 * The slug is fixed after creation because the public website links to it.
 * Archiving is refused while live products still use the category; deactivate
 * it instead to stop offering it.
 */
@injectable()
export class ProductCategoryService {
	constructor(
		@inject(PRODUCT_CATEGORY_REPOSITORY_TOKEN)
		private readonly repository: IProductCategoryRepository,
	) {}

	list(includeInactive = false): Promise<TProductCategorySelect[]> {
		return this.repository.list(includeInactive);
	}

	async get(id: string): Promise<TProductCategorySelect> {
		const category = await this.repository.findById(id);
		if (!category) throw new ProductCategoryNotFoundError();
		return category;
	}

	async create(data: TProductCategoryCreateInput): Promise<TProductCategorySelect> {
		if (await this.repository.findBySlug(data.slug)) throw new ProductCategorySlugTakenError();
		return this.repository.create(data);
	}

	async update(id: string, data: TProductCategoryUpdateInput): Promise<TProductCategorySelect> {
		const updated = await this.repository.update(id, data);
		if (!updated) throw new ProductCategoryNotFoundError();
		return updated;
	}

	async archive(id: string): Promise<TProductCategorySelect> {
		await this.get(id);
		const live = await this.repository.countLiveProducts(id);
		if (live > 0) throw new ProductCategoryHasProductsError(live);
		const archived = await this.repository.archive(id);
		if (!archived) throw new ProductCategoryNotFoundError();
		return archived;
	}
}
