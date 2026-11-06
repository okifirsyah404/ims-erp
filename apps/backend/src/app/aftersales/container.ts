import type { DependencyContainer } from 'tsyringe';
import { WARRANTY_REPOSITORY_TOKEN, WARRANTY_SERVICE_TOKEN } from './constants/di';
import { WarrantyRepository } from './repositories/warranty.repository';
import { WarrantyService } from './services/warranty.service';

export * from './constants/di';

/**
 * Registers the after-sales module (M07, ADR-0011 step 6b).
 *
 * @param container - The tsyringe container to populate
 */
export function registerAftersales(container: DependencyContainer): void {
	container.register(WARRANTY_REPOSITORY_TOKEN, { useClass: WarrantyRepository });
	container.register(WARRANTY_SERVICE_TOKEN, { useClass: WarrantyService });
}
