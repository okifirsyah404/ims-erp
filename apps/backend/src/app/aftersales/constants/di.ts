/**
 * Injection tokens for the after-sales module (M07, ADR-0011 step 6b).
 */
import type { InjectionToken } from 'tsyringe';
import type { IWarrantyRepository } from '../contracts/warranty.contract';
import type { WarrantyService } from '../services/warranty.service';

/** Token resolving to the warranty certificate repository implementation. */
export const WARRANTY_REPOSITORY_TOKEN: InjectionToken<IWarrantyRepository> = Symbol('WARRANTY_REPOSITORY_TOKEN');

/** Token resolving to the {@link WarrantyService}. */
export const WARRANTY_SERVICE_TOKEN: InjectionToken<WarrantyService> = Symbol('WARRANTY_SERVICE_TOKEN');
