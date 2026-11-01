import {
	ProvinceRepository,
} from './repositories/province.repository';
import {
	RegencyRepository,
} from './repositories/regency.repository';
import {
	DistrictRepository,
} from './repositories/district.repository';
import {
	VillageRepository,
} from './repositories/village.repository';
import { LocationService } from './services/location.service';
import {
	PROVINCE_REPOSITORY_TOKEN,
	REGENCY_REPOSITORY_TOKEN,
	DISTRICT_REPOSITORY_TOKEN,
	VILLAGE_REPOSITORY_TOKEN,
	LOCATION_SERVICE_TOKEN,
} from './constants/di';
import { DependencyContainer } from 'tsyringe';

export * from './constants/di';

/**
 * Registers the location module's repositories and service.
 *
 * @remarks
 * Repositories are registered as singletons since they are stateless
 * besides their injected database/redis connections. Each repository is
 * bound to its own symbol token so consumers depend on the interface type
 * rather than a concrete class.
 *
 * @param container - The tsyringe container to populate
 */
export function registerLocation(container: DependencyContainer): void {
	container.register(PROVINCE_REPOSITORY_TOKEN, {
		useClass: ProvinceRepository,
	});
	container.register(REGENCY_REPOSITORY_TOKEN, {
		useClass: RegencyRepository,
	});
	container.register(DISTRICT_REPOSITORY_TOKEN, {
		useClass: DistrictRepository,
	});
	container.register(VILLAGE_REPOSITORY_TOKEN, {
		useClass: VillageRepository,
	});
	container.register(LOCATION_SERVICE_TOKEN, {
		useClass: LocationService,
	});
}
