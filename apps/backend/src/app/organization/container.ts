import type { DependencyContainer } from 'tsyringe';
import { OrganizationRepository } from './repositories/organization.repository';
import { BetterAuthOrganizationGateway } from './adapters/better-auth-organization';
import { OrganizationService } from './services/organization.service';
import { DocumentNumberingService } from './services/document-numbering.service';
import {
	DOCUMENT_NUMBERING_SERVICE_TOKEN,
	ORGANIZATION_AUTH_GATEWAY_TOKEN,
	ORGANIZATION_REPOSITORY_TOKEN,
	ORGANIZATION_SERVICE_TOKEN,
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
	container.register(ORGANIZATION_AUTH_GATEWAY_TOKEN, {
		useClass: BetterAuthOrganizationGateway,
	});
	container.register(ORGANIZATION_SERVICE_TOKEN, {
		useClass: OrganizationService,
	});
	// ERP-0009 numbering authority. Inventory (and later assets) inject this
	// to mint document codes from per-org sequences.
	container.register(DOCUMENT_NUMBERING_SERVICE_TOKEN, {
		useClass: DocumentNumberingService,
	});
}
