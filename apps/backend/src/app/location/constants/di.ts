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
export const PROVINCE_REPOSITORY_TOKEN: InjectionToken<IProvinceRepository> =
	Symbol('PROVINCE_REPOSITORY');
export const REGENCY_REPOSITORY_TOKEN: InjectionToken<IRegencyRepository> =
	Symbol('REGENCY_REPOSITORY');
export const DISTRICT_REPOSITORY_TOKEN: InjectionToken<IDistrictRepository> =
	Symbol('DISTRICT_REPOSITORY');
export const VILLAGE_REPOSITORY_TOKEN: InjectionToken<IVillageRepository> =
	Symbol('VILLAGE_REPOSITORY');
export const LOCATION_SERVICE_TOKEN: InjectionToken<LocationService> = Symbol(
	'LOCATION_SERVICE',
);
