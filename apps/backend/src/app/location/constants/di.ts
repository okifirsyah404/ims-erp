import { InjectionToken } from 'tsyringe';
import type {
	IProvinceRepository,
} from '../contracts/province.repository.interface';
import type {
	IRegencyRepository,
} from '../contracts/regency.repository.interface';
import type {
	IDistrictRepository,
} from '../contracts/district.repository.interface';
import type {
	IVillageRepository,
} from '../contracts/village.repository.interface';
import type { LocationService } from '../services/location.service';

/**
 * Injection tokens for the location module's repositories and service.
 *
 * @remarks
 * Kept in a standalone constants module so services and the composition
 * root can both import them without a circular dependency.
 */
/** Token resolving to the {@link IProvinceRepository} implementation. */
export const PROVINCE_REPOSITORY_TOKEN: InjectionToken<IProvinceRepository> =
	Symbol('PROVINCE_REPOSITORY');

/** Token resolving to the {@link IRegencyRepository} implementation. */
export const REGENCY_REPOSITORY_TOKEN: InjectionToken<IRegencyRepository> =
	Symbol('REGENCY_REPOSITORY');

/** Token resolving to the {@link IDistrictRepository} implementation. */
export const DISTRICT_REPOSITORY_TOKEN: InjectionToken<IDistrictRepository> =
	Symbol('DISTRICT_REPOSITORY');

/** Token resolving to the {@link IVillageRepository} implementation. */
export const VILLAGE_REPOSITORY_TOKEN: InjectionToken<IVillageRepository> =
	Symbol('VILLAGE_REPOSITORY');

/** Token resolving to the {@link LocationService} implementation. */
export const LOCATION_SERVICE_TOKEN: InjectionToken<LocationService> = Symbol(
	'LOCATION_SERVICE',
);
