/**
 * Injection tokens for the licensing module (M03 stages 1–2).
 */
import type { InjectionToken } from 'tsyringe';
import type { IApiKeyIssuer } from '../adapters/better-auth-api-keys';
import type { ILicenseApiRepository } from '../contracts/license-api.contract';
import type { ILicensingRepository } from '../contracts/licensing.contract';
import type { LicenseApiService } from '../services/license-api.service';
import type { LicensingService } from '../services/licensing.service';

/** Token resolving to the license register repository implementation. */
export const LICENSING_REPOSITORY_TOKEN: InjectionToken<ILicensingRepository> = Symbol('LICENSING_REPOSITORY_TOKEN');

/** Token resolving to the {@link LicensingService}. */
export const LICENSING_SERVICE_TOKEN: InjectionToken<LicensingService> = Symbol('LICENSING_SERVICE_TOKEN');

/** Token resolving to the license API repository (keys, seats, events). */
export const LICENSE_API_REPOSITORY_TOKEN: InjectionToken<ILicenseApiRepository> = Symbol('LICENSE_API_REPOSITORY_TOKEN');

/** Token resolving to the {@link LicenseApiService}. */
export const LICENSE_API_SERVICE_TOKEN: InjectionToken<LicenseApiService> = Symbol('LICENSE_API_SERVICE_TOKEN');

/** Token resolving to the machine-key port (Better Auth API keys). */
export const API_KEY_ISSUER_TOKEN: InjectionToken<IApiKeyIssuer> = Symbol('API_KEY_ISSUER_TOKEN');
