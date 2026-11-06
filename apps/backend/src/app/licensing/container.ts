import type { DependencyContainer } from 'tsyringe';
import { LICENSING_REPOSITORY_TOKEN, LICENSING_SERVICE_TOKEN } from './constants/di';
import { LicensingRepository } from './repositories/licensing.repository';
import { LicensingService } from './services/licensing.service';

export * from './constants/di';

/**
 * Registers the licensing module (M03 stage 1: the license register).
 *
 * @param container - The tsyringe container to populate
 */
export function registerLicensing(container: DependencyContainer): void {
	container.register(LICENSING_REPOSITORY_TOKEN, { useClass: LicensingRepository });
	container.register(LICENSING_SERVICE_TOKEN, { useClass: LicensingService });
}
