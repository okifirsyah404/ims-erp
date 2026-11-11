/**
 * ERP organization access control for Better Auth's organization() plugin.
 *
 * Architecture decision (ADR-0006):
 * - All ERP authorization lives in organization membership roles (the
 *   organization() plugin), NOT in the global admin()/user role.
 * - A global admin without organization membership has no ERP access.
 * - Static, code-defined roles (dynamic access control is NOT enabled).
 * - Deny-by-default: only explicitly granted permissions pass.
 * - Built-in organization resources (organization, member, invitation, ac)
 *   are preserved from defaultStatements and granted only where the role
 *   policy requires them.
 *
 * Built on the browser-safe catalog in `@ims-erp/common`
 * (`erpStatements`, `erpRoleGrants`) so server and client can never drift.
 */
import { createAccessControl } from 'better-auth/plugins/access';
import type { AccessControl, Role } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/organization/access';
import {
	builtInOrgStatements,
	erpRoleGrants,
	erpRoleNames,
	erpStatements,
	portalStatements,
	type ErpAction,
	type ErpPermissionRequest,
	type ErpResource,
	type ErpRoleName,
} from '@ims-erp/common';

/**
 * Full statement vocabulary: Better Auth organization defaults + the ERP
 * catalog + the restricted portal resources + the extended built-in
 * organization vocabulary. The portal resources are not in `erpStatements`
 * (they are not internal back-office vocabulary) but are granted through the
 * same access control so permission checks stay uniform.
 *
 * `builtInOrgStatements` is the shared source for the built-in organization
 * resources, so the server and the client cannot drift.
 */
export const organizationStatements = {
	...defaultStatements,
	...erpStatements,
	...portalStatements,
	...builtInOrgStatements,
} as const;

export type OrganizationStatements = typeof organizationStatements;

export const erpAccessControl: AccessControl<OrganizationStatements> =
	createAccessControl(organizationStatements);

/**
 * Convert a role grant (plain data from the shared catalog) into a Better
 * Auth role built on the ERP access control. Only resources present in the
 * grant are included; everything else is denied by omission.
 */
function toRole(grants: ErpPermissionRequest): Role<OrganizationStatements> {
	const statements: Record<string, readonly string[]> = {};
	for (const [resource, actions] of Object.entries(grants)) {
		// Trust the shared catalog's typing; filter for safety at runtime.
		const valid = organizationStatements[resource as ErpResource | 'self_service' | 'customer_portal' | 'investor_portal'];
		if (!valid) continue;
		statements[resource] = (actions as readonly string[]).filter((action) =>
			(valid as readonly string[]).includes(action),
		);
	}
	return erpAccessControl.newRole(statements as never) as Role<OrganizationStatements>;
}

export const erpRoles: Record<ErpRoleName, Role<OrganizationStatements>> = {
	owner: toRole(erpRoleGrants.owner),
	admin: toRole(erpRoleGrants.admin),
	member: toRole(erpRoleGrants.member),
	operations_manager: toRole(erpRoleGrants.operations_manager),
	sales_manager: toRole(erpRoleGrants.sales_manager),
	sales: toRole(erpRoleGrants.sales),
	project_manager: toRole(erpRoleGrants.project_manager),
	technician: toRole(erpRoleGrants.technician),
	freelancer: toRole(erpRoleGrants.freelancer),
	purchasing: toRole(erpRoleGrants.purchasing),
	warehouse: toRole(erpRoleGrants.warehouse),
	finance: toRole(erpRoleGrants.finance),
	accountant: toRole(erpRoleGrants.accountant),
	hr: toRole(erpRoleGrants.hr),
	customer_service: toRole(erpRoleGrants.customer_service),
	marketing: toRole(erpRoleGrants.marketing),
	investor: toRole(erpRoleGrants.investor),
	customer: toRole(erpRoleGrants.customer),
	auditor: toRole(erpRoleGrants.auditor),
};

/**
 * Server-side permission check against the static roles, used by the Elysia
 * authorization layer. Mirrors Better Auth's hasPermission semantics
 * (multi-role union) without touching the database.
 */
export function authorizeErpPermissions(
	roles: readonly string[],
	request: ErpPermissionRequest,
): boolean {
	if (roles.length === 0) return false;
	let combined: Record<string, Set<string>> | undefined;

	for (const roleName of roles) {
		const role = erpRoles[roleName as ErpRoleName];
		if (!role) continue;
		if (!combined) combined = {};
		for (const [resource, actions] of Object.entries(role.statements)) {
			const bucket = (combined[resource] ??= new Set<string>());
			for (const action of actions as readonly string[]) bucket.add(action);
		}
	}
	if (!combined) return false;

	for (const [resource, actions] of Object.entries(request)) {
		const bucket = combined[resource];
		if (!bucket) return false;
		for (const action of actions as readonly string[]) {
			if (!bucket.has(action)) return false;
		}
	}
	return true;
}

/** Typed helper for route-level checks. */
export function requirePermission<R extends ErpResource>(
	roles: readonly string[],
	resource: R,
	...actions: readonly ErpAction<R>[]
): boolean {
	return authorizeErpPermissions(roles, { [resource]: actions } as ErpPermissionRequest);
}

/** Expose the resolved grant set for a role (browser-safe consumption is
 * done through `@ims-erp/common`, this is for server-side diagnostics). */
export function getRoleGrants(role: ErpRoleName): ErpPermissionRequest {
	return erpRoleGrants[role];
}
