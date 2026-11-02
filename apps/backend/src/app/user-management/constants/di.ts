import { InjectionToken } from 'tsyringe';
import type {
	IInvitationRepository,
	IRoleRepository,
	IUserManagementRepository,
} from '../contracts/repositories.interface';
import type {
	IInvitationMailer,
	IUserManagementAuthGateway,
} from '../contracts/gateways.interface';
import type { InvitationService } from '../../user/services/invitation.service';
import type { RoleManagementService } from '../../user/services/role-management.service';
import type { UserAdminService } from '../../user/services/user-admin.service';

/**
 * Injection tokens for the user-management module. Standalone constants
 * module so services and the composition root never form an import cycle.
 *
 * @remarks
 * W7 moved this module's *services* to `app/user/services/`, so the service
 * type imports below now reach across modules. They stay `import type`, which
 * is erased at compile time — the runtime graph has no cycle, and the
 * direction is one-way: user-management's repositories/contracts are still
 * owned here (the repository merge was deliberately deferred).
 *
 * Audit tokens live in `@app/audit` (W6). This module's services still inject
 * `AUDIT_SERVICE_TOKEN` — they write ledger entries but do not own the ledger.
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
export const ROLE_REPOSITORY_TOKEN: InjectionToken<IRoleRepository> = Symbol(
	'ROLE_REPOSITORY',
);
export const ROLE_MANAGEMENT_SERVICE_TOKEN: InjectionToken<RoleManagementService> =
	Symbol('ROLE_MANAGEMENT_SERVICE');
export const USER_ADMIN_SERVICE_TOKEN: InjectionToken<UserAdminService> = Symbol(
	'USER_ADMIN_SERVICE',
);
