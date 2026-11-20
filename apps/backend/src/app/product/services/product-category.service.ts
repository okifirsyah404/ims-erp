import type { TProductCategorySelect } from '@drizzle/schemas/product.schema';
import { inject, injectable } from 'tsyringe';
import { EXPORTED_PRODUCT_SERVICE_TOKEN, PRODUCT_CATEGORY_REPOSITORY_TOKEN } from '../constants/di';
import type {
	TProductCategoryCreateInput,
	TProductCategoryUpdateInput,
} from '../contracts/product-category.contract';
import type { IProductCategoryRepository } from '../contracts/product-category.repository.interface';
import {
	ProductCategoryHasProductsError,
	ProductCategoryNotFoundError,
} from '../errors/product.errors';
import type { ExportedProductService } from './exported-product.service';

/**
 * Product category use cases (ADR-0011): one level, company-wide.
 *
 * @remarks
 * The slug is fixed after creation because the public website links to it.
 * Archiving is refused while live products still use the category; deactivate
 * it instead to stop offering it. The slug check and the live-product count go
 * through the module's export facade, so every caller enforces the same rule
 * (ADR-0026).
 */
@injectable()
export class ProductCategoryService {
	constructor(
		@inject(PRODUCT_CATEGORY_REPOSITORY_TOKEN)
		private readonly repository: IProductCategoryRepository,
		@inject(EXPORTED_PRODUCT_SERVICE_TOKEN)
		private readonly exported: Pick<ExportedProductService, 'assertCategorySlugFree'>,
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
		await this.exported.assertCategorySlugFree(data.slug);
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
