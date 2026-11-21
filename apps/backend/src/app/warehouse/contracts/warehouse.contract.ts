import { z } from 'zod';
import { inventoryPaginationSchema, idParamSchema } from '@app/inventory/contracts/pagination.contract';

/**
 * Request schemas for the warehouse, address, and storage endpoints.
 *
 * @remarks
 * Parsed at the controller boundary; the service refines. Pagination reuses
 * {@link inventoryPaginationSchema}, which already enforces the
 * `api-conventions.md` 1-based `page` / `limit <= 100` rule.
 *
 * Numeric columns are decimal strings in Postgres, so `numeric(18,3)`
 * (`capacity`) and `numeric(10,7)` (`latitude`/`longitude`) are coerced to
 * numbers for validation and serialized back to the column's exact scale.
 */

/**
 * Query-string boolean: accepts real booleans and the strings `'true'`/`'false'`.
 *
 * @remarks
 * A bare `z.coerce.boolean()` would treat the string `'false'` as `true`.
 */
export const booleanQuerySchema = z
	.union([z.boolean(), z.enum(['true', 'false'])])
	.transform((value) => value === true || value === 'true');

/** List filter for warehouses. */
export const warehouseListQuerySchema = inventoryPaginationSchema.extend({
	search: z.string().min(1).optional(),
	/**
	 * Tri-state scope filter.
	 *
	 * @remarks
	 * Omitted = every scope. The literal string `'global'` selects
	 * `organization_id IS NULL` (a query string cannot express JSON `null`
	 * unambiguously). Otherwise the value is an exact organization id.
	 */
	scope: z.union([z.literal('global'), z.string().min(1)]).optional(),
	/**
	 * Lifecycle filter. `all` excludes archived rows; `archived` selects only
	 * soft-deleted rows. When set it takes precedence over `includeArchived`
	 * and `isActive`.
	 */
	status: z.enum(['all', 'active', 'inactive', 'archived']).optional(),
	sortBy: z.enum(['name', 'code', 'status']).optional(),
	sortDir: z.enum(['asc', 'desc']).optional(),
	includeArchived: booleanQuerySchema.optional(),
	isActive: booleanQuerySchema.optional(),
});

/** Body for the warehouse↔organization link endpoints (ERP-0031). */
export const warehouseLinkSchema = z.object({
	/** Logical reference to `auth.organizations.id` — validated by the link write itself. */
	organizationId: z.string().min(1).max(64),
});

/** Address body, nested inside a warehouse create or sent to `PUT`. */export const warehouseAddressSchema = z
	.object({
		label: z.string().max(255).nullable().optional(),
		addressLine: z.string().min(1),
		rt: z.string().max(8).nullable().optional(),
		rw: z.string().max(8).nullable().optional(),
		postalCode: z.string().max(10).nullable().optional(),
		villageId: z.uuid().nullable().optional(),
		latitude: z.coerce
			.number()
			.min(-90)
			.max(90)
			.nullable()
			.optional()
			.transform((value) => (value == null ? value : value.toFixed(7))),
		longitude: z.coerce
			.number()
			.min(-180)
			.max(180)
			.nullable()
			.optional()
			.transform((value) => (value == null ? value : value.toFixed(7))),
	})
	.strict();

/** Body for creating a warehouse, optionally with its 1:1 address. */
export const createWarehouseSchema = z
	.object({
		/**
		 * Tenant scope.
		 *
		 * @remarks
		 * Defaults to `null` = **global** warehouse (plan §6 D-C). This
		 * deliberately differs from `POST /items`, which defaults to the
		 * caller's organization: warehouses are application-admin-only and
		 * global inventory is a first-class concept (ADR-0008).
		 */
		organizationId: z.string().min(1).nullable().default(null),
		/** Omit to let the numbering authority allocate `WH-0001` (ERP-0042). */
		code: z.string().min(1).max(32).nullish().transform((value) => value ?? null),
		name: z.string().min(1),
		responsibleEmployeeId: z.uuid().nullable().optional(),
		isDefault: z.boolean().default(false),
		isActive: z.boolean().default(true),
		address: warehouseAddressSchema.optional(),
	})
	.strict();

/**
 * Body for updating a warehouse.
 *
 * @remarks
 * `code` and `organizationId` are **absent**, not merely ignored: scope and
 * code are immutable after creation (plan §6 D-C), so the schema rejects them
 * as unknown keys rather than silently dropping them.
 */
export const updateWarehouseSchema = z
	.object({
		name: z.string().min(1).optional(),
		responsibleEmployeeId: z.uuid().nullable().optional(),
		isDefault: z.boolean().optional(),
		isActive: z.boolean().optional(),
	})
	.strict();

/** Body for creating a storage (bin) inside a warehouse. */
export const createStorageSchema = z
	.object({
		code: z.string().min(1).max(32),
		name: z.string().nullable().optional(),
		binType: z.string().nullable().optional(),
		capacity: z.coerce
			.number()
			.min(0)
			.nullable()
			.optional()
			.transform((value) => (value == null ? value : value.toFixed(3))),
		isActive: z.boolean().default(true),
	})
	.strict();

/** Body for updating a storage. `code` is immutable. */
export const updateStorageSchema = z
	.object({
		name: z.string().nullable().optional(),
		binType: z.string().nullable().optional(),
		capacity: z.coerce
			.number()
			.min(0)
			.optional()
			.transform((value) => (value == null ? value : value.toFixed(3))),
		isActive: z.boolean().optional(),
	})
	.strict();

/** Storage list filter. */
export const storageListQuerySchema = z.object({
	includeArchived: booleanQuerySchema.optional(),
});

/** Path params for routes nested under a warehouse. */
export const nestedIdParamSchema = idParamSchema.extend({
	storageId: z.uuid(),
});

/** Path params for the warehouse↔organization link routes (ERP-0031). */
export const warehouseLinkParamSchema = idParamSchema.extend({
	organizationId: z.string().min(1).max(64),
});

/**
 * Body for granting person-in-charge access (ADR-0017).
 *
 * @remarks
 * `userId` is a logical reference to `auth.users.id`; the service validates it
 * through the Identity module before writing. Chatty ids are rejected here so
 * a truncated copy/paste cannot reach the database.
 */
export const assignManagerSchema = z
	.object({
		userId: z.string().min(1).max(64),
	})
	.strict();

/** Path params for revoking a person-in-charge grant (ADR-0017). */
export const managerParamSchema = idParamSchema.extend({
	userId: z.string().min(1).max(64),
});

/**
 * Query for the person-in-charge picker (ADR-0017).
 *
 * @remarks
 * `search` is optional: without it the first page of accounts is returned,
 * which is what an empty picker shows.
 */
export const managerCandidateQuerySchema = z.object({
	search: z.string().min(1).max(200).optional(),
	limit: z.coerce.number().int().min(1).max(50).default(20),
});

export { idParamSchema };
