import type { DependencyContainer } from 'tsyringe';
import { CATALOG_SERVICE_TOKEN, LISTING_REPOSITORY_TOKEN } from './constants/di';
import { ListingRepository } from './repositories/listing.repository';
import { CatalogService } from './services/catalog.service';

export * from './constants/di';

/**
 * Registers the catalog module (M04 stage 1: what the public website shows).
 *
 * @param container - The tsyringe container to populate
 */
export function registerCatalog(container: DependencyContainer): void {
	container.register(LISTING_REPOSITORY_TOKEN, { useClass: ListingRepository });
	container.register(CATALOG_SERVICE_TOKEN, { useClass: CatalogService });
}
