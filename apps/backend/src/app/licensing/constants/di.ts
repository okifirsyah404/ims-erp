/**
 * Injection tokens for the licensing module (M03 stage 1).
 */
import type { InjectionToken } from 'tsyringe';
import type { ILicensingRepository } from '../contracts/licensing.contract';
import type { LicensingService } from '../services/licensing.service';

/** Token resolving to the license register repository implementation. */
export const LICENSING_REPOSITORY_TOKEN: InjectionToken<ILicensingRepository> = Symbol('LICENSING_REPOSITORY_TOKEN');

/** Token resolving to the {@link LicensingService}. */
export const LICENSING_SERVICE_TOKEN: InjectionToken<LicensingService> = Symbol('LICENSING_SERVICE_TOKEN');
