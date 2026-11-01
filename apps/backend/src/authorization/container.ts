import type { DependencyContainer } from 'tsyringe';
import { DynamicPermissionResolver } from './dynamic-permissions';
import { PERMISSION_RESOLVER_TOKEN } from './permission-resolver';

/**
 * Composition root for the authorization layer. Registers the DB-backed
 * permission resolver consumed by the `erpGuard` macro.
 */
export function registerAuthorization(container: DependencyContainer): void {
	container.register(PERMISSION_RESOLVER_TOKEN, {
		useClass: DynamicPermissionResolver,
	});
}

export { PERMISSION_RESOLVER_TOKEN } from './permission-resolver';
export type { IPermissionResolver } from './permission-resolver';
