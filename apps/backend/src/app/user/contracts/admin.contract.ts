import { z } from 'zod';
import { USER_INVITATION_STATUSES } from '@drizzle/schemas/role.schema';
import { erpStatements } from '@ims-erp/common';

/**
 * Request/response contracts for the user-management admin API (phase 4).
 *
 * @remarks
 * Three surfaces share this file, all under the `/admin` prefix so they
 * cannot collide with the self-service `/users/*` routes:
 * - `/admin/users/*` — account lifecycle (list, deactivate, restore, soft-delete).
 * - `/admin/roles/*` — per-organization role CRUD (owner/app-admin).
 * - `/admin/audit` — read-only audit trail.
 *
 * Every schema is parsed at the controller boundary before any service call.
 */

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** User lifecycle statuses (mirrors `auth.users.status`). */
export const USER_STATUSES = ['pending', 'active', 'deactivated'] as const;
export type TUserStatus = (typeof USER_STATUSES)[number];

/** Sortable columns for the admin user listing. */
export const USER_SORT_FIELDS = ['name', 'createdAt', 'joinedAt'] as const;
/** Sort directions for the admin user listing. */
export const USER_SORT_DIRECTIONS = ['asc', 'desc'] as const;

/**
 * User listing query. `status` is exact; `search` matches name, email or
 * username (case-insensitive partial); `includeDeleted` surfaces
 * soft-deleted rows. `organizationId` narrows to users with an active
 * membership in that org; `sortBy=joinedAt` ranks by the claim date
 * (`users.claimedAt`, the real "joined the application" moment).
 * Defaults mirror the historical ordering: newest accounts first.
 */
export const userQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	status: z.enum(USER_STATUSES).optional(),
	/** Platform role filter (`admin` / `user`). */
	role: z.string().min(1).max(50).optional(),
	search: z.string().min(1).max(200).optional(),
	includeDeleted: z
		.enum(['true', 'false'])
		.transform((value) => value === 'true')
		.optional(),
	organizationId: z.string().min(1).max(64).optional(),
	sortBy: z.enum(USER_SORT_FIELDS).default('createdAt'),
	sortDir: z.enum(USER_SORT_DIRECTIONS).default('desc'),
});
export type TUserQuery = z.infer<typeof userQuerySchema>;

/** Sortable columns for the admin user listing. */
export type TUserSortField = (typeof USER_SORT_FIELDS)[number];
/** Sort directions for the admin user listing. */
export type TUserSortDirection = (typeof USER_SORT_DIRECTIONS)[number];

export {
	/** Path parameters identifying one user (shared with `user.contract`). */
	userIdParamsSchema,
	type TUserIdParams,
} from './user.contract';

/** Admin-facing user row (no credential columns, ever). */
export type TAdminUser = {
	id: string;
	name: string;
	email: string;
	username: string | null;
	displayUsername: string | null;
	phone: string | null;
	image: string | null;
	role: string | null;
	status: string | null;
	banned: boolean | null;
	createdAt: Date;
	deletedAt: Date | null;
	/**
	 * When the user joined the application (`users.claimedAt`): the moment
	 * an invited user claimed their invitation. Null for pending users —
	 * the seeded/legacy backfill sets it to `createdAt`.
	 */
	joinedAt: Date | null;
	/** Active memberships, for the users table's organization column. */
	organizations: Array<{ id: string; name: string; role: string }>;
};

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/**
 * Role name: lowercase snake_case, 2-40 chars. System roles (`owner`,
 * `admin`, `member`, catalog names) already exist per org and collide on the
 * partial unique index.
 */
export const roleNameSchema = z
	.string()
	.min(2)
	.max(40)
	.regex(
		/^[a-z][a-z0-9_]*$/,
		'Use lowercase letters, numbers and underscores',
	);

/**
 * Permission grant payload: `{ resource: action[] }` restricted to the
 * shared catalog vocabulary. Actions are validated against the resource's
 * statement list so a typo can never be persisted.
 */
export const permissionGrantSchema = z.record(
	z.string(),
	z.array(z.string().min(1)),
);
export type TPermissionGrant = z.infer<typeof permissionGrantSchema>;

/**
 * Body for creating a custom role in an organization.
 *
 * @remarks
 * `rank` accepts up to 100 (the owner rank) so the request reaches the
 * escalation guard in the service: validation must not silently cap below a
 * rank the guard is responsible for rejecting. The guard, not the schema, is
 * the authorization boundary.
 */
export const createRoleSchema = z.object({
	organizationId: z.string().min(1),
	name: roleNameSchema,
	/** Escalation guard: must be strictly below the caller's own rank. */
	rank: z.coerce.number().int().min(1).max(100),
	permissions: permissionGrantSchema,
	/** Optional catalog role to copy grants from instead of `permissions`. */
	copyFrom: z.string().min(1).optional(),
});
export type TCreateRole = z.infer<typeof createRoleSchema>;

/** Body for updating a custom role. System roles reject permission edits. */
export const updateRoleSchema = z
	.object({
		name: roleNameSchema.optional(),
		rank: z.coerce.number().int().min(1).max(100).optional(),
		permissions: permissionGrantSchema.optional(),
	})
	.refine(
		(value) =>
			value.name !== undefined ||
			value.rank !== undefined ||
			value.permissions !== undefined,
		{ message: 'At least one field is required' },
	);
export type TUpdateRole = z.infer<typeof updateRoleSchema>;

/** Path parameters identifying one role. */
export const roleIdParamsSchema = z.object({
	roleId: z.string().min(1),
});
export type TRoleIdParams = z.infer<typeof roleIdParamsSchema>;

/** Org-scoped role listing query. */
export const roleQuerySchema = z.object({
	organizationId: z.string().min(1),
	includeDeleted: z
		.enum(['true', 'false'])
		.transform((value) => value === 'true')
		.optional(),
});
export type TRoleQuery = z.infer<typeof roleQuerySchema>;

/** Admin-facing role row. */
export type TAdminRole = {
	id: string;
	organizationId: string;
	name: string;
	rank: number;
	permissions: TPermissionGrant;
	isSystem: boolean;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	/** Live members currently holding this role (delete guard). */
	memberCount: number;
};

/**
 * Permission catalog for the role editor: every resource and its valid
 * actions, straight from the shared catalog the backend enforces.
 */
export type TPermissionCatalogEntry = {
	resource: string;
	actions: readonly string[];
};

/** Builds the permission catalog payload from the shared statement map. */
export function permissionCatalog(
	statements: Record<string, readonly string[]>,
): TPermissionCatalogEntry[] {
	return Object.entries(statements).map(([resource, actions]) => ({
		resource,
		actions,
	}));
}

/** Resources known to the shared catalog (used for grant validation). */
export const KNOWN_RESOURCES = Object.keys(erpStatements);

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

// The audit read contract (`auditQuerySchema` / `TAuditQuery` /
// `TAdminAudit`) moved to `@app/audit` in W6 — see
// `src/app/audit/contracts/audit.contract.ts`. Nothing in this module reads
// the ledger any more; it only writes entries through `AUDIT_SERVICE_TOKEN`.

/** Invitation statuses re-exported for the pending panel's filter union. */
export const INVITATION_STATUS_OPTIONS = USER_INVITATION_STATUSES;
