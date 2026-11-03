import type { DependencyContainer } from 'tsyringe';
import { UserRepository } from './repositories/user.repository';
import { InvitationRepository } from './repositories/invitation.repository';
import { UserManagementRepository } from './repositories/user-management.repository';
import { RoleRepository } from './repositories/role.repository';
import { BetterAuthUserGateway } from './services/better-auth-user.gateway';
import { BetterAuthUserManagementGateway } from './services/better-auth-user-management.gateway';
import { LoggerInvitationMailer } from './services/logger-mailer';
import { UserService } from './services/user.service';
import { InvitationService } from './services/invitation.service';
import { RoleManagementService } from './services/role-management.service';
import { UserAdminService } from './services/user-admin.service';
import {
	INVITATION_MAILER_TOKEN,
	INVITATION_REPOSITORY_TOKEN,
	INVITATION_SERVICE_TOKEN,
	ROLE_MANAGEMENT_SERVICE_TOKEN,
	ROLE_REPOSITORY_TOKEN,
	USER_ADMIN_SERVICE_TOKEN,
	USER_AUTH_GATEWAY_TOKEN,
	USER_MANAGEMENT_AUTH_GATEWAY_TOKEN,
	USER_MANAGEMENT_REPOSITORY_TOKEN,
	USER_REPOSITORY_TOKEN,
	USER_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the user module: self-service (repository, Better Auth gateway,
 * service, avatar queue) plus the admin half — invitations, roles and user
 * administration — merged from the former `user-management` module.
 *
 * @remarks
 * The gateways wrap `auth.api` so all Better Auth-owned state (role, ban,
 * password) flows through Better Auth itself; the repositories touch only
 * their own tables. The logger mailer is a stopgap (SMTP later — locked
 * decision D11).
 *
 * The audit ledger is not part of this module: `AuditRepository`,
 * `AuditService` and `AuditQueryService` are registered by
 * {@link import('../audit/container').registerAudit}. This module still
 * *writes* audit entries — its services inject `AUDIT_SERVICE_TOKEN` — which
 * is the intended direction of the dependency: modules own their events, the
 * audit module owns the ledger.
 */
export function registerUser(container: DependencyContainer): void {
	container.register(USER_REPOSITORY_TOKEN, {
		useClass: UserRepository,
	});
	container.register(USER_AUTH_GATEWAY_TOKEN, {
		useClass: BetterAuthUserGateway,
	});
	container.register(USER_SERVICE_TOKEN, {
		useClass: UserService,
	});
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
