import type { DependencyContainer } from 'tsyringe';
import { OrganizationRepository } from './repositories/organization.repository';
import { OrganizationSlugResolverAdapter } from './adapters/organization-slug-resolver';
import { BetterAuthOrganizationGateway } from './adapters/better-auth-organization';
import { OrganizationService } from './services/organization.service';
import { ExportedOrganizationService } from './services/exported-organization.service';
import {
	EXPORTED_ORGANIZATION_SERVICE_TOKEN,
	ORGANIZATION_AUTH_GATEWAY_TOKEN,
	ORGANIZATION_REPOSITORY_TOKEN,
	ORGANIZATION_SERVICE_TOKEN,
	ORGANIZATION_SLUG_RESOLVER_TOKEN,
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
 *
 * The company profile and the numbering series moved out to the `company` and
 * `code-number` modules in ERP-0042.
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
	container.register(EXPORTED_ORGANIZATION_SERVICE_TOKEN, {
		useClass: ExportedOrganizationService,
	});
}
