/**
 * Injection tokens for the organization module's repository, auth gateway,
 * and service.
 *
 * @remarks
 * Kept in a standalone constants module so services and the composition
 * root can both import them without a circular dependency.
 *
 * Every token carries an `InjectionToken<T>` annotation (W5 — this module
 * previously used bare `Symbol`s, which left `resolve()` returning `unknown`
 * and made a mismatched `useClass` a runtime failure instead of a type error).
 *
 * The company profile and the numbering series moved to the `company` and
 * `code-number` modules in ERP-0042; their tokens live there.
 */
import type { InjectionToken } from 'tsyringe';
import type { IOrganizationRepository } from '../contracts/organization.repository.interface';
import type { IOrganizationSlugResolverPort } from '@app/user/contracts/organization-slug-resolver.port';
import type { IOrganizationAuthGateway } from '../contracts/organization-auth.gateway.interface';
import type { OrganizationService } from '../services/organization.service';
import type { ExportedOrganizationService } from '../services/exported-organization.service';

/** Token resolving to the {@link IOrganizationRepository} implementation. */
export const ORGANIZATION_REPOSITORY_TOKEN: InjectionToken<IOrganizationRepository> =
	Symbol('ORGANIZATION_REPOSITORY_TOKEN');

/** Cross-module port: slug → id for bulk invite files (implemented here).
 * The token is OWNED by the user module (its contract); re-exported so the
 * adapter registration uses the identical symbol the consumer injects. */
export { ORGANIZATION_SLUG_RESOLVER_TOKEN } from '@app/user/constants/di';

/** Token resolving to the {@link IOrganizationAuthGateway} implementation. */
export const ORGANIZATION_AUTH_GATEWAY_TOKEN: InjectionToken<IOrganizationAuthGateway> =
	Symbol('ORGANIZATION_AUTH_GATEWAY_TOKEN');

/** Token resolving to the {@link OrganizationService} implementation. */
export const ORGANIZATION_SERVICE_TOKEN: InjectionToken<OrganizationService> =
	Symbol('ORGANIZATION_SERVICE_TOKEN');

/**
 * Repository-only facade other modules use for organization facts (the
 * `{ORG}` numbering token). Never inject {@link ORGANIZATION_SERVICE_TOKEN}
 * across modules.
 */
export const EXPORTED_ORGANIZATION_SERVICE_TOKEN: InjectionToken<ExportedOrganizationService> =
	Symbol('EXPORTED_ORGANIZATION_SERVICE_TOKEN');
