import type { OrganizationOptions } from 'better-auth/plugins/organization';
import { organization } from 'better-auth/plugins/organization';
import { GLOBAL_ADMIN_ROLE } from '../ac/admin-ac';
import { erpAccessControl, erpRoles } from '../ac/organization-ac';

/**
 * Organization plugin configuration. Extracted so the option object is
 * independently typed (`OrganizationOptions`) — the plugin factory narrows
 * generics and would obscure whether the option shape type-checks.
 */
export const organizationPluginOptions: OrganizationOptions = {
	ac: erpAccessControl,
	roles: erpRoles,
	teams: { enabled: false },
	// Creation is restricted to application admins (`user.role === 'admin'`),
	// i.e. the company owner role (ADR-0007). This is a defense-in-depth
	// mirror of the first-party HTTP guard: even a caller that reaches
	// `auth.api.createOrganization` directly is rejected here. It is
	// intentionally independent of organization membership, so a global
	// admin with no memberships can bootstrap the first organization.
	// Better Auth treats a server-side call carrying an explicit `userId` as
	// a system action and skips this gate (seeders rely on that).
	allowUserToCreateOrganization: (user) => user.role === GLOBAL_ADMIN_ROLE,
	// Soft-delete marker owned by the organization module's repository (sets
	// the column directly via Drizzle, mirroring the user module pattern).
	// `input: false` keeps it out of every Better Auth API surface. NOTE: the
	// matching Drizzle column in auth.schema.ts is hand-maintained (cli 1.4.x
	// regression, see the note there).
	schema: {
		organization: {
			additionalFields: {
				deletedAt: {
					type: 'date',
					required: false,
					input: false,
					defaultValue: null,
				},
			},
		},
	},
};

export const betterAuthOrganizationPlugin = organization(
	organizationPluginOptions,
);
