import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TWarehouseInsert,
	TWarehouseSelect,
} from '@drizzle/schemas/warehouse.schema';

/** Lifecycle filter for the warehouse list. */
export type TWarehouseStatusFilter = 'all' | 'active' | 'inactive' | 'archived';

/** Sortable columns for the warehouse list. `status` ranks active < inactive < archived. */
export type TWarehouseSortField = 'name' | 'code' | 'status';

/**
 * Pagination + filters for the warehouse list endpoint.
 *
 * @remarks
 * `organizationId` is tri-state and must be read carefully:
 * - `undefined` — no scope filter; return every warehouse (all orgs + global).
 *   Legitimate because warehouse routes are application-admin-only.
 * - `null` — global warehouses only.
 * - `'org-a'` — that organization's warehouses only.
 *
 * A plain `eq(column, undefined)` would silently drop the filter, so the
 * repository distinguishes these three cases explicitly.
 */
export type TWarehousePaginationRequest = {
	page: number;
	limit: number;
	/** Case-insensitive partial match on `code` or `name`. */
	search?: string;
	/** `undefined` = all scopes, `null` = global only, string = that org. */
	organizationId?: string | null;
	/** Include archived (soft-deleted) rows. */
	includeArchived?: boolean;
	/** Exact `is_active` filter. */
	isActive?: boolean;
	/** Lifecycle filter. When set, overrides `includeArchived` and `isActive`. */
	status?: TWarehouseStatusFilter;
	/** Sort column. Defaults to `name`. */
	sortBy?: TWarehouseSortField;
	/** Sort direction. Defaults to `asc`. */
	sortDir?: 'asc' | 'desc';
};

/**
 * Item-kind + storage counts for one warehouse.
 *
 * @remarks
 * Serialized kinds (`product`, `component`) count live serialized units, so
 * they answer "what is physically here". Materials are not serialized:
 * `materialsCount` counts distinct material items with a positive on-hand
 * quantity in `stock_balances` for the warehouse.
 */
export type TWarehouseKindCounts = {
	warehouseId: string;
	productsCount: number;
	componentsCount: number;
	materialsCount: number;
	/** Alive `equipment`-typed assets currently located in the warehouse. */
	equipmentsCount: number;
	storagesCount: number;
};

/** Fields a client may set when creating a warehouse. */
export type TWarehouseCreateData = Omit<
	TWarehouseInsert,
	'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & {
	createdAt?: Date;
	/**
	 * Optional 1:1 address, written in the same transaction as the warehouse.
	 *
	 * @remarks
	 * Kept off the drizzle insert row type deliberately: it is a second table,
	 * not a column.
	 */
	address?: {
		label?: string | null;
		addressLine: string;
		rt?: string | null;
		rw?: string | null;
		postalCode?: string | null;
		villageId?: string | null;
		latitude?: string | null;
		longitude?: string | null;
	};
};

/**
 * Fields a client may change on an existing warehouse.
 *
 * @remarks
 * `organizationId` is **excluded**: scope is immutable after creation (plan
 * §6 D-C). Reassigning it would orphan live `serial_tracked_items.warehouse_id`
 * references and, once S3 lands, silently re-home `stock_balances`.
 * `code` is likewise immutable — it is the human-facing identifier other
 * modules reference logically.
 */
export type TWarehouseUpdateData = Partial<
	Omit<
		TWarehouseInsert,
		'id' | 'code' | 'organizationId' | 'createdAt' | 'updatedAt'
	>
>;

/**
 * Warehouse persistence contract.
 *
 * @remarks
 * Reads exclude soft-deleted rows unless `includeArchived` is requested.
 * `organizationId === null` always means "global rows only" via `isNull`,
 * never "match any organization" — PostgreSQL treats every NULL as distinct,
 * so the partial unique indexes on `code` depend on this distinction.
 */
export interface IWarehouseRepository {
	/** Fetches one filtered page of warehouses. */
	paginate(
		request: TWarehousePaginationRequest,
	): Promise<TPaginationResult<TWarehouseSelect>>;

	/** Fetches one alive warehouse by id. */
	findById(id: string): Promise<TWarehouseSelect | null>;

	/**
	 * Alive warehouses, optionally narrowed to a set of ids, ordered by name.
	 *
	 * @param ids - `undefined` means every alive warehouse (application-admin
	 *   view); an empty array means none
	 */
	findAlive(ids?: readonly string[]): Promise<TWarehouseSelect[]>;

	/**
	 * Whether an alive `warehouse_organizations` link row exists for the pair
	 * (ERP-0031).
	 */
	isLinked(warehouseId: string, organizationId: string): Promise<boolean>;

	/** Alive warehouses linked to one organization, ordered by name. */
	listLinked(organizationId: string): Promise<TWarehouseSelect[]>;

	/**
	 * Alive organizations linked to one warehouse, ordered by name.
	 *
	 * @remarks
	 * Rows are `{ organizationId, createdAt }` only — resolving names is the
	 * caller's job (the admin UI joins against the organization API), so this
	 * module never reads `auth.organizations`.
	 */
	listOrganizations(
		warehouseId: string,
	): Promise<Array<{ organizationId: string; createdAt: Date }>>;

	/**
	 * Creates an alive link, reviving a soft-deleted one for the same pair.
	 *
	 * @remarks
	 * Idempotent: an already-alive link is left untouched (`created=false`).
	 * The partial unique `warehouse_organizations_uq` would otherwise reject
	 * the second insert for a pair.
	 */
	linkOrganization(
		warehouseId: string,
		organizationId: string,
	): Promise<{ created: boolean }>;

	/** Soft-deletes the alive link for the pair. `false` when none exists. */
	unlinkOrganization(
		warehouseId: string,
		organizationId: string,
	): Promise<boolean>;

	/**
	 * Fetches one alive warehouse by scope + code.
	 *
	 * @param organizationId - `null` matches global rows only
	 * @param code - The warehouse code
	 */
	findByCode(
		organizationId: string | null,
		code: string,
	): Promise<TWarehouseSelect | null>;

	/**
	 * Inserts a warehouse, optionally with its 1:1 address.
	 *
	 * @remarks
	 * Both rows are written in a single transaction, so a warehouse is never
	 * left addressless by a partial failure.
	 */
	/** `tx` joins the caller's transaction (number allocation, P7-5). */
	create(data: TWarehouseCreateData, tx?: TTx): Promise<TWarehouseSelect>;

	/** Applies a partial update to an alive warehouse. */
	update(
		id: string,
		data: TWarehouseUpdateData,
	): Promise<TWarehouseSelect | null>;

	/** Soft-deletes an alive warehouse. */
	archive(id: string): Promise<TWarehouseSelect | null>;

	/**
	 * Fetches alive warehouses by id, returning `{ id, name }` pairs.
	 *
	 * @remarks
	 * Published for cross-module name resolution (e.g. the assets module
	 * decorating asset rows with a storage location), via
	 * `WarehouseService` — service-to-service only.
	 */
	findNamesByIds(ids: string[]): Promise<Array<{ id: string; name: string }>>;

	/**
	 * Clears `is_default` on every alive warehouse in a scope, except one.
	 *
	 * @remarks
	 * Used to enforce "at most one default per scope" (plan §6 D-A). The
	 * `IS NULL` scope is handled explicitly rather than relying on
	 * `eq(column, null)`, which never matches.
	 *
	 * @param organizationId - `null` scopes the update to global rows
	 * @param exceptId - Warehouse that keeps (or gains) the default flag
	 */
	clearDefaultExcept(
		organizationId: string | null,
		exceptId: string,
	): Promise<void>;

	/** Alive warehouses by id, as `{ id, code, name }` rows (labels for other modules). */
	findByIds(ids: string[]): Promise<Array<{ id: string; code: string; name: string }>>;

	/**
	 * Counts the live storages of each warehouse (ADR-0026).
	 *
	 * @remarks
	 * Batched projection for list/detail pages. The other per-warehouse counts
	 * (serialized units, materials, equipment) are `inventory` facts and are
	 * composed in the service through its facade; a warehouse missing from the
	 * returned map has no storages.
	 */
	countStorages(warehouseIds: string[]): Promise<Map<string, number>>;
}
