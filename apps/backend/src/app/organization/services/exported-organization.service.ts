import { OrganizationRequiredForCodeError, organizationCodeFromSlug } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { ORGANIZATION_REPOSITORY_TOKEN } from '../constants/di';
import type { IOrganizationRepository } from '../contracts/organization.repository.interface';

/**
 * Repository-only facade other modules use for organization facts.
 *
 * @remarks
 * Depends only on the organization repository, so a module that numbers its
 * documents can consume it without a service cycle (`elysia-module` rule 3.5).
 * Never inject {@link import('./organization.service').OrganizationService}
 * across modules: it drives Better Auth and needs request headers.
 */
@injectable()
export class ExportedOrganizationService {
	constructor(
		@inject(ORGANIZATION_REPOSITORY_TOKEN)
		private readonly organizations: Pick<IOrganizationRepository, 'findById' | 'listMemberRoles'>,
	) {}

	/**
	 * Memberships of the live organizations (organization, user, comma-joined
	 * role), so a module can resolve who holds a permission through the
	 * permission resolver (the payroll draft notice, ERP-0120).
	 */
	listMemberRoles(): Promise<{ organizationId: string; userId: string; role: string }[]> {
		return this.organizations.listMemberRoles();
	}

	/**
	 * The `{ORG}` token of document numbers: the organization slug, upper-cased
	 * (`pt-entragate-hit` -> `PT-ENTRAGATE-HIT`).
	 *
	 * @remarks
	 * `findById` is cached and includes soft-deleted rows, so a deleted
	 * organization is filtered here.
	 *
	 * @throws {OrganizationRequiredForCodeError} The organization does not exist or was deleted
	 */
	async requireOrganizationCode(organizationId: string): Promise<string> {
		const organization = await this.organizations.findById(organizationId);
		if (!organization || organization.deletedAt) throw new OrganizationRequiredForCodeError();
		return organizationCodeFromSlug(organization.slug);
	}
}
