import { DRIZZLE_TOKEN } from '@di/provider';
import {
	TItemSelect,
	items,
	serialTrackedItems,
} from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	and,
	asc,
	count,
	eq,
	getTableColumns,
	ilike,
	inArray,
	isNull,
	or,
	sql,
} from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IItemRepository,
	TItemCreateData,
	TItemListRow,
	TItemPaginationRequest,
	TItemUpdateData,
} from '../contracts/item.repository.interface';

/**
 * Drizzle implementation of {@link IItemRepository}.
 *
 * @remarks
 * Uncached on purpose: item lists are filtered and small, and the inventory
 * flows that read items (stock movements, borrowing) need a read-your-writes
 * guarantee that a cache-aside layer would complicate.
 *
 * @see {@link import('@drizzle/schemas/inventory.schema').items} for the
 * nullable-`organization_id` and partial-unique-pair rules this respects.
 */
@injectable()
export class ItemRepository implements IItemRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	/**
	 * Fetches one filtered page of items.
	 *
	 * @param request - Page settings plus optional filters
	 */
	async paginate(
		request: TItemPaginationRequest,
	): Promise<TPaginationResult<TItemListRow>> {
		const {
			page,
			limit,
			search,
			itemKind,
			categoryId,
			activeOnly,
			warehouseId,
			includeArchived,
		} = request;

		const filters = [
			includeArchived ? undefined : isNull(items.deletedAt),
			itemKind ? eq(items.itemKind, itemKind) : undefined,
			categoryId ? eq(items.categoryId, categoryId) : undefined,
			activeOnly ? eq(items.isActive, true) : undefined,
			// "Has a physical presence in this warehouse": either a live
			// serialized unit or a stock balance. Two EXISTS keep the row
			// multiplicity of the outer query intact (a join would duplicate
			// items that have several units/bins here).
			warehouseId
				? sql`(
						EXISTS (
							SELECT 1 FROM ${serialTrackedItems}
							WHERE ${serialTrackedItems.itemId} = ${items.id}
								AND ${serialTrackedItems.warehouseId} = ${warehouseId}
								AND ${serialTrackedItems.deletedAt} IS NULL
						)
						OR EXISTS (
							SELECT 1 FROM inventory.stock_balances sb
							WHERE sb.item_id = ${items.id}
								AND sb.warehouse_id = ${warehouseId}
						)
					)`
				: undefined,
			search
				? or(
						ilike(items.sku, `%${search}%`),
						ilike(items.name, `%${search}%`),
						ilike(items.brand, `%${search}%`),
					)
				: undefined,
		].filter(Boolean);

		const where = filters.length > 0 ? and(...filters) : undefined;

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(items)
			.where(where);

		const data = await this.database
			// The warehouse-scoped quantity is a scalar subquery, not a join: a
			// join to `stock_balances` would duplicate items that hold stock in
			// several bins, breaking both row multiplicity and LIMIT/OFFSET.
			// Without a warehouse filter the column is simply NULL.
			.select({
				...getTableColumns(items),
				quantityOnHand:
					warehouseId !== undefined
						? sql<
								string
							>`COALESCE((SELECT SUM(sb.quantity_on_hand)
									FROM inventory.stock_balances sb
									WHERE sb.warehouse_id = ${warehouseId}
										AND sb.item_id = ${sql.raw('"inventory"."items"."id"')}), 0)::text`
						: sql<string | null>`NULL`,
			})
			.from(items)
			.where(where)
			.orderBy(asc(items.name))
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	/** Fetches one alive item by id. */
	async findActiveByIds(ids: string[]): Promise<TItemSelect[]> {
		if (ids.length === 0) return [];
		return this.database
			.select()
			.from(items)
			.where(and(inArray(items.id, ids), eq(items.isActive, true), isNull(items.deletedAt)));
	}

	async findById(id: string): Promise<TItemSelect | null> {
		const [row] = await this.database
			.select()
			.from(items)
			.where(and(eq(items.id, id), isNull(items.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Fetches one alive item by tenant + SKU.
	 *
	 * @remarks
	 * `organizationId === null` matches global rows only — `isNull`, never
	 * "any organization".
	 */
	async findBySku(
		organizationId: string | null,
		sku: string,
	): Promise<TItemSelect | null> {
		const [row] = await this.database
			.select()
			.from(items)
			.where(
				and(
					isNull(items.deletedAt),
					eq(items.sku, sku),
					organizationId === null
						? isNull(items.organizationId)
						: eq(items.organizationId, organizationId),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** Inserts an item. */
	async create(data: TItemCreateData, code: string): Promise<TItemSelect> {
		const [row] = await this.database
			.insert(items)
			.values({
				...data,
				code,
				createdAt: data.createdAt ?? new Date(),
			} as never)
			.returning();
		return row;
	}

	/**
	 * Applies a partial update to an alive item.
	 *
	 * @remarks
	 * `updatedAt` is refreshed explicitly: `$onUpdate` fires on the query
	 * builder path, not when the row is set through this object form.
	 */
	async update(
		id: string,
		data: TItemUpdateData,
	): Promise<TItemSelect | null> {
		if (Object.keys(data).length === 0) return this.findById(id);
		const [row] = await this.database
			.update(items)
			.set({ ...data, updatedAt: new Date() } as never)
			.where(and(eq(items.id, id), isNull(items.deletedAt)))
			.returning();
		return row ?? null;
	}

	/** Soft-deletes an alive item. */
	async archive(id: string): Promise<TItemSelect | null> {
		const [row] = await this.database
			.update(items)
			.set({ deletedAt: new Date() })
			.where(and(eq(items.id, id), isNull(items.deletedAt)))
			.returning();
		return row ?? null;
	}

	/** @inheritdoc */
	async findNamesByIds(
		ids: string[],
	): Promise<Array<{ id: string; name: string }>> {
		if (ids.length === 0) return [];
		return this.database
			.select({ id: items.id, name: items.name })
			.from(items)
			.where(and(inArray(items.id, ids), isNull(items.deletedAt)));
	}

	/** Counts alive units of an item, used before archive. */
	async countUnits(itemId: string): Promise<number> {
		const [{ value }] = await this.database
			.select({ value: count() })
			.from(serialTrackedItems)
			.where(
				and(
					eq(serialTrackedItems.itemId, itemId),
					isNull(serialTrackedItems.deletedAt),
					sql`status <> 'lost'`,
				),
			);
		return value;
	}
}
