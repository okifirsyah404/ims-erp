import type { DependencyContainer } from 'tsyringe';
import { InvitationRepository } from './repositories/invitation.repository';
import { UserManagementRepository } from './repositories/user-management.repository';
import { RoleRepository } from './repositories/role.repository';
import { BetterAuthUserManagementGateway } from '../user/services/better-auth-user-management.gateway';
import { LoggerInvitationMailer } from '../user/services/logger-mailer';
import { InvitationService } from '../user/services/invitation.service';
import { RoleManagementService } from '../user/services/role-management.service';
import { UserAdminService } from '../user/services/user-admin.service';
import {
	INVITATION_MAILER_TOKEN,
	INVITATION_REPOSITORY_TOKEN,
	INVITATION_SERVICE_TOKEN,
	ROLE_MANAGEMENT_SERVICE_TOKEN,
	ROLE_REPOSITORY_TOKEN,
	USER_ADMIN_SERVICE_TOKEN,
	USER_MANAGEMENT_AUTH_GATEWAY_TOKEN,
	USER_MANAGEMENT_REPOSITORY_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the user-management module: repositories, Better Auth gateway,
 * the logger mailer (SMTP later — locked decision D11), and the services.
 *
 * @remarks
 * The audit ledger is no longer part of this module (W6): `AuditRepository`,
 * `AuditService` and `AuditQueryService` are registered by
 * {@link import('../audit/container').registerAudit}. This module still
 * *writes* audit entries — its services inject `AUDIT_SERVICE_TOKEN` — which
 * is the intended direction of the dependency: modules own their events, the
 * audit module owns the ledger.
 *
 * W7 note: the services registered below now live in
 * `app/user/services/` (the service half of the user-management → user
 * merge). They stay wired here because everything they depend on —
 * repositories, contracts and tokens — is still owned by this module. The
 * repository merge was deliberately deferred, so this container is the seam
 * where the two halves still meet.
 */
export function registerUserManagement(container: DependencyContainer): void {
	container.register(INVITATION_REPOSITORY_TOKEN, {
		useClass: InvitationRepository,
	});
	container.register(USER_MANAGEMENT_REPOSITORY_TOKEN, {
		useClass: UserManagementRepository,
	});
	container.register(ROLE_REPOSITORY_TOKEN, { useClass: RoleRepository });
	container.register(USER_MANAGEMENT_AUTH_GATEWAY_TOKEN, {
		useClass: BetterAuthUserManagementGateway,
	});
	container.register(INVITATION_MAILER_TOKEN, {
		useClass: LoggerInvitationMailer,
	});
	container.register(ROLE_MANAGEMENT_SERVICE_TOKEN, {
		useClass: RoleManagementService,
	});
	container.register(USER_ADMIN_SERVICE_TOKEN, { useClass: UserAdminService });
	container.register(INVITATION_SERVICE_TOKEN, {
		useClass: InvitationService,
	});
}
