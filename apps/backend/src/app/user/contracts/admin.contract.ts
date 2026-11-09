import { z } from 'zod';
import { USER_INVITATION_STATUSES } from '@drizzle/schemas/role.schema';

/**
 * Request/response contracts for the user-management admin API (phase 4).
 *
 * @remarks
 * Surfaces sharing this file, all under the `/admin` prefix so they
 * cannot collide with the self-service `/users/*` routes:
 * - `/admin/users/*` — account lifecycle (list, deactivate, restore, soft-delete).
 * - `/admin/audit` — read-only audit trail.
 *
 * The `/admin/roles/*` CRUD contract was removed with the closed role
 * enum (`erpRoleNames` in `@ims-erp/common`): there is no dynamic role
 * master data to manage.
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
// Audit
// ---------------------------------------------------------------------------

// The audit read contract (`auditQuerySchema` / `TAuditQuery` /
// `TAdminAudit`) moved to `@app/audit` in W6 — see
// `src/app/audit/contracts/audit.contract.ts`. Nothing in this module reads
// the ledger any more; it only writes entries through `AUDIT_SERVICE_TOKEN`.

/** Invitation statuses re-exported for the pending panel's filter union. */
export const INVITATION_STATUS_OPTIONS = USER_INVITATION_STATUSES;
