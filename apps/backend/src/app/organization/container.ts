import type { DependencyContainer } from 'tsyringe';
import { OrganizationRepository } from './repositories/organization.repository';
import { OrganizationSlugResolverAdapter } from './adapters/organization-slug-resolver';
import { BetterAuthOrganizationGateway } from './adapters/better-auth-organization';
import { OrganizationService } from './services/organization.service';
import { CompanyProfileRepository } from './repositories/company-profile.repository';
import { DocumentSequenceRepository } from './repositories/document-sequence.repository';
import { CompanyProfileService } from './services/company-profile.service';
import { NumberingService } from './services/numbering.service';
import {
	ORGANIZATION_AUTH_GATEWAY_TOKEN,
	ORGANIZATION_REPOSITORY_TOKEN,
	ORGANIZATION_SERVICE_TOKEN,
	ORGANIZATION_SLUG_RESOLVER_TOKEN,
	COMPANY_PROFILE_REPOSITORY_TOKEN,
	COMPANY_PROFILE_SERVICE_TOKEN,
	DOCUMENT_SEQUENCE_REPOSITORY_TOKEN,
	NUMBERING_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the organization module's repository, Better Auth gateway, and
 * service.
 *
 * @remarks
 * The gateway wraps `auth.api` so all Better Auth–owned state (profile,
 * membership) flows through Better Auth itself; the repository touches only
 * `deletedAt` (soft delete/restore).
 */
export function registerOrganization(container: DependencyContainer): void {
	container.register(ORGANIZATION_REPOSITORY_TOKEN, {
		useClass: OrganizationRepository,
	});
	container.register(ORGANIZATION_SLUG_RESOLVER_TOKEN, {
		useClass: OrganizationSlugResolverAdapter,
	});
	container.register(ORGANIZATION_AUTH_GATEWAY_TOKEN, {
		useClass: BetterAuthOrganizationGateway,
	});
	container.register(ORGANIZATION_SERVICE_TOKEN, {
		useClass: OrganizationService,
	});

	// Company profile and document numbering (company-wide, ADR-0011).
	container.register(COMPANY_PROFILE_REPOSITORY_TOKEN, {
		useClass: CompanyProfileRepository,
	});
	container.register(COMPANY_PROFILE_SERVICE_TOKEN, {
		useClass: CompanyProfileService,
	});
	container.register(DOCUMENT_SEQUENCE_REPOSITORY_TOKEN, {
		useClass: DocumentSequenceRepository,
	});
	container.register(NUMBERING_SERVICE_TOKEN, { useClass: NumberingService });
}
