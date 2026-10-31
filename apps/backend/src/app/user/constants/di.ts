import { InjectionToken } from 'tsyringe';
import type { IUserRepository } from '../contracts/user.repository.interface';
import type { IUserAuthGateway } from '../contracts/user-auth.gateway.interface';
import type { UserService } from '../services/user.service';

/**
 * Injection tokens for the user module's repository, auth gateway, and
 * service.
 *
 * @remarks
 * Kept in a standalone constants module so services and the composition
 * root can both import them without a circular dependency.
 */
export const USER_REPOSITORY_TOKEN: InjectionToken<IUserRepository> = Symbol(
	'USER_REPOSITORY',
);
export const USER_AUTH_GATEWAY_TOKEN: InjectionToken<IUserAuthGateway> =
	Symbol('USER_AUTH_GATEWAY');
export const USER_SERVICE_TOKEN: InjectionToken<UserService> = Symbol(
	'USER_SERVICE',
);
