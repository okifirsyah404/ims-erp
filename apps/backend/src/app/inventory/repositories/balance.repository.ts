import { DRIZZLE_TOKEN } from '@di/provider';
import { stockBalances } from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, eq, gt, isNull, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IBalanceRepository,
	TBalanceDelta,
	TBalanceKey,
	TBalancePaginationRequest,
} from '../contracts/balance.repository.interface';
import type { TStockBalanceSelect } from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';

/**
 * Drizzle implementation of {@link IBalanceRepository}.
 *
 * @remarks
 * Everything here exists to make one operation correct: **add a signed delta
 * atomically**. Read-then-write would lose updates when two posts touch the
 * same `(scope, warehouse, item, bin)` concurrently, so `applyDelta` uses
 * `ON CONFLICT … DO UPDATE SET quantity_on_hand = quantity_on_hand + excluded…`
 * — the increment happens inside the database.
 *
 * The conflict target differs by scope, because the two partial unique indexes
 * are conditional (`WHERE organization_id IS NOT NULL` / `IS NULL`). Passing an
 * index predicate to `targetWhere` is what selects the right one.
 *
 * `quantity_available` is recomputed in the same statement: the table has a
 * CHECK that it equals `on_hand - reserved`, so leaving it stale would fail the
 * write rather than silently drift.
 */
@injectable()
export class BalanceRepository implements IBalanceRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/** Fetches one filtered page of balances. */
	async paginate(
		request: TBalancePaginationRequest,
	): Promise<TPaginationResult<TStockBalanceSelect>> {
		const {
			page,
			limit,
			scopeOrganizationId,
			warehouseId,
			itemId,
			binId,
			inStockOnly,
		} = request;

		const where = and(
			...scopeFilter(scopeOrganizationId),
			warehouseId ? eq(stockBalances.warehouseId, warehouseId) : undefined,
			itemId ? eq(stockBalances.itemId, itemId) : undefined,
			binId ? eq(stockBalances.binId, binId) : undefined,
			inStockOnly
				? gt(stockBalances.quantityOnHand, sql`0`)
				: undefined,
		);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(stockBalances)
			.where(where);

		const data = await this.database
			.select()
			.from(stockBalances)
			.where(where)
			.orderBy(
				stockBalances.warehouseId,
				stockBalances.itemId,
				stockBalances.binId,
			)
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	/** Fetches the balance for an exact key, if it exists. */
	async findByKey(key: TBalanceKey): Promise<TStockBalanceSelect | null> {
		const [row] = await this.database
			.select()
			.from(stockBalances)
			.where(keyPredicate(key))
			.limit(1);
		return row ?? null;
	}

	/** Lists every balance in one scope. */
	async listByScope(
		scopeOrganizationId: string | null,
	): Promise<TStockBalanceSelect[]> {
		return this.database
			.select()
			.from(stockBalances)
			.where(
				and(...scopeFilter(scopeOrganizationId)),
			);
	}

	/**
	 * Atomically adds a signed delta to a balance, creating it if absent.
	 *
	 * @param key - Which balance to touch
	 * @param delta - Signed quantity and the movement time
	 */
	async applyDelta(
		key: TBalanceKey,
		delta: TBalanceDelta,
		tx?: TTx,
	): Promise<TStockBalanceSelect> {
		const now = new Date();
		const db = tx ?? this.database;

		const [row] = await db
			.insert(stockBalances)
			.values({
				organizationId: key.scopeOrganizationId,
				itemId: key.itemId,
				warehouseId: key.warehouseId,
				binId: key.binId,
				// A brand-new balance starts at the delta; available mirrors it
				// because nothing can be reserved yet.
				quantityOnHand: delta.quantity,
				quantityReserved: '0',
				quantityAvailable: delta.quantity,
				lastMovementAt: delta.occurredAt,
				createdAt: now,
			})
			.onConflictDoUpdate({
				target: conflictTarget(key.scopeOrganizationId),
				// The increment is done by the database, in one statement: this
				// is the line that makes concurrent posts safe.
				set: {
					quantityOnHand: sql`${stockBalances.quantityOnHand} + ${delta.quantity}`,
					quantityAvailable: sql`${stockBalances.quantityOnHand} + ${delta.quantity} - ${stockBalances.quantityReserved}`,
					lastMovementAt: sql`greatest(coalesce(${stockBalances.lastMovementAt}, ${delta.occurredAt.getTime()}), ${delta.occurredAt.getTime()})`,
					updatedAt: now,
				},
				targetWhere: scopePredicateFor(key.scopeOrganizationId),
			})
			.returning();

		return row;
	}

	/**
	 * Sets a balance to an absolute quantity, creating it if absent.
	 *
	 * @param key - Which balance to touch
	 * @param quantity - The ledger-derived truth
	 * @param lastMovementAt - Latest contributing movement, if any
	 */
	async setQuantity(
		key: TBalanceKey,
		quantity: string,
		lastMovementAt: Date | null,
		tx?: TTx,
	): Promise<TStockBalanceSelect> {
		const now = new Date();
		const db = tx ?? this.database;

		const [row] = await db
			.insert(stockBalances)
			.values({
				organizationId: key.scopeOrganizationId,
				itemId: key.itemId,
				warehouseId: key.warehouseId,
				binId: key.binId,
				quantityOnHand: quantity,
				quantityReserved: '0',
				quantityAvailable: quantity,
				lastMovementAt,
				createdAt: now,
			})
			.onConflictDoUpdate({
				target: conflictTarget(key.scopeOrganizationId),
				set: {
					quantityOnHand: quantity,
					quantityAvailable: sql`${quantity}::numeric - ${stockBalances.quantityReserved}`,
					lastMovementAt,
					updatedAt: now,
				},
				targetWhere: scopePredicateFor(key.scopeOrganizationId),
			})
			.returning();

		return row;
	}

	/** Hard-deletes a balance row. */
	async remove(key: TBalanceKey): Promise<boolean> {
		const rows = await this.database
			.delete(stockBalances)
			.where(keyPredicate(key))
			.returning({ id: stockBalances.id });
		return rows.length > 0;
	}
}

/**
 * The partial unique index a scoped upsert should conflict on.
 *
 * @remarks
 * Must list the same columns as the matching index in the schema:
 * `(organization_id, warehouse_id, item_id, bin_id)` for tenant rows and
 * `(warehouse_id, item_id, bin_id)` for shared ones.
 *
 * @param scopeOrganizationId - `null` selects the global index
 */
function conflictTarget(scopeOrganizationId: string | null) {
	if (scopeOrganizationId === null) {
		return [
			stockBalances.warehouseId,
			stockBalances.itemId,
			stockBalances.binId,
		];
	}
	return [
		stockBalances.organizationId,
		stockBalances.warehouseId,
		stockBalances.itemId,
		stockBalances.binId,
	];
}

/** The index predicate matching {@link conflictTarget}. */
function scopePredicateFor(scopeOrganizationId: string | null) {
	return scopeOrganizationId === null
		? sql`organization_id IS NULL`
		: sql`organization_id IS NOT NULL`;
}

/** Exact-match predicate for a balance key. */
function keyPredicate(key: TBalanceKey) {
	return and(
		key.scopeOrganizationId === null
			? isNull(stockBalances.organizationId)
			: eq(stockBalances.organizationId, key.scopeOrganizationId),
		eq(stockBalances.warehouseId, key.warehouseId),
		eq(stockBalances.itemId, key.itemId),
		key.binId === null
			? isNull(stockBalances.binId)
			: eq(stockBalances.binId, key.binId),
	);
}

/**
 * Scope predicate for the list filter.
 *
 * @param scopeOrganizationId - `undefined` skips filtering; `null` = shared rows
 */
function scopeFilter(scopeOrganizationId: string | null | undefined) {
	if (scopeOrganizationId === undefined) return [];
	return [
		scopeOrganizationId === null
			? isNull(stockBalances.organizationId)
			: eq(stockBalances.organizationId, scopeOrganizationId),
	];
}
