import type { DependencyContainer } from 'tsyringe';
import { UserRepository } from './repositories/user.repository';
import { InvitationRepository } from './repositories/invitation.repository';
import { UserManagementRepository } from './repositories/user-management.repository';
import { BetterAuthUserGateway } from './adapters/better-auth-user';
import { BetterAuthUserManagementGateway } from './adapters/better-auth-user-management';
import { QueueInvitationMailer } from './adapters/queue-mailer';
import { UserService } from './services/user.service';
import { UserPreferenceRepository } from './repositories/user-preference.repository';
import { UserPreferenceService } from './services/user-preference.service';
import { CustomerPortalNotifier } from './services/customer-portal-notifier.service';
import { InvitationService } from './services/invitation.service';
import { UserAdminService } from './services/user-admin.service';
import {
	USER_PREFERENCE_REPOSITORY_TOKEN,
	USER_PREFERENCE_SERVICE_TOKEN,
	CUSTOMER_PORTAL_NOTIFIER_TOKEN,
	INVITATION_MAILER_TOKEN,
	INVITATION_REPOSITORY_TOKEN,
	INVITATION_SERVICE_TOKEN,
	PORTAL_ACCOUNT_SERVICE_TOKEN,
	PORTAL_AUTH_GATEWAY_TOKEN,
	PORTAL_IDENTITY_REPOSITORY_TOKEN,
	PORTAL_MAILER_TOKEN,
	USER_ADMIN_SERVICE_TOKEN,
	USER_AUTH_GATEWAY_TOKEN,
	USER_MANAGEMENT_AUTH_GATEWAY_TOKEN,
	USER_MANAGEMENT_REPOSITORY_TOKEN,
	USER_PERSONAL_FIELDS_PORT_TOKEN,
	USER_REPOSITORY_TOKEN,
	USER_SERVICE_TOKEN,
} from './constants/di';
import { UserPersonalFieldsAdapter } from './adapters/user-personal-fields';
import { BetterAuthPortalGateway } from './adapters/better-auth-portal';
import { QueuePortalMailer } from './adapters/queue-portal-mailer';
import { PortalIdentityRepository } from './repositories/portal-identity.repository';
import { PortalAccountService } from './services/portal-account.service';

export * from './constants/di';

/**
 * Registers the user module: self-service (repository, Better Auth gateway,
 * service, avatar queue) plus the admin half — invitations and user
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
	container.register(USER_MANAGEMENT_AUTH_GATEWAY_TOKEN, {
		useClass: BetterAuthUserManagementGateway,
	});
	container.register(INVITATION_MAILER_TOKEN, {
		useClass: QueueInvitationMailer,
	});
	container.register(USER_ADMIN_SERVICE_TOKEN, { useClass: UserAdminService });
	container.register(INVITATION_SERVICE_TOKEN, {
		useClass: InvitationService,
	});
	container.register(USER_PERSONAL_FIELDS_PORT_TOKEN, {
		useClass: UserPersonalFieldsAdapter,
	});
	// Customer-portal logins (ERP-0022).
	container.register(PORTAL_IDENTITY_REPOSITORY_TOKEN, { useClass: PortalIdentityRepository });
	container.register(PORTAL_AUTH_GATEWAY_TOKEN, { useClass: BetterAuthPortalGateway });
	container.register(PORTAL_MAILER_TOKEN, { useClass: QueuePortalMailer });
	container.register(PORTAL_ACCOUNT_SERVICE_TOKEN, { useClass: PortalAccountService });
	container.register(USER_PREFERENCE_REPOSITORY_TOKEN, { useClass: UserPreferenceRepository });
	container.register(USER_PREFERENCE_SERVICE_TOKEN, { useClass: UserPreferenceService });
	container.register(CUSTOMER_PORTAL_NOTIFIER_TOKEN, { useClass: CustomerPortalNotifier });
}
