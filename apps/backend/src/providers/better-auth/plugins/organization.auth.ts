import type { OrganizationOptions } from 'better-auth/plugins/organization';
import { organization } from 'better-auth/plugins/organization';
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
