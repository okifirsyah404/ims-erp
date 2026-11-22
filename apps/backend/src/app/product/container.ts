import type { DependencyContainer } from 'tsyringe';
import { AUDIT_SERVICE_TOKEN } from '@app/audit/constants/di';
import type { AuditService } from '@app/audit/services/audit.service';
import { AuditWriter } from '@shared/audit';
import {
	EXPORTED_PRODUCT_SERVICE_TOKEN,
	PRODUCT_CATEGORY_REPOSITORY_TOKEN,
	PRODUCT_CATEGORY_SERVICE_TOKEN,
	PRODUCT_CODE_NUMBERING_REPOSITORY_TOKEN,
	PRODUCT_IMAGE_REPOSITORY_TOKEN,
	PRODUCT_IMAGE_SERVICE_TOKEN,
	PRODUCT_KINDS_SERVICE_TOKEN,
	PRODUCT_LISTING_SERVICE_TOKEN,
	PRODUCT_NUMBERING_SERVICE_TOKEN,
	PRODUCT_REPOSITORY_TOKEN,
	PRODUCT_SERIAL_COUNTS_TOKEN,
	PRODUCT_SERVICE_TOKEN,
} from './constants/di';
import { UNWIRED_PRODUCT_COUNTS } from './contracts/product-counts.port';
import { ProductCategoryRepository } from './repositories/product-category.repository';
import { ProductCodeNumberingRepository } from './repositories/code-numbering.repository';
import { ProductImageRepository } from './repositories/product-image.repository';
import { ProductRepository } from './repositories/product.repository';
import { ExportedProductService } from './services/exported-product.service';
import { ProductCategoryService } from './services/product-category.service';
import { ProductImageService } from './services/product-image.service';
import { ProductListingService } from './services/product-listing.service';
import { ProductNumberingService } from './services/product-numbering.service';
import { ProductService } from './services/product.service';

export * from './constants/di';

/**
 * Registers the product module's repositories and services.
 *
 * @remarks
 * Explicit `container.register` calls, matching every other domain in this
 * codebase — there is no decorator-based auto-registration.
 *
 * Registration order at the composition root: `registerProduct` and
 * `registerWarehouse` before `registerInventory`. Everything is resolved
 * lazily on first use, but the numbering services need the company module and
 * the export facades need the inventory facade, so the inventory module must
 * also be registered before a request touches the product export.
 *
 * @param container - The tsyringe container to populate
 */
export function registerProduct(container: DependencyContainer): void {
	// Shared fire-and-forget audit adapter — each module owns its instance
	// (no cross-module token), resolved eagerly like the other modules do.
	container.registerInstance(
		AuditWriter,
		new AuditWriter(container.resolve<AuditService>(AUDIT_SERVICE_TOKEN)),
	);

	container.register(PRODUCT_CODE_NUMBERING_REPOSITORY_TOKEN, {
		useClass: ProductCodeNumberingRepository,
	});
	container.register(PRODUCT_NUMBERING_SERVICE_TOKEN, {
		useClass: ProductNumberingService,
	});
	container.register(PRODUCT_REPOSITORY_TOKEN, { useClass: ProductRepository });
	container.register(PRODUCT_CATEGORY_REPOSITORY_TOKEN, {
		useClass: ProductCategoryRepository,
	});
	container.register(PRODUCT_SERVICE_TOKEN, { useClass: ProductService });
	container.register(PRODUCT_IMAGE_REPOSITORY_TOKEN, { useClass: ProductImageRepository });
	container.register(PRODUCT_IMAGE_SERVICE_TOKEN, { useClass: ProductImageService });
	container.register(PRODUCT_CATEGORY_SERVICE_TOKEN, {
		useClass: ProductCategoryService,
	});
	container.register(PRODUCT_LISTING_SERVICE_TOKEN, { useClass: ProductListingService });
	// Cross-module export facade — repository-only, safe for other modules.
	container.register(EXPORTED_PRODUCT_SERVICE_TOKEN, {
		useClass: ExportedProductService,
	});
	// Cycle breaker (ADR-0026): the serial-count port is wired to the inventory
	// facade by `registerInventory`, which overwrites this placeholder. The
	// product side never reads it, so a miss here is a wiring bug and throws.
	container.register(PRODUCT_SERIAL_COUNTS_TOKEN, {
		useValue: UNWIRED_PRODUCT_COUNTS,
	});
	// The kind lookup the inventory facade asks for, as a token (not a typeref)
	// to keep the two facades out of each other's constructor metadata.
	container.register(PRODUCT_KINDS_SERVICE_TOKEN, {
		useFactory: (c: DependencyContainer) =>
			c.resolve<ExportedProductService>(EXPORTED_PRODUCT_SERVICE_TOKEN),
	});
}
