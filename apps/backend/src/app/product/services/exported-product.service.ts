import { inject, injectable } from 'tsyringe';
import {
	PRODUCT_CATEGORY_REPOSITORY_TOKEN,
	PRODUCT_REPOSITORY_TOKEN,
	PRODUCT_SERIAL_COUNTS_TOKEN,
} from '../constants/di';
import type { TProductSerialCounts } from '../contracts/product-counts.port';
import type { IProductRepository } from '../contracts/product.repository.interface';
import type { IProductCategoryRepository } from '../contracts/product-category.repository.interface';
import {
	ProductCategorySlugTakenError,
	ProductNotFoundError,
	ProductSkuTakenError,
} from '../errors/product.errors';
import type { ProductService } from './product.service';
import type { ProductCategoryService } from './product-category.service';

/**
 * Cross-module export facade of the product module.
 *
 * @remarks
 * Consumed through {@link EXPORTED_PRODUCT_SERVICE_TOKEN}. It depends **only
 * on the module's own repositories** plus inventory's repository-only facade
 * for the unit count, never on another module's *service* and never on this
 * module's services (`ProductService` / `ProductCategoryService`), so no
 * service-to-service cycle can form: `ExportedInventoryService` reads product
 * kinds back through this class, and this class reads serial counts through
 * `ExportedInventoryService` (ADR-0026, "cycle breaking"). Both are plain
 * constructor wiring over stateless repositories.
 *
 * Business rules (shape checks, numbering, audit) stay in `ProductService`;
 * this facade answers the `assert`/`resolve` questions other modules ask
 * before writing a logical product id (ADR-0014) and relays reads.
 */
@injectable()
export class ExportedProductService {
	constructor(
		@inject(PRODUCT_REPOSITORY_TOKEN)
		private readonly products: Pick<
			IProductRepository,
			| 'findById'
			| 'findByIds'
			| 'findActiveByIds'
			| 'findBySku'
			| 'productKinds'
			| 'searchByNameOrSku'
		>,
		@inject(PRODUCT_CATEGORY_REPOSITORY_TOKEN)
		private readonly categories: Pick<IProductCategoryRepository, 'findById' | 'findBySlug'>,
		/**
		 * The serial count comes from `inventory` (the units are its table) through
		 * this port, not through a constructor edge to its facade: that edge would
		 * close the product ↔ inventory cycle (ADR-0026, see the port's docs).
		 */
		@inject(PRODUCT_SERIAL_COUNTS_TOKEN)
		private readonly serialCounts: TProductSerialCounts,
	) {}

	/**
	 * The alive product, or a thrown `ProductNotFoundError`.
	 *
	 * @throws {ProductNotFoundError} When the id is unknown or soft-deleted
	 */
	async assertProduct(productId: string): Promise<TProductSnapshot> {
		const product = await this.products.findById(productId);
		if (!product) throw new ProductNotFoundError();
		return toSnapshot(product);
	}

	/**
	 * Whether an alive, active product exists (the check a document writer makes
	 * before freezing a product line).
	 */
	async isProductActive(productId: string): Promise<boolean> {
		const [product] = await this.products.findActiveByIds([productId]);
		return product !== undefined;
	}

	/**
	 * Products by id, for label and snapshot lookups on another module's rows.
	 *
	 * @remarks
	 * Archived products are included: a historical stock row or document line
	 * must still print the name it was posted with.
	 */
	async productsById(ids: string[]): Promise<Map<string, TProductSnapshot>> {
		if (ids.length === 0) return new Map();
		const rows = await this.products.findByIds(ids);
		return new Map(rows.map((row) => [row.id, toSnapshot(row)]));
	}

	/** Alive product names by id; unknown or archived ids are absent. */
	async getNameMap(ids: string[]): Promise<Map<string, string>> {
		const map = await this.productsById(ids);
		return new Map([...map].map(([id, product]) => [id, product.name]));
	}

	/**
	 * Products whose SKU or name matches a free-text search.
	 *
	 * @param search - Customer-typed fragment
	 */
	async findBySearch(search: string): Promise<Array<{ id: string }>> {
		return this.products.searchByNameOrSku(search);
	}

	/**
	 * The kind of each product, for callers that group another module's rows by
	 * it (the warehouse kind counts, ADR-0026).
	 *
	 * @param ids - Product ids to resolve
	 */
	async productKinds(ids: string[]): Promise<Map<string, string>> {
		if (ids.length === 0) return new Map();
		const rows = await this.products.productKinds(ids);
		return new Map(rows.map((row) => [row.id, row.productKind]));
	}

	/**
	 * Live serial units of the product.
	 *
	 * @remarks
	 * The unit rows live in `inventory` (ADR-0026), so the count is delegated
	 * to its facade instead of being queried here.
	 */
	async countUnits(productId: string): Promise<number> {
		return this.serialCounts.countSerials(productId);
	}

	/**
	 * Throws unless the category exists and is active.
	 *
	 * @throws {ProductNotFoundError} When the category id is unknown
	 */
	async assertCategoryUsable(categoryId: string): Promise<void> {
		const category = await this.categories.findById(categoryId);
		if (!category || category.deletedAt || !category.isActive) {
			throw new ProductNotFoundError();
		}
	}

	/** Category names by id (finance profitability by business line, ERP-0150). */
	async categoryNames(ids: string[]): Promise<Map<string, string>> {
		const names = new Map<string, string>();
		for (const id of new Set(ids)) {
			const category = await this.categories.findById(id);
			if (category) names.set(id, category.name);
		}
		return names;
	}

	/** Whether the product category exists and is usable. */
	async categoryExists(categoryId: string): Promise<boolean> {
		const category = await this.categories.findById(categoryId);
		return !!category && !category.deletedAt && category.isActive;
	}

	/**
	 * Throws unless the slug is free.
	 *
	 * @throws {ProductCategorySlugTakenError} When another live category uses it
	 */
	async assertCategorySlugFree(slug: string): Promise<void> {
		const existing = await this.categories.findBySlug(slug);
		if (existing) throw new ProductCategorySlugTakenError();
	}

	/**
	 * Throws unless the SKU is free in the scope.
	 *
	 * @throws {ProductSkuTakenError} When another live product uses it
	 */
	async assertSkuFree(organizationId: string | null, sku: string): Promise<void> {
		const existing = await this.products.findBySku(organizationId, sku);
		if (existing) throw new ProductSkuTakenError();
	}

}

function toSnapshot(row: TProductSnapshot): TProductSnapshot {
	return {
		id: row.id,
		code: row.code,
		sku: row.sku,
		name: row.name,
		unitLabel: row.unitLabel,
		sellingPrice: row.sellingPrice,
		purchasePrice: row.purchasePrice,
		specification: row.specification,
		productKind: row.productKind,
		imageObjectKey: row.imageObjectKey,
		isActive: row.isActive,
		isSerialized: row.isSerialized,
		isStockTracked: row.isStockTracked,
		productCategoryId: row.productCategoryId ?? null,
	};
}

/** Everything another module may read about one product. */
export type TProductSnapshot = {
	id: string;
	code: string;
	sku: string;
	name: string;
	unitLabel: string;
	/** Exact integer IDR minor units. */
	sellingPrice: number;
	purchasePrice: number;
	specification: string | null;
	productKind: string;
	imageObjectKey: string | null;
	isActive: boolean;
	isSerialized: boolean;
	isStockTracked: boolean;
	/** Revenue posting-rule discriminator (ERP-0135). */
	productCategoryId: string | null;
};

/** Type-only re-exports for the module's own services. */
export type { ProductCategoryService, ProductService };
