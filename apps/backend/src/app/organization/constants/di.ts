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
 */
import type { InjectionToken } from 'tsyringe';
import type { IOrganizationRepository } from '../contracts/organization.repository.interface';
import type { IOrganizationSlugResolverPort } from '@app/user/contracts/organization-slug-resolver.port';
import type { IOrganizationAuthGateway } from '../contracts/organization-auth.gateway.interface';
import type { OrganizationService } from '../services/organization.service';
import type { ICompanyProfileRepository } from '../contracts/company-profile.repository.interface';
import type { IDocumentSequenceRepository } from '../contracts/document-sequence.repository.interface';
import type { CompanyProfileService } from '../services/company-profile.service';
import type { NumberingService } from '../services/numbering.service';

/** Token resolving to the {@link IOrganizationRepository} implementation. */
export const ORGANIZATION_REPOSITORY_TOKEN: InjectionToken<IOrganizationRepository> =
	Symbol('ORGANIZATION_REPOSITORY_TOKEN');

/** Cross-module port: slug → id for bulk invite files (implemented here). */
export const ORGANIZATION_SLUG_RESOLVER_TOKEN: InjectionToken<IOrganizationSlugResolverPort> =
	Symbol('ORGANIZATION_SLUG_RESOLVER');

/** Token resolving to the {@link IOrganizationAuthGateway} implementation. */
export const ORGANIZATION_AUTH_GATEWAY_TOKEN: InjectionToken<IOrganizationAuthGateway> =
	Symbol('ORGANIZATION_AUTH_GATEWAY_TOKEN');

/** Token resolving to the {@link OrganizationService} implementation. */
export const ORGANIZATION_SERVICE_TOKEN: InjectionToken<OrganizationService> =
	Symbol('ORGANIZATION_SERVICE_TOKEN');

/** Token resolving to the {@link ICompanyProfileRepository} implementation. */
export const COMPANY_PROFILE_REPOSITORY_TOKEN: InjectionToken<ICompanyProfileRepository> =
	Symbol('COMPANY_PROFILE_REPOSITORY_TOKEN');

/** Token resolving to the {@link CompanyProfileService} implementation. */
export const COMPANY_PROFILE_SERVICE_TOKEN: InjectionToken<CompanyProfileService> =
	Symbol('COMPANY_PROFILE_SERVICE_TOKEN');

/** Token resolving to the {@link IDocumentSequenceRepository} implementation. */
export const DOCUMENT_SEQUENCE_REPOSITORY_TOKEN: InjectionToken<IDocumentSequenceRepository> =
	Symbol('DOCUMENT_SEQUENCE_REPOSITORY_TOKEN');

/**
 * Token resolving to the {@link NumberingService} — the exported API other
 * modules use to number their documents.
 */
export const NUMBERING_SERVICE_TOKEN: InjectionToken<NumberingService> =
	Symbol('NUMBERING_SERVICE_TOKEN');
