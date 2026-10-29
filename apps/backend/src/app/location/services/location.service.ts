import type {
	IProvinceRepository,
	TProvincePaginationRequest,
} from '../contracts/province.repository.interface';
import type {
	IRegencyRepository,
	TRegencyPaginationRequest,
} from '../contracts/regency.repository.interface';
import type {
	IDistrictRepository,
	TDistrictPaginationRequest,
} from '../contracts/district.repository.interface';
import type {
	IVillageRepository,
	TVillagePaginationRequest,
} from '../contracts/village.repository.interface';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TProvinceSelect,
	TRegencySelect,
	TDistrictSelect,
	TVillageSelect,
} from '@drizzle/schemas/location.schema';
import { inject, injectable } from 'tsyringe';
import {
	PROVINCE_REPOSITORY_TOKEN,
	REGENCY_REPOSITORY_TOKEN,
	DISTRICT_REPOSITORY_TOKEN,
	VILLAGE_REPOSITORY_TOKEN,
} from '../constants/di';

/**
 * Application service orchestrating location data for selection endpoints.
 *
 * @remarks
 * A thin pass-through over the four location repositories; all caching and
 * soft-delete behavior lives in the repositories. Inherits the soft-delete
 * and cache semantics documented on each repository contract.
 */
@injectable()
export class LocationService {
	constructor(
		@inject(PROVINCE_REPOSITORY_TOKEN)
		private readonly provinceRepository: IProvinceRepository,
		@inject(REGENCY_REPOSITORY_TOKEN)
		private readonly regencyRepository: IRegencyRepository,
		@inject(DISTRICT_REPOSITORY_TOKEN)
		private readonly districtRepository: IDistrictRepository,
		@inject(VILLAGE_REPOSITORY_TOKEN)
		private readonly villageRepository: IVillageRepository,
	) {}

	/**
	 * Fetches one page of provinces matching the given filters.
	 */
	paginateProvinces(
		request: TProvincePaginationRequest,
	): Promise<TPaginationResult<TProvinceSelect>> {
		return this.provinceRepository.paginate(request);
	}

	/**
	 * Fetches one province by identifier.
	 *
	 * @returns The province, or `null` when absent or soft-deleted
	 */
	getProvince(id: string): Promise<TProvinceSelect | null> {
		return this.provinceRepository.findById(id);
	}

	/**
	 * Fetches one page of regencies matching the given filters.
	 */
	paginateRegencies(
		request: TRegencyPaginationRequest,
	): Promise<TPaginationResult<TRegencySelect>> {
		return this.regencyRepository.paginate(request);
	}

	/**
	 * Fetches one regency by identifier.
	 *
	 * @returns The regency, or `null` when absent or soft-deleted
	 */
	getRegency(id: string): Promise<TRegencySelect | null> {
		return this.regencyRepository.findById(id);
	}

	/**
	 * Fetches all non-deleted regencies of one province, by province code.
	 */
	getRegenciesByProvinceCode(
		provinceCode: string,
	): Promise<TRegencySelect[]> {
		return this.regencyRepository.findByProvinceCode(provinceCode);
	}

	/**
	 * Fetches all non-deleted regencies of one province, by province id.
	 */
	getRegenciesByProvince(provinceId: string): Promise<TRegencySelect[]> {
		return this.regencyRepository.findByProvinceId(provinceId);
	}

	/**
	 * Fetches one page of districts matching the given filters.
	 */
	paginateDistricts(
		request: TDistrictPaginationRequest,
	): Promise<TPaginationResult<TDistrictSelect>> {
		return this.districtRepository.paginate(request);
	}

	/**
	 * Fetches one district by identifier.
	 *
	 * @returns The district, or `null` when absent or soft-deleted
	 */
	getDistrict(id: string): Promise<TDistrictSelect | null> {
		return this.districtRepository.findById(id);
	}

	/**
	 * Fetches all non-deleted districts of one regency, by regency code.
	 */
	getDistrictsByRegencyCode(
		regencyCode: string,
	): Promise<TDistrictSelect[]> {
		return this.districtRepository.findByRegencyCode(regencyCode);
	}

	/**
	 * Fetches all non-deleted districts of one regency, by regency id.
	 */
	getDistrictsByRegency(regencyId: string): Promise<TDistrictSelect[]> {
		return this.districtRepository.findByRegencyId(regencyId);
	}

	/**
	 * Fetches one page of villages matching the given filters.
	 */
	paginateVillages(
		request: TVillagePaginationRequest,
	): Promise<TPaginationResult<TVillageSelect>> {
		return this.villageRepository.paginate(request);
	}

	/**
	 * Fetches one village by identifier.
	 *
	 * @returns The village, or `null` when absent or soft-deleted
	 */
	getVillage(id: string): Promise<TVillageSelect | null> {
		return this.villageRepository.findById(id);
	}

	/**
	 * Fetches all non-deleted villages of one district, by district code.
	 */
	getVillagesByDistrictCode(
		districtCode: string,
	): Promise<TVillageSelect[]> {
		return this.villageRepository.findByDistrictCode(districtCode);
	}

	/**
	 * Fetches all non-deleted villages of one district, by district id.
	 */
	getVillagesByDistrict(districtId: string): Promise<TVillageSelect[]> {
		return this.villageRepository.findByDistrictId(districtId);
	}
}
