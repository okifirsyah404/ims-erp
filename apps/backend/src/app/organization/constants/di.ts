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
import type { IOrganizationAuthGateway } from '../contracts/organization-auth.gateway.interface';
import type { OrganizationService } from '../services/organization.service';

/** Token resolving to the {@link IOrganizationRepository} implementation. */
export const ORGANIZATION_REPOSITORY_TOKEN: InjectionToken<IOrganizationRepository> =
	Symbol('ORGANIZATION_REPOSITORY_TOKEN');

/** Token resolving to the {@link IOrganizationAuthGateway} implementation. */
export const ORGANIZATION_AUTH_GATEWAY_TOKEN: InjectionToken<IOrganizationAuthGateway> =
	Symbol('ORGANIZATION_AUTH_GATEWAY_TOKEN');

/** Token resolving to the {@link OrganizationService} implementation. */
export const ORGANIZATION_SERVICE_TOKEN: InjectionToken<OrganizationService> =
	Symbol('ORGANIZATION_SERVICE_TOKEN');
