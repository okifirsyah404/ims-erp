/**
 * Drizzle-free static permission resolver.
 *
 * ERP organization roles are a closed enum: authorization reads
 * `erpRoleGrants` (the shared catalog in `@ims-erp/common`) directly. There
 * is no dynamic per-organization role table to consult; this module exists
 * purely as the `IPermissionResolver` seam the Elysia guard consumes (kept
 * so the guard path stays import-light and unit-testable).
 */
import { injectable } from 'tsyringe';
import type { ErpPermissionRequest } from '@ims-erp/common';
import { authorizeErpPermissions } from '@providers/better-auth/ac/organization-ac';
import type { IPermissionResolver } from './permission-resolver';

@injectable()
export class StaticPermissionResolver implements IPermissionResolver {
	async hasPermission(
		_organizationId: string,
		roleNames: readonly string[],
		request: ErpPermissionRequest,
	): Promise<boolean> {
		return authorizeErpPermissions(roleNames, request);
	}
}
