import type { DependencyContainer } from 'tsyringe';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { USER_REPOSITORY_TOKEN, USER_SERVICE_TOKEN } from './constants/di';

export * from './constants/di';

/**
 * Registers the user module's repository and service.
 */
export function registerUser(container: DependencyContainer): void {
	container.register(USER_REPOSITORY_TOKEN, {
		useClass: UserRepository,
	});
	container.register(USER_SERVICE_TOKEN, {
		useClass: UserService,
	});
}
