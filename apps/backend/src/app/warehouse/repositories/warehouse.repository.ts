import { DRIZZLE_TOKEN } from '@di/provider';
import {
	warehouseAddresses,
	warehouseOrganizations,
	warehouseStorages,
	warehouses,
} from '@drizzle/schemas/warehouse.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	and,
	asc,
	count,
	desc,
	eq,
	getTableColumns,
	ilike,
	inArray,
	isNotNull,
	isNull,
	ne,
	or,
	sql,
} from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IWarehouseRepository,
	TWarehouseCreateData,
	TWarehouseKindCounts,
	TWarehousePaginationRequest,
	TWarehouseStatusFilter,
	TWarehouseUpdateData,
} from '../contracts/warehouse.repository.interface';
import type { TWarehouseSelect } from '@drizzle/schemas/warehouse.schema';

/**
 * Drizzle implementation of {@link IWarehouseRepository}.
 *
 * @remarks
 * Two rules drive most of this file:
 *
 * 1. **`organization_id IS NULL` means global, never "any org".** PostgreSQL
 *    treats every NULL as distinct, so `eq(column, null)` matches nothing and
 *    the partial unique indexes on `code` only work if null scopes are
 *    addressed with `isNull`.
 * 2. **Warehouse + address are one unit of work.** `create` writes both in a
 *    single transaction so a warehouse is never left addressless by a partial
 *    failure (plan §15).
 *
 * Uncached on purpose, matching {@link import('./item.repository').ItemRepository}:
 * the S3 stock flows need read-your-writes.
 */
@injectable()
export class WarehouseRepository implements IWarehouseRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	/**
	 * Fetches one filtered page of warehouses.
	 *
	 * @param request - Page settings plus optional filters
	 */
	async paginate(
		request: TWarehousePaginationRequest,
	): Promise<TPaginationResult<TWarehouseSelect>> {
		const {
			page,
			limit,
			search,
			organizationId,
			includeArchived,
			isActive,
			status,
			sortBy = 'name',
			sortDir = 'asc',
		} = request;

		// `status` wins when present; otherwise fall back to the legacy flags.
		const lifecycleFilters = status
			? lifecycleFilter(status)
			: [
					includeArchived ? undefined : isNull(warehouses.deletedAt),
					isActive === undefined ? undefined : eq(warehouses.isActive, isActive),
				];

		const filters = [
			...lifecycleFilters,
			// Tri-state: `undefined` = every scope, `null` = global only.
			...scopeFilter(organizationId),
			search
				? or(
						ilike(warehouses.code, `%${search}%`),
						ilike(warehouses.name, `%${search}%`),
					)
				: undefined,
		].filter(Boolean);

		const where = filters.length > 0 ? and(...filters) : undefined;

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(warehouses)
			.where(where);

		const direction = sortDir === 'desc' ? desc : asc;
		const primarySort =
			sortBy === 'code'
				? direction(warehouses.code)
				: sortBy === 'status'
					? direction(STATUS_RANK)
					: direction(warehouses.name);

		const data = await this.database
			.select()
			.from(warehouses)
			.where(where)
			// Secondary key keeps pages stable when the primary column ties.
			.orderBy(primarySort, asc(warehouses.name), asc(warehouses.id))
			.limit(limit)
			.offset((page - 1) * limit);

		return paginationResult({ page, limit }, total, data);
	}

	/** Fetches one alive warehouse by id. */
	async findById(id: string): Promise<TWarehouseSelect | null> {
		const [row] = await this.database
			.select()
			.from(warehouses)
			.where(and(eq(warehouses.id, id), isNull(warehouses.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Alive warehouses, optionally narrowed to a set of ids.
	 *
	 * @param ids - `undefined` returns every alive warehouse (application-admin
	 *   view); an empty array returns none, without a round trip
	 */
	async findAlive(ids?: readonly string[]): Promise<TWarehouseSelect[]> {
		if (ids && ids.length === 0) return [];
		return this.database
			.select()
			.from(warehouses)
			.where(
				ids
					? and(isNull(warehouses.deletedAt), inArray(warehouses.id, [...ids]))
					: isNull(warehouses.deletedAt),
			)
			.orderBy(asc(warehouses.name));
	}

	/**
	 * Whether an alive link row exists between the warehouse and the org
	 * (ERP-0031). Soft-deleted links do not count — unlinking must cut access
	 * immediately.
	 */
	async isLinked(
		warehouseId: string,
		organizationId: string,
	): Promise<boolean> {
		const [row] = await this.database
			.select({ id: warehouseOrganizations.id })
			.from(warehouseOrganizations)
			.where(
				and(
					eq(warehouseOrganizations.warehouseId, warehouseId),
					eq(warehouseOrganizations.organizationId, organizationId),
					isNull(warehouseOrganizations.deletedAt),
				),
			)
			.limit(1);
		return row !== undefined;
	}

	/** Alive warehouses linked to one organization, newest link first. */
	async listLinked(
		organizationId: string,
	): Promise<TWarehouseSelect[]> {
		return this.database
			.select({ ...getTableColumns(warehouses) })
			.from(warehouseOrganizations)
			.innerJoin(
				warehouses,
				eq(warehouses.id, warehouseOrganizations.warehouseId),
			)
			.where(
				and(
					eq(warehouseOrganizations.organizationId, organizationId),
					isNull(warehouseOrganizations.deletedAt),
					isNull(warehouses.deletedAt),
				),
			)
			.orderBy(asc(warehouses.name));
	}

	/** Alive organizations linked to one warehouse, ordered by link age. */
	async listOrganizations(
		warehouseId: string,
	): Promise<Array<{ organizationId: string; createdAt: Date }>> {
		const rows = await this.database
			.select({
				organizationId: warehouseOrganizations.organizationId,
				createdAt: warehouseOrganizations.createdAt,
			})
			.from(warehouseOrganizations)
			.where(
				and(
					eq(warehouseOrganizations.warehouseId, warehouseId),
					isNull(warehouseOrganizations.deletedAt),
				),
			)
			.orderBy(asc(warehouseOrganizations.createdAt));
		// ADR-0014: the column is nullable; a link without an organization
		// carries no tenant and is not a usable link, so it is skipped.
		const links: Array<{ organizationId: string; createdAt: Date }> = [];
		for (const row of rows) {
			if (row.organizationId !== null) {
				links.push({ organizationId: row.organizationId, createdAt: row.createdAt });
			}
		}
		return links;
	}

	/**
	 * Creates an alive link, reviving a soft-deleted one for the same pair.
	 *
	 * @remarks
	 * Idempotent: an already-alive link returns `{ created: false }` without a
	 * write. The revival mirrors the seeder's `ensureWarehouseOrganizationLink`.
	 */
	async linkOrganization(
		warehouseId: string,
		organizationId: string,
	): Promise<{ created: boolean }> {
		const [existing] = await this.database
			.select({
				id: warehouseOrganizations.id,
				deletedAt: warehouseOrganizations.deletedAt,
			})
			.from(warehouseOrganizations)
			.where(
				and(
					eq(warehouseOrganizations.warehouseId, warehouseId),
					eq(warehouseOrganizations.organizationId, organizationId),
				),
			)
			.limit(1);

		if (existing && existing.deletedAt === null) return { created: false };

		if (existing) {
			await this.database
				.update(warehouseOrganizations)
				.set({ deletedAt: null, updatedAt: new Date() })
				.where(eq(warehouseOrganizations.id, existing.id));
			return { created: true };
		}

		await this.database.insert(warehouseOrganizations).values({
			warehouseId,
			organizationId,
			createdAt: new Date(),
		});
		return { created: true };
	}

	/** Soft-deletes the alive link for the pair, if any. */
	async unlinkOrganization(
		warehouseId: string,
		organizationId: string,
	): Promise<boolean> {
		const deleted = await this.database
			.update(warehouseOrganizations)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(warehouseOrganizations.warehouseId, warehouseId),
					eq(warehouseOrganizations.organizationId, organizationId),
					isNull(warehouseOrganizations.deletedAt),
				),
			)
			.returning({ id: warehouseOrganizations.id });
		return deleted.length > 0;
	}

	/**
	 * Counts items by kind and storages for a set of warehouses.
	 *
	 * @remarks
	 * One grouped query per table, driven by the warehouse page — never
	 * per-warehouse loops. Item counts come from live serialized units (the
	 * only thing physically *in* a warehouse); an item with all its units
	 * elsewhere or sold is not in this warehouse's count. Non-serialized,
	 * quantity-tracked items have no units and are not counted (the stock
	 * ledger is out of scope for this projection).
	 *
	 * @param warehouseIds - The warehouses on the current page
	 */
	/**
	 * Counts the live storages of each warehouse.
	 *
	 * @remarks
	 * Storages are this module's own table, so the count stays here. The other
	 * per-warehouse kind counts (units, stock) are `inventory` facts and are
	 * composed in `WarehouseService` through its facade (ADR-0026).
	 *
	 * @param warehouseIds - The warehouses on the current page
	 * @returns Live storage count per warehouse id
	 */
	async countStorages(warehouseIds: string[]): Promise<Map<string, number>> {
		if (warehouseIds.length === 0) return new Map();
		const rows = await this.database
			.select({ warehouseId: warehouseStorages.warehouseId, value: count() })
			.from(warehouseStorages)
			.where(
				and(
					isNull(warehouseStorages.deletedAt),
					inArray(warehouseStorages.warehouseId, warehouseIds),
				),
			)
			.groupBy(warehouseStorages.warehouseId);
		return new Map(rows.map((row) => [row.warehouseId, row.value]));
	}
	/**
	 * Fetches one alive warehouse by scope + code.
	 *
	 * @remarks
	 * `organizationId === null` matches global rows only — `isNull`, never
	 * "any organization".
	 */
	async findByCode(
		organizationId: string | null,
		code: string,
	): Promise<TWarehouseSelect | null> {
		const [row] = await this.database
			.select()
			.from(warehouses)
			.where(
				and(
					isNull(warehouses.deletedAt),
					scopeEquals(organizationId),
					eq(warehouses.code, code),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/**
	 * Inserts a warehouse, and its address when one was supplied.
	 *
	 * @param data - Warehouse columns plus an optional nested `address`
	 */
	async create(data: TWarehouseCreateData): Promise<TWarehouseSelect> {
		const { address, createdAt, ...warehouseColumns } = data;
		const createdAtValue = createdAt ?? new Date();

		return this.database.transaction(async (tx) => {
			const [row] = await tx
				.insert(warehouses)
				.values({ ...warehouseColumns, createdAt: createdAtValue })
				.returning();

			if (address) {
				await tx.insert(warehouseAddresses).values({
					...address,
					warehouseId: row.id,
					createdAt: createdAtValue,
				});
			}

			return row;
		});
	}

	/** Applies a partial update to an alive warehouse. */
	async update(
		id: string,
		data: TWarehouseUpdateData,
	): Promise<TWarehouseSelect | null> {
		const [row] = await this.database
			.update(warehouses)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(warehouses.id, id), isNull(warehouses.deletedAt)))
			.returning();
		return row ?? null;
	}

	/** Soft-deletes an alive warehouse. */
	async archive(id: string): Promise<TWarehouseSelect | null> {
		const now = new Date();
		const [row] = await this.database
			.update(warehouses)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(warehouses.id, id), isNull(warehouses.deletedAt)))
			.returning();
		return row ?? null;
	}

	/** @inheritdoc */
	async findByIds(
		ids: string[],
	): Promise<Array<{ id: string; code: string; name: string }>> {
		if (ids.length === 0) return [];
		return this.database
			.select({ id: warehouses.id, code: warehouses.code, name: warehouses.name })
			.from(warehouses)
			.where(and(inArray(warehouses.id, ids), isNull(warehouses.deletedAt)));
	}

	/** @inheritdoc */
	async findNamesByIds(
		ids: string[],
	): Promise<Array<{ id: string; name: string }>> {
		if (ids.length === 0) return [];
		return this.database
			.select({ id: warehouses.id, name: warehouses.name })
			.from(warehouses)
			.where(and(inArray(warehouses.id, ids), isNull(warehouses.deletedAt)));
	}

	/**
	 * Clears `is_default` on every other alive warehouse in the same scope.
	 *
	 * @remarks
	 * The scope predicate is the whole point: without it, setting an
	 * organization's default would silently clear the global default and vice
	 * versa.
	 *
	 * @param organizationId - `null` scopes the update to global rows
	 * @param exceptId - Warehouse that keeps the default flag
	 */
	async clearDefaultExcept(
		organizationId: string | null,
		exceptId: string,
	): Promise<void> {
		await this.database
			.update(warehouses)
			.set({ isDefault: false, updatedAt: new Date() })
			.where(
				and(
					isNull(warehouses.deletedAt),
					scopeEquals(organizationId),
					eq(warehouses.isDefault, true),
					ne(warehouses.id, exceptId),
				),
			);
	}

}

/**
 * Lifecycle predicates for the list status filter.
 *
 * @remarks
 * `all` means every alive row, so archived rows stay hidden unless `archived`
 * is picked explicitly.
 *
 * @param status - The requested lifecycle bucket
 */
export function lifecycleFilter(status: TWarehouseStatusFilter) {
	switch (status) {
		case 'active':
			return [isNull(warehouses.deletedAt), eq(warehouses.isActive, true)];
		case 'inactive':
			return [isNull(warehouses.deletedAt), eq(warehouses.isActive, false)];
		case 'archived':
			return [isNotNull(warehouses.deletedAt)];
		case 'all':
			return [isNull(warehouses.deletedAt)];
	}
}

/**
 * Sort rank for the `status` column: active, then inactive, then archived.
 * Archived is checked first because an archived row can still carry `is_active`.
 */
const STATUS_RANK = sql<number>`CASE
	WHEN ${warehouses.deletedAt} IS NOT NULL THEN 2
	WHEN ${warehouses.isActive} THEN 0
	ELSE 1
END`;

/**
 * Scope predicate for exact matching, including the global (`NULL`) scope.
 *
 * @param organizationId - `null` matches global rows only
 */
function scopeEquals(organizationId: string | null) {
	return organizationId === null
		? isNull(warehouses.organizationId)
		: eq(warehouses.organizationId, organizationId);
}

/**
 * Scope predicate for the tri-state list filter.
 *
 * @param organizationId - `undefined` skips filtering; `null` is global-only
 * @returns An array (possibly empty) to spread into a filter list
 */
function scopeFilter(organizationId: string | null | undefined) {
	if (organizationId === undefined) return [];
	return [scopeEquals(organizationId)];
}
