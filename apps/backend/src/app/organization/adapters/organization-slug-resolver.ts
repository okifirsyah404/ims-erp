import { inject, injectable } from 'tsyringe';
import type { IOrganizationSlugResolverPort } from '@app/user/contracts/organization-slug-resolver.port';
import { ORGANIZATION_REPOSITORY_TOKEN } from '../constants/di';
import type { IOrganizationRepository } from '../contracts/organization.repository.interface';

/**
 * Organization adapter for the user module's slug resolver port: bulk
 * invite rows may carry `organizationSlug` instead of a UUID.
 */
@injectable()
export class OrganizationSlugResolverAdapter implements IOrganizationSlugResolverPort {
	constructor(
		@inject(ORGANIZATION_REPOSITORY_TOKEN)
		private readonly organizations: IOrganizationRepository,
	) {}

	async resolveIdBySlug(slug: string): Promise<string | null> {
		const organization = await this.organizations.findBySlug(slug);
		return organization?.id ?? null;
	}
}
