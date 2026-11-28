/**
 * Browser-safe ERP access control for the Better Auth client.
 *
 * Built from the same shared catalog the backend uses
 * (`@ims-erp/common` -> erpStatements / erpRoleGrants), so server and client
 * permission definitions cannot drift. This file contains NO server code,
 * no database imports, and no secrets - safe for the frontend bundle.
 */
import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements as adminDefaultStatements, userAc } from 'better-auth/plugins/admin/access';
import { defaultStatements } from 'better-auth/plugins/organization/access';
import {
	builtInOrgStatements,
	erpRoleGrants,
	erpRoleNames,
	erpStatements,
	portalStatements,
	type ErpPermissionRequest,
} from '@ims-erp/common';

export const organizationStatements = {
	...defaultStatements,
	...erpStatements,
	...portalStatements,
	// Keep the built-in vocabulary aligned with the backend definition.
	...builtInOrgStatements,
} as const;

export const erpAccessControl = createAccessControl(organizationStatements);

function toRole(grants: ErpPermissionRequest) {
	const statements: Record<string, readonly string[]> = {};
	for (const [resource, actions] of Object.entries(grants)) {
		const valid = (organizationStatements as Record<string, readonly string[]>)[
			resource
		];
		if (!valid) continue;
		statements[resource] = (actions as readonly string[]).filter((action) =>
			(valid as readonly string[]).includes(action),
		);
	}
	return erpAccessControl.newRole(statements as never);
}

export const erpRoles = {
	owner: toRole(erpRoleGrants.owner),
	member: toRole(erpRoleGrants.member),
	operations_manager: toRole(erpRoleGrants.operations_manager),
	sales: toRole(erpRoleGrants.sales),
	project_manager: toRole(erpRoleGrants.project_manager),
	technician: toRole(erpRoleGrants.technician),
	freelancer: toRole(erpRoleGrants.freelancer),
	purchasing: toRole(erpRoleGrants.purchasing),
	warehouse: toRole(erpRoleGrants.warehouse),
	finance: toRole(erpRoleGrants.finance),
	hr: toRole(erpRoleGrants.hr),
	customer_service: toRole(erpRoleGrants.customer_service),
	marketing: toRole(erpRoleGrants.marketing),
} as const;

/**
 * Global admin() access control, mirrored from
 * `apps/backend/src/providers/better-auth/ac/admin-ac.ts` (ADR-0018). Must
 * match the server so the client knows the app roles `investor` and `customer`.
 */
export const adminAccessControl = createAccessControl(adminDefaultStatements);

export const adminPluginRoles = {
	admin: adminAccessControl.newRole({ ...adminAc.statements }),
	user: adminAccessControl.newRole({ ...userAc.statements }),
	investor: adminAccessControl.newRole({}),
	customer: adminAccessControl.newRole({}),
} as const;

export type ErpClientRoleName = (typeof erpRoleNames)[number];
