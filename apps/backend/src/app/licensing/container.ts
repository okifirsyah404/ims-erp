import type { DependencyContainer } from 'tsyringe';
import { BetterAuthApiKeyIssuer } from './adapters/better-auth-api-keys';
import {
	API_KEY_ISSUER_TOKEN,
	LICENSE_API_REPOSITORY_TOKEN,
	LICENSE_API_SERVICE_TOKEN,
	LICENSING_REPOSITORY_TOKEN,
	LICENSING_SERVICE_TOKEN,
} from './constants/di';
import { LicenseApiRepository } from './repositories/license-api.repository';
import { LicensingRepository } from './repositories/licensing.repository';
import { LicenseApiService } from './services/license-api.service';
import { LicensingService } from './services/licensing.service';

export * from './constants/di';

/**
 * Registers the licensing module (M03: the license register and its API).
 *
 * @param container - The tsyringe container to populate
 */
export function registerLicensing(container: DependencyContainer): void {
	container.register(LICENSING_REPOSITORY_TOKEN, { useClass: LicensingRepository });
	container.register(LICENSING_SERVICE_TOKEN, { useClass: LicensingService });
	container.register(LICENSE_API_REPOSITORY_TOKEN, { useClass: LicenseApiRepository });
	container.register(API_KEY_ISSUER_TOKEN, { useClass: BetterAuthApiKeyIssuer });
	container.register(LICENSE_API_SERVICE_TOKEN, { useClass: LicenseApiService });
}
