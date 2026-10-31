import type { DependencyContainer } from 'tsyringe';
import { UserRepository } from './repositories/user.repository';
import { BetterAuthUserGateway } from './services/better-auth-user.gateway';
import { UserService } from './services/user.service';
import {
	USER_AUTH_GATEWAY_TOKEN,
	USER_REPOSITORY_TOKEN,
	USER_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the user module's repository, Better Auth gateway, and
 * service.
 *
 * @remarks
 * The gateway wraps `auth.api` so all Better Auth–owned state (role, ban,
 * password) flows through Better Auth itself; the repository touches only
 * `deletedAt`.
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
}
