import type { OrganizationOptions } from 'better-auth/plugins/organization';
import { organization } from 'better-auth/plugins/organization';
import { GLOBAL_ADMIN_ROLE } from '../ac/admin-ac';
import { erpAccessControl, erpRoles } from '../ac/organization-ac';

/**
 * Organization plugin configuration.
 *
 * @remarks
 * `satisfies` (not a type annotation) keeps the literal type, so the
 * `additionalFields` below stay visible to Better Auth's inferred API types —
 * a widened `OrganizationOptions` erases them and `description` would be
 * rejected in `createOrganization`/`updateOrganization` bodies. The shape is
 * still checked against `OrganizationOptions`.
 */
export const organizationPluginOptions = {
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
				// Free-text profile description (ERP-0041). Writable through the
				// Better Auth create/update APIs, which enforce
				// `organization:update` on the caller's own session.
				description: {
					type: 'string',
					required: false,
					defaultValue: null,
				},
			},
		},
	},
} satisfies OrganizationOptions;

export const betterAuthOrganizationPlugin = organization(
	organizationPluginOptions,
);
