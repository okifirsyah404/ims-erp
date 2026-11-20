import { InjectionToken } from 'tsyringe';
import type { IInvitationRepository } from '../contracts/invitation.repository.interface';
import type { IInvitationMailer } from '../contracts/invitation-mailer.gateway.interface';
import type {
	IUserManagementAuthGateway,
} from '../contracts/user-management-auth.gateway.interface';
import type { IUserManagementRepository } from '../contracts/user-management.repository.interface';
import type { InvitationService } from '../services/invitation.service';
import type { UserAdminService } from '../services/user-admin.service';
import type { IUserRepository } from '../contracts/user.repository.interface';
import type { IUserAuthGateway } from '../contracts/user-auth.gateway.interface';
import type { UserService } from '../services/user.service';
import type { IUserPersonalFieldsPort } from '../contracts/user-personal-fields.port';
import type { IInvitationEmployeePort } from '../contracts/invitation-employee.port';
import type { IOrganizationSlugResolverPort } from '../contracts/organization-slug-resolver.port';
import type { IPortalAuthGateway, IPortalIdentityRepository, IPortalMailer } from '../contracts/portal-account.contract';
import type { PortalAccountService } from '../services/portal-account.service';
import type { IUserPreferenceRepository } from '../repositories/user-preference.repository';
import type { UserPreferenceService } from '../services/user-preference.service';
import type { CustomerPortalNotifier } from '../services/customer-portal-notifier.service';

/** Customer-portal logins (ERP-0022). `PORTAL_ACCOUNT_SERVICE_TOKEN` is the contract other modules use. */
export const PORTAL_IDENTITY_REPOSITORY_TOKEN: InjectionToken<IPortalIdentityRepository> = Symbol('PORTAL_IDENTITY_REPOSITORY');
export const PORTAL_AUTH_GATEWAY_TOKEN: InjectionToken<IPortalAuthGateway> = Symbol('PORTAL_AUTH_GATEWAY');
export const PORTAL_MAILER_TOKEN: InjectionToken<IPortalMailer> = Symbol('PORTAL_MAILER');
export const PORTAL_ACCOUNT_SERVICE_TOKEN: InjectionToken<PortalAccountService> = Symbol('PORTAL_ACCOUNT_SERVICE');

/** Cross-module port: slug → id for bulk invite files. */
export const ORGANIZATION_SLUG_RESOLVER_TOKEN: InjectionToken<IOrganizationSlugResolverPort> =
	Symbol('ORGANIZATION_SLUG_RESOLVER');

/** Cross-module port: invite plus employee creation, implemented by HR (ERP-0034). */
export const INVITATION_EMPLOYEE_PORT_TOKEN: InjectionToken<
	IInvitationEmployeePort<unknown>
> = Symbol('INVITATION_EMPLOYEE_PORT');

/** Cross-module port: HR reads and writes personal fields on `auth.users`. */
export const USER_PERSONAL_FIELDS_PORT_TOKEN: InjectionToken<IUserPersonalFieldsPort> =
	Symbol('USER_PERSONAL_FIELDS_PORT');

/**
 * Injection tokens for the user module's repository, auth gateway, and
 * service, plus the admin half (invitations, user administration)
 * merged from `user-management` — no token collisions existed, so names are
 * kept verbatim.
 *
 * @remarks
 * Kept in a standalone constants module so services and the composition
 * root can both import them without a circular dependency.
 *
 * Audit tokens live in `@app/audit`. The admin services below still inject
 * `AUDIT_SERVICE_TOKEN` — they write ledger entries but do not own the ledger.
 */
export const USER_REPOSITORY_TOKEN: InjectionToken<IUserRepository> = Symbol(
	'USER_REPOSITORY',
);
export const USER_AUTH_GATEWAY_TOKEN: InjectionToken<IUserAuthGateway> =
	Symbol('USER_AUTH_GATEWAY');
export const USER_SERVICE_TOKEN: InjectionToken<UserService> = Symbol(
	'USER_SERVICE',
);
export const INVITATION_REPOSITORY_TOKEN: InjectionToken<IInvitationRepository> =
	Symbol('INVITATION_REPOSITORY');
export const USER_MANAGEMENT_REPOSITORY_TOKEN: InjectionToken<IUserManagementRepository> =
	Symbol('USER_MANAGEMENT_REPOSITORY');
export const USER_MANAGEMENT_AUTH_GATEWAY_TOKEN: InjectionToken<IUserManagementAuthGateway> =
	Symbol('USER_MANAGEMENT_AUTH_GATEWAY');
export const INVITATION_MAILER_TOKEN: InjectionToken<IInvitationMailer> =
	Symbol('INVITATION_MAILER');
export const INVITATION_SERVICE_TOKEN: InjectionToken<InvitationService> =
	Symbol('INVITATION_SERVICE');
export const USER_ADMIN_SERVICE_TOKEN: InjectionToken<UserAdminService> = Symbol(
	'USER_ADMIN_SERVICE',
);

export const USER_PREFERENCE_REPOSITORY_TOKEN: InjectionToken<IUserPreferenceRepository> = Symbol('USER_PREFERENCE_REPOSITORY');
/** Per-user preferences (ERP-0075), exported for the portal module. */
export const USER_PREFERENCE_SERVICE_TOKEN: InjectionToken<UserPreferenceService> = Symbol('USER_PREFERENCE_SERVICE');

/** In-app notifications to a customer's portal logins (ERP-0077), exported for Sales and After-sales. */
export const CUSTOMER_PORTAL_NOTIFIER_TOKEN: InjectionToken<CustomerPortalNotifier> = Symbol('CUSTOMER_PORTAL_NOTIFIER');
