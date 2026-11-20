/**
 * Repository-only facade over the location data every address-owning module
 * needs (ADR-0024 Q10).
 *
 * @remarks
 * Address tables store only `village_id`; the district / regency / province path
 * is derived here, never duplicated as columns. Kept repository-only (no use
 * cases, no controller calls) so it can be injected by `company`, `customer`,
 * `supplier`, `inventory`, `project` and `human-resource` without a cycle.
 */
import type { TVillageSelect } from '@drizzle/schemas/location.schema';
import { inject, injectable } from 'tsyringe';

import { VILLAGE_REPOSITORY_TOKEN } from '../constants/di';
import type { IVillageRepository } from '../contracts/village.repository.interface';
import type { TVillagePath } from '../contracts/village.repository.interface';
import { VillageNotFoundError } from '../errors/location.errors';

@injectable()
export class ExportedLocationService {
	constructor(
		@inject(VILLAGE_REPOSITORY_TOKEN)
		private readonly villageRepository: IVillageRepository,
	) {}

	/**
	 * Asserts that a village exists and is not soft-deleted.
	 *
	 * @throws VillageNotFoundError when the id does not resolve
	 */
	async assertVillage(villageId: string): Promise<TVillageSelect> {
		const village = await this.villageRepository.findById(villageId);
		if (!village) throw new VillageNotFoundError(villageId);
		return village;
	}

	/**
	 * Resolves the administrative path of the given villages in one batch.
	 *
	 * @param villageIds - Village ids to resolve; unknown ids are omitted
	 */
	resolveVillagePath(villageIds: string[]): Promise<TVillagePath[]> {
		return this.villageRepository.findVillagePaths(villageIds);
	}
}
