import type { DependencyContainer } from 'tsyringe';
import { InvitationRepository } from './repositories/invitation.repository';
import { UserManagementRepository } from './repositories/user-management.repository';
import { BetterAuthUserManagementGateway } from './services/better-auth-user-management.gateway';
import { LoggerInvitationMailer } from './services/logger-mailer';
import { InvitationService } from './services/invitation.service';
import { AuditService } from './services/audit.service';
import { RoleService } from './services/role.service';
import {
	AUDIT_SERVICE_TOKEN,
	INVITATION_MAILER_TOKEN,
	INVITATION_REPOSITORY_TOKEN,
	INVITATION_SERVICE_TOKEN,
	ROLE_SERVICE_TOKEN,
	USER_MANAGEMENT_AUTH_GATEWAY_TOKEN,
	USER_MANAGEMENT_REPOSITORY_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the user-management module: repositories, Better Auth gateway,
 * the logger mailer (SMTP later — locked decision D11), and the services.
 */
export function registerUserManagement(container: DependencyContainer): void {
	container.register(INVITATION_REPOSITORY_TOKEN, {
		useClass: InvitationRepository,
	});
	container.register(USER_MANAGEMENT_REPOSITORY_TOKEN, {
		useClass: UserManagementRepository,
	});
	container.register(USER_MANAGEMENT_AUTH_GATEWAY_TOKEN, {
		useClass: BetterAuthUserManagementGateway,
	});
	container.register(INVITATION_MAILER_TOKEN, {
		useClass: LoggerInvitationMailer,
	});
	container.register(AUDIT_SERVICE_TOKEN, { useClass: AuditService });
	container.register(ROLE_SERVICE_TOKEN, { useClass: RoleService });
	container.register(INVITATION_SERVICE_TOKEN, {
		useClass: InvitationService,
	});
}
