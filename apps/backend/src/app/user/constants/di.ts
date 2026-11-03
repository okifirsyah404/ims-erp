import { InjectionToken } from 'tsyringe';
import type { IInvitationRepository } from '../contracts/invitation.repository.interface';
import type { IInvitationMailer } from '../contracts/invitation-mailer.gateway.interface';
import type { IRoleRepository } from '../contracts/role.repository.interface';
import type {
	IUserManagementAuthGateway,
} from '../contracts/user-management-auth.gateway.interface';
import type { IUserManagementRepository } from '../contracts/user-management.repository.interface';
import type { InvitationService } from '../services/invitation.service';
import type { RoleManagementService } from '../services/role-management.service';
import type { UserAdminService } from '../services/user-admin.service';
import type { IUserRepository } from '../contracts/user.repository.interface';
import type { IUserAuthGateway } from '../contracts/user-auth.gateway.interface';
import type { UserService } from '../services/user.service';

/**
 * Injection tokens for the user module's repository, auth gateway, and
 * service, plus the admin half (invitations, roles, user administration)
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
export const ROLE_REPOSITORY_TOKEN: InjectionToken<IRoleRepository> = Symbol(
	'ROLE_REPOSITORY',
);
export const ROLE_MANAGEMENT_SERVICE_TOKEN: InjectionToken<RoleManagementService> =
	Symbol('ROLE_MANAGEMENT_SERVICE');
export const USER_ADMIN_SERVICE_TOKEN: InjectionToken<UserAdminService> = Symbol(
	'USER_ADMIN_SERVICE',
);
