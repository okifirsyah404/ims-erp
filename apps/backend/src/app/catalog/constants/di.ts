/**
 * Injection tokens for the catalog module (M04 stage 1: the website catalog).
 */
import type { InjectionToken } from 'tsyringe';
import type { IListingRepository } from '../contracts/catalog.contract';
import type { CatalogService } from '../services/catalog.service';

/** Token resolving to the web listing repository implementation. */
export const LISTING_REPOSITORY_TOKEN: InjectionToken<IListingRepository> = Symbol('LISTING_REPOSITORY_TOKEN');

/** Token resolving to the {@link CatalogService}. */
export const CATALOG_SERVICE_TOKEN: InjectionToken<CatalogService> = Symbol('CATALOG_SERVICE_TOKEN');
