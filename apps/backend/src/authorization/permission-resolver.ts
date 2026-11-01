/**
 * Permission seam for the ERP guard (phase 3, decision D4).
 *
 * The guard never touches Drizzle: it resolves {@link IPermissionResolver}
 * through {@link PERMISSION_RESOLVER_TOKEN}. This module stays import-light
 * (no DB, no drizzle) so the guard path can be unit-tested without opening a
 * connection.
 */
import type { InjectionToken } from 'tsyringe';
import type { ErpPermissionRequest } from '@ims-erp/common';

/** Permission resolver seam used by the Elysia guard. */
export interface IPermissionResolver {
	/**
	 * Checks one parsed permission requirement against the caller's roles.
	 *
	 * @param organizationId validated org context (from the guard's
	 * membership resolution, never client-trusted beyond that)
	 * @param roleNames the member's role names (comma-separated `member.role`)
	 * @param request `{ resource: actions[] }` requirement (ALL must pass)
	 */
	hasPermission(
		organizationId: string,
		roleNames: readonly string[],
		request: ErpPermissionRequest,
	): Promise<boolean>;
}

export const PERMISSION_RESOLVER_TOKEN: InjectionToken<IPermissionResolver> =
	Symbol('PERMISSION_RESOLVER');

/**
 * Union-of-grants check shared by the DB resolver and test doubles.
 * Deny-by-default: every requested action must appear in the union.
 *
 * @param grants one grant map per resolved role
 * @param request `{ resource: actions[] }` requirement (ALL must pass)
 */
export function grantsAllow(
	grants: readonly ErpPermissionRequest[],
	request: ErpPermissionRequest,
): boolean {
	const combined: Record<string, Set<string>> = {};
	for (const grant of grants) {
		for (const [resource, actions] of Object.entries(grant ?? {})) {
			const bucket = (combined[resource] ??= new Set<string>());
			for (const action of actions as readonly string[]) bucket.add(action);
		}
	}

	for (const [resource, actions] of Object.entries(request)) {
		const bucket = combined[resource];
		if (!bucket) return false;
		for (const action of actions as readonly string[]) {
			if (!bucket.has(action)) return false;
		}
	}
	return true;
}
