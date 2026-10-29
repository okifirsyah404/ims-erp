import { describe, expect, test } from 'bun:test';
import { LocationService } from '../../src/app/location/services/location.service';
import type {
	IDistrictRepository,
} from '../../src/app/location/contracts/district.repository.interface';
import type {
	IProvinceRepository,
	TProvincePaginationRequest,
} from '../../src/app/location/contracts/province.repository.interface';
import type { IRegencyRepository } from '../../src/app/location/contracts/regency.repository.interface';
import type { IVillageRepository } from '../../src/app/location/contracts/village.repository.interface';

function stubRepository<T extends object>() {
	const calls: unknown[][] = [];
	const stub = new Proxy({} as T, {
		get(_target, prop: string) {
			return (...args: unknown[]) => {
				calls.push([prop, ...args]);
				return Promise.resolve(null);
			};
		},
	});
	return { stub, calls };
}

function makeService() {
	const province = stubRepository<IProvinceRepository>();
	const regency = stubRepository<IRegencyRepository>();
	const district = stubRepository<IDistrictRepository>();
	const village = stubRepository<IVillageRepository>();
	const service = new LocationService(
		province.stub,
		regency.stub,
		district.stub,
		village.stub,
	);
	return { service, province, regency, district, village };
}

describe('LocationService', () => {
	test('paginateProvinces delegates to provinceRepository.paginate', async () => {
		const { service, province } = makeService();
		const request: TProvincePaginationRequest = { page: 1, limit: 10 };
		await service.paginateProvinces(request);
		expect(province.calls).toEqual([['paginate', request]]);
	});

	test('getProvince delegates to provinceRepository.findById', async () => {
		const { service, province } = makeService();
		await service.getProvince('11');
		expect(province.calls).toEqual([['findById', '11']]);
	});

	test('getRegenciesByProvinceCode delegates to regencyRepository', async () => {
		const { service, regency } = makeService();
		await service.getRegenciesByProvinceCode('32');
		expect(regency.calls).toEqual([['findByProvinceCode', '32']]);
	});

	test('getDistrictsByRegency delegates to districtRepository', async () => {
		const { service, district } = makeService();
		await service.getDistrictsByRegency('3204');
		expect(district.calls).toEqual([['findByRegencyId', '3204']]);
	});

	test('getVillagesByDistrictCode delegates to villageRepository', async () => {
		const { service, village } = makeService();
		await service.getVillagesByDistrictCode('3204010');
		expect(village.calls).toEqual([['findByDistrictCode', '3204010']]);
	});

	test('null propagation: repository returning null surfaces as null', async () => {
		const { regency, district, village } = makeService();
		const nullRepo = {
			findById: () => Promise.resolve(null),
		} as unknown as IProvinceRepository;
		const isolated = new LocationService(
			nullRepo,
			regency.stub,
			district.stub,
			village.stub,
		);
		expect(await isolated.getProvince('nope')).toBeNull();
	});
});
