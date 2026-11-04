import { DRIZZLE_TOKEN } from '@di/provider';
import {
	items,
	serialTrackedItems,
	warehouseAddresses,
	warehouseStorages,
	warehouses,
} from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	and,
	asc,
	count,
	eq,
	ilike,
	inArray,
	isNull,
	ne,
	or,
} from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IWarehouseRepository,
	TWarehouseCreateData,
	TWarehouseKindCounts,
	TWarehousePaginationRequest,
	TWarehouseUpdateData,
} from '../contracts/warehouse.repository.interface';
import type { TWarehouseSelect } from '@drizzle/schemas/inventory.schema';

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
		} = request;

		const filters = [
			includeArchived ? undefined : isNull(warehouses.deletedAt),
			isActive === undefined ? undefined : eq(warehouses.isActive, isActive),
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

		const data = await this.database
			.select()
			.from(warehouses)
			.where(where)
			.orderBy(asc(warehouses.name))
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
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
	async countKinds(
		warehouseIds: string[],
	): Promise<TWarehouseKindCounts[]> {
		if (warehouseIds.length === 0) return [];

		const unitRows = await this.database
			.select({
				warehouseId: serialTrackedItems.warehouseId,
				itemKind: items.itemKind,
				value: count(),
			})
			.from(serialTrackedItems)
			.innerJoin(items, eq(items.id, serialTrackedItems.itemId))
			.where(
				and(
					isNull(serialTrackedItems.deletedAt),
					inArray(serialTrackedItems.warehouseId, warehouseIds),
				),
			)
			.groupBy(serialTrackedItems.warehouseId, items.itemKind);

		const storageRows = await this.database
			.select({
				warehouseId: warehouseStorages.warehouseId,
				value: count(),
			})
			.from(warehouseStorages)
			.where(
				and(
					isNull(warehouseStorages.deletedAt),
					inArray(warehouseStorages.warehouseId, warehouseIds),
				),
			)
			.groupBy(warehouseStorages.warehouseId);

		const byWarehouse = new Map<string, TWarehouseKindCounts>(
			warehouseIds.map((warehouseId) => [
				warehouseId,
				{
					warehouseId,
					productsCount: 0,
					materialsCount: 0,
					toolsCount: 0,
					storagesCount: 0,
				},
			]),
		);
		for (const row of unitRows) {
			if (row.warehouseId === null) continue;
			const target = byWarehouse.get(row.warehouseId);
			if (!target) continue;
			if (row.itemKind === 'product' || row.itemKind === 'component') {
				target.productsCount += row.value;
			} else if (row.itemKind === 'material') {
				target.materialsCount += row.value;
			} else if (row.itemKind === 'tool') {
				target.toolsCount += row.value;
			}
		}
		for (const row of storageRows) {
			const target = byWarehouse.get(row.warehouseId);
			if (target) target.storagesCount += row.value;
		}
		return [...byWarehouse.values()];
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

	/**
	 * Counts alive serialized units currently held in a warehouse.
	 *
	 * @remarks
	 * Guards archive: soft-deleting a warehouse that still points at live units
	 * would leave those units referencing a dead row for the S3 custody flows.
	 */
	async countLiveUnits(warehouseId: string): Promise<number> {
		const [{ value }] = await this.database
			.select({ value: count() })
			.from(serialTrackedItems)
			.where(
				and(
					isNull(serialTrackedItems.deletedAt),
					eq(serialTrackedItems.warehouseId, warehouseId),
				),
			);
		return value;
	}
}

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
