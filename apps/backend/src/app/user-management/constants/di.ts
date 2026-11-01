import { InjectionToken } from 'tsyringe';
import type {
	IAuditRepository,
	IInvitationRepository,
	IRoleRepository,
	IUserManagementRepository,
} from '../contracts/repositories.interface';
import type {
	IInvitationMailer,
	IUserManagementAuthGateway,
} from '../contracts/gateways.interface';
import type { InvitationService } from '../services/invitation.service';
import type { AuditService } from '../services/audit.service';
import type { RoleService } from '../services/role.service';
import type { RoleManagementService } from '../services/role-management.service';
import type { UserAdminService } from '../services/user-admin.service';
import type { AuditQueryService } from '../services/audit-query.service';

/**
 * Injection tokens for the user-management module. Standalone constants
 * module so services and the composition root never form an import cycle.
 */
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
export const AUDIT_SERVICE_TOKEN: InjectionToken<AuditService> = Symbol(
	'AUDIT_SERVICE',
);
export const ROLE_SERVICE_TOKEN: InjectionToken<RoleService> = Symbol(
	'ROLE_SERVICE',
);
export const ROLE_REPOSITORY_TOKEN: InjectionToken<IRoleRepository> = Symbol(
	'ROLE_REPOSITORY',
);
export const ROLE_MANAGEMENT_SERVICE_TOKEN: InjectionToken<RoleManagementService> =
	Symbol('ROLE_MANAGEMENT_SERVICE');
export const AUDIT_REPOSITORY_TOKEN: InjectionToken<IAuditRepository> = Symbol(
	'AUDIT_REPOSITORY',
);
export const USER_ADMIN_SERVICE_TOKEN: InjectionToken<UserAdminService> = Symbol(
	'USER_ADMIN_SERVICE',
);
export const AUDIT_QUERY_SERVICE_TOKEN: InjectionToken<AuditQueryService> =
	Symbol('AUDIT_QUERY_SERVICE');
