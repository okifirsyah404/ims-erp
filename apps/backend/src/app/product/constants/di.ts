/**
 * DI tokens for the product module.
 *
 * @remarks
 * Every token carries the `InjectionToken<T>` annotation. Bare `Symbol(...)`
 * leaves `container.resolve()` returning `unknown`, which forces casts at
 * every call site.
 */
import type { InjectionToken } from 'tsyringe';
import type { IProductRepository } from '../contracts/product.repository.interface';
import type { IProductCategoryRepository } from '../contracts/product-category.repository.interface';
import type { ProductService } from '../services/product.service';
import type { ProductCategoryService } from '../services/product-category.service';
import type { ProductImageService } from '../services/product-image.service';
import type { ProductListingService } from '../services/product-listing.service';
import type { ProductCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { ProductNumberingService } from '../services/product-numbering.service';
import type { ExportedProductService } from '../services/exported-product.service';
import type { TProductSerialCounts } from '../contracts/product-counts.port';

export const PRODUCT_REPOSITORY_TOKEN: InjectionToken<IProductRepository> =
	Symbol('PRODUCT_REPOSITORY');
export const PRODUCT_CATEGORY_REPOSITORY_TOKEN: InjectionToken<IProductCategoryRepository> =
	Symbol('PRODUCT_CATEGORY_REPOSITORY');
export const PRODUCT_SERVICE_TOKEN: InjectionToken<ProductService> =
	Symbol('PRODUCT_SERVICE');
export const PRODUCT_CATEGORY_SERVICE_TOKEN: InjectionToken<ProductCategoryService> =
	Symbol('PRODUCT_CATEGORY_SERVICE');
/** Token resolving to the {@link ProductImageService} (document photo of a product). */
export const PRODUCT_IMAGE_SERVICE_TOKEN: InjectionToken<ProductImageService> =
	Symbol('PRODUCT_IMAGE_SERVICE_TOKEN');
/** Token resolving to the {@link ProductListingService} — the website catalog contract (M04). */
export const PRODUCT_LISTING_SERVICE_TOKEN: InjectionToken<ProductListingService> =
	Symbol('PRODUCT_LISTING_SERVICE_TOKEN');
/** `product.code_numberings` (ADR-0024 Q6). */
export const PRODUCT_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<ProductCodeNumberingRepository> =
	Symbol('PRODUCT_CODE_NUMBERING_REPOSITORY');
/** Issues the `item_product` / `item_material` / `item_component` codes. */
export const PRODUCT_NUMBERING_SERVICE_TOKEN: InjectionToken<ProductNumberingService> =
	Symbol('PRODUCT_NUMBERING_SERVICE');
/**
 * Cross-module export facade over product reads. Depends only on the module's
 * own repositories (plus the serial-count port), so consumers cannot form a
 * service-to-service cycle.
 */
export const EXPORTED_PRODUCT_SERVICE_TOKEN: InjectionToken<ExportedProductService> =
	Symbol('EXPORTED_PRODUCT_SERVICE');
/**
 * `TProductSerialCounts` (live units per product), wired to the inventory
 * facade for the inventory side of the graph and to a throwing placeholder on
 * the product side. See `contracts/product-counts.port.ts`.
 */
export const PRODUCT_SERIAL_COUNTS_TOKEN: InjectionToken<TProductSerialCounts> =
	Symbol('PRODUCT_SERIAL_COUNTS');
/**
 * The product-kind lookup as a bare factory target, registered by the inventory
 * module's facade port (`src/app/inventory/services/product-kinds.port.ts`).
 *
 * @remarks
 * A factory token, not a constructor edge: `ExportedProductService` and
 * `ExportedInventoryService` are each other's dependencies, and typeref
 * injection would walk that cycle in tsyringe's metadata and throw at boot
 * (ADR-0026, "cycle breaking").
 */
export const PRODUCT_KINDS_SERVICE_TOKEN: InjectionToken<{
	productKinds(ids: string[]): Promise<Map<string, string>>;
}> = Symbol('PRODUCT_KINDS_SERVICE');
