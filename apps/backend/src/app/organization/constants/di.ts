/**
 * Injection tokens for the organization module's repository, auth gateway,
 * and service.
 *
 * @remarks
 * Kept in a standalone constants module so services and the composition
 * root can both import them without a circular dependency. Unlike the
 * other modules these tokens are untyped (`Symbol`), since the organization
 * module predates the typed-token convention.
 */

/** Token resolving to the {@link IOrganizationRepository} implementation. */
export const ORGANIZATION_REPOSITORY_TOKEN = Symbol('ORGANIZATION_REPOSITORY_TOKEN');

/** Token resolving to the {@link IOrganizationAuthGateway} implementation. */
export const ORGANIZATION_AUTH_GATEWAY_TOKEN = Symbol('ORGANIZATION_AUTH_GATEWAY_TOKEN');

/** Token resolving to the {@link OrganizationService} implementation. */
export const ORGANIZATION_SERVICE_TOKEN = Symbol('ORGANIZATION_SERVICE_TOKEN');
