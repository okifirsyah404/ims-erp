import type { DependencyContainer } from 'tsyringe';
import { StaticPermissionResolver } from './static-permissions';
import { PERMISSION_RESOLVER_TOKEN } from './permission-resolver';

/**
 * Composition root for the authorization layer. Registers the static
 * permission resolver (closed ERP role catalog) consumed by the `erpGuard`
 * macro.
 */
export function registerAuthorization(container: DependencyContainer): void {
	container.register(PERMISSION_RESOLVER_TOKEN, {
		useClass: StaticPermissionResolver,
	});
}

export { PERMISSION_RESOLVER_TOKEN } from './permission-resolver';
export type { IPermissionResolver } from './permission-resolver';
