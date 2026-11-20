import { DRIZZLE_TOKEN } from '@di/provider';
import { itemSerials, stocks } from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IStockRepository,
	TStockDelta,
	TStockKey,
	TStockPaginationRequest,
} from '../contracts/stock.repository.interface';
import { InsufficientStockError } from '../errors/inventory.errors';
import type { TStockSelect } from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';

/**
 * Drizzle implementation of {@link IStockRepository}.
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
export class StockRepository implements IStockRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/** Fetches one filtered page of balances. */
	async paginate(
		request: TStockPaginationRequest,
	): Promise<TPaginationResult<TStockSelect>> {
		const {
			page,
			limit,
			scopeOrganizationId,
			warehouseId,
			productId,
			binId,
			inStockOnly,
		} = request;

		const where = and(
			...scopeFilter(scopeOrganizationId),
			warehouseId ? eq(stocks.warehouseId, warehouseId) : undefined,
			productId ? eq(stocks.productId, productId) : undefined,
			binId ? eq(stocks.binId, binId) : undefined,
			inStockOnly
				? gt(stocks.quantityOnHand, sql`0`)
				: undefined,
		);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(stocks)
			.where(where);

		const data = await this.database
			.select()
			.from(stocks)
			.where(where)
			.orderBy(
				stocks.warehouseId,
				stocks.productId,
				stocks.binId,
			)
			.limit(limit)
			.offset((page - 1) * limit);

		return paginationResult({ page, limit }, total, data);
	}

	/** Fetches the balance for an exact key, if it exists. */
	async findByKey(key: TStockKey): Promise<TStockSelect | null> {
		const [row] = await this.database
			.select()
			.from(stocks)
			.where(keyPredicate(key))
			.limit(1);
		return row ?? null;
	}

	/** Lists every balance in one scope. */
	async listByScope(
		scopeOrganizationId: string | null,
	): Promise<TStockSelect[]> {
		return this.database
			.select()
			.from(stocks)
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
	/**
	 * Atomically adds a signed delta to a balance, creating it if absent.
	 *
	 * @remarks
	 * The serialized mutation path (hardening plan Phase I-1 / D2). Sequence:
	 * 1. `INSERT … ON CONFLICT DO NOTHING` — creates the row if absent; if it
	 *    already exists this is a no-op.
	 * 2. `SELECT … FOR UPDATE` — takes the row lock. Every concurrent poster
	 *    on the same balance blocks here until the first commits, so the
	 *    read-modify-write that follows is race-free (TOCTOU closed).
	 * 3. Conditional `UPDATE … WHERE quantity_on_hand + delta >= 0` — the
	 *    database refuses the write itself if the delta would go negative.
	 *    The WHERE-clause guard runs under the lock, so unlike a pre-check it
	 *    cannot race: it IS the enforcement, with the CHECK constraints
	 *    (`stocks_on_hand_check`) as the last line of defense.
	 *
	 * `quantity_available` is maintained in the same statement (it is a CHECK
	 * constraint: `available = on_hand - reserved`).
	 */
	async applyDelta(
		key: TStockKey,
		delta: TStockDelta,
		tx?: TTx,
	): Promise<TStockSelect> {
		const now = new Date();
		const db = tx ?? this.database;

		await db
			.insert(stocks)
			.values({
				organizationId: key.scopeOrganizationId,
				productId: key.productId,
				warehouseId: key.warehouseId,
				binId: key.binId,
				// A brand-new balance opens at zero and the guarded UPDATE below
				// applies the delta. Opening at the delta broke every outbound
				// movement (ERP-0068 found it): Postgres checks CHECK
				// constraints on the proposed row *before* ON CONFLICT
				// arbitration, so a negative delta failed
				// `stocks_on_hand_check` even when the row existed. A
				// negative delta on a missing balance is still refused, by the
				// UPDATE guard (InsufficientStockError).
				quantityOnHand: '0',
				quantityReserved: '0',
				quantityAvailable: '0',
				lastMovementAt: delta.occurredAt,
				createdAt: now,
			})
			.onConflictDoNothing({
				target: conflictTarget(key.scopeOrganizationId),
				// Index predicate of the partial unique index being targeted.
				where: scopePredicateFor(key.scopeOrganizationId),
			});

		// Lock the row (ours if just created, someone else's if it existed).
		const locked = await db
			.select({ id: stocks.id })
			.from(stocks)
			.where(keyPredicate(key))
			.for('update')
			.limit(1);

		if (locked.length === 0) {
			// Unreachable in practice: the insert either created the row or
			// found a conflict — a row with this key must exist. Throwing keeps
			// the type honest and surfaces genuine corruption loudly.
			throw new Error(
				`stocks row disappeared after upsert: ${JSON.stringify(key)}`,
			);
		}

		const [row] = await db
			.update(stocks)
			.set({
				quantityOnHand: sql`${stocks.quantityOnHand} + ${delta.quantity}`,
				quantityAvailable: sql`${stocks.quantityOnHand} + ${delta.quantity} - ${stocks.quantityReserved}`,
				lastMovementAt: sql`greatest(coalesce(${stocks.lastMovementAt}, ${delta.occurredAt.getTime()}), ${delta.occurredAt.getTime()})`,
				updatedAt: now,
			})
			// The enforcement: refuse the delta if it would drive the balance
			// below zero. Runs under the FOR UPDATE lock, so it cannot race.
			.where(
				and(
					keyPredicate(key),
					sql`${stocks.quantityOnHand} + ${delta.quantity} >= 0`,
				),
			)
			.returning();

		if (!row) {
			// The WHERE guard fired: the delta would overdraw the balance. We
			// still hold the FOR UPDATE lock, so re-reading gives the exact
			// balance the refused update saw — no race can change it now.
			const [current] = await db
				.select({ onHand: stocks.quantityOnHand })
				.from(stocks)
				.where(keyPredicate(key))
				.limit(1);
			throw new InsufficientStockError(
				current?.onHand ?? '0',
				Number(delta.quantity).toFixed(3),
			);
		}

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
		key: TStockKey,
		quantity: string,
		lastMovementAt: Date | null,
		tx?: TTx,
	): Promise<TStockSelect> {
		const now = new Date();
		const db = tx ?? this.database;

		const [row] = await db
			.insert(stocks)
			.values({
				organizationId: key.scopeOrganizationId,
				productId: key.productId,
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
					quantityAvailable: sql`${quantity}::numeric - ${stocks.quantityReserved}`,
					lastMovementAt,
					updatedAt: now,
				},
				targetWhere: scopePredicateFor(key.scopeOrganizationId),
			})
			.returning();

		return row;
	}

	async lockForCost(
		key: TStockKey,
		tx: TTx,
	): Promise<{ quantityOnHand: string; averageCost: number; totalValue: number }> {
		// Create the row first (no-op when present) so the lock always has a
		// row to hold: two first-ever receipts then serialize on it.
		await tx
			.insert(stocks)
			.values({
				organizationId: key.scopeOrganizationId,
				productId: key.productId,
				warehouseId: key.warehouseId,
				binId: key.binId,
				quantityOnHand: '0',
				quantityReserved: '0',
				quantityAvailable: '0',
				lastMovementAt: null,
				createdAt: new Date(),
			})
			.onConflictDoNothing({
				target: conflictTarget(key.scopeOrganizationId),
				where: scopePredicateFor(key.scopeOrganizationId),
			});
		const [row] = await tx
			.select({
				quantityOnHand: stocks.quantityOnHand,
				averageCost: stocks.averageCost,
				totalValue: stocks.totalValue,
			})
			.from(stocks)
			.where(keyPredicate(key))
			.for('update');
		return row ?? { quantityOnHand: '0', averageCost: 0, totalValue: 0 };
	}

	async setCost(key: TStockKey, cost: { averageCost: number; totalValue: number }, tx?: TTx): Promise<void> {
		await (tx ?? this.database)
			.update(stocks)
			.set({ averageCost: cost.averageCost, totalValue: cost.totalValue, updatedAt: new Date() })
			.where(keyPredicate(key));
	}

	async availableByProducts(productIds: string[]) {
		if (productIds.length === 0) return [];
		const rows = await this.database
			.select({ productId: stocks.productId, available: sql<string>`coalesce(sum(${stocks.quantityAvailable}), 0)` })
			.from(stocks)
			.where(inArray(stocks.productId, productIds))
			.groupBy(stocks.productId);
		return rows.flatMap((row) =>
			row.productId
				? [{ productId: row.productId, available: Number(row.available) }]
				: [],
		);
	}

	/**
	 * Products with a physical presence in one warehouse (ADR-0026).
	 *
	 * @remarks
	 * Either a live serialized unit or a stock balance, because
	 * quantity-tracked products have no units at all — their stock lives only
	 * in `stocks`. Two `EXISTS` are unioned rather than joined so a product
	 * with several units or bins in the warehouse appears once. `product` uses
	 * the returned ids for its `inArray` filter, because it may not read
	 * `inventory.*` (and the unit rows are this module's table anyway).
	 *
	 * @param warehouseId - The warehouse the product list is scoped to
	 */
	async productIdsInWarehouse(warehouseId: string): Promise<string[]> {
		const rows = await this.database
			.select({ productId: stocks.productId })
			.from(stocks)
			.where(eq(stocks.warehouseId, warehouseId))
			.union(
				this.database
					.select({ productId: itemSerials.productId })
					.from(itemSerials)
					.where(
						and(
							isNull(itemSerials.deletedAt),
							eq(itemSerials.warehouseId, warehouseId),
						),
					),
			);
		return rows.flatMap((row) => (row.productId ? [row.productId] : []));
	}

	/**
	 * Distinct products with a positive on-hand balance per warehouse.
	 *
	 * @remarks
	 * Materials are never serialized, so their "is it here" answer is a
	 * balance, not a unit. `warehouse` composes this into its kind counts.
	 *
	 * @param warehouseIds - The warehouses on the current page
	 */
	async countMaterialStocks(
		warehouseIds: string[],
	): Promise<Array<{ warehouseId: string | null; productId: string }>> {
		if (warehouseIds.length === 0) return [];
		const rows = await this.database
			.selectDistinct({ warehouseId: stocks.warehouseId, productId: stocks.productId })
			.from(stocks)
			.where(
				and(
					gt(stocks.quantityOnHand, '0'),
					inArray(stocks.warehouseId, warehouseIds),
				),
			);
		return rows.flatMap((row) =>
			row.productId ? [{ warehouseId: row.warehouseId, productId: row.productId }] : [],
		);
	}

	/** Hard-deletes a balance row. */
	async remove(key: TStockKey): Promise<boolean> {
		const rows = await this.database
			.delete(stocks)
			.where(keyPredicate(key))
			.returning({ id: stocks.id });
		return rows.length > 0;
	}
}

/**
 * The partial unique index a scoped upsert should conflict on.
 *
 * @remarks
 * Must list the same columns as the matching index in the schema:
 * `(organization_id, warehouse_id, product_id, bin_id)` for tenant rows and
 * `(warehouse_id, product_id, bin_id)` for shared ones.
 *
 * @param scopeOrganizationId - `null` selects the global index
 */
function conflictTarget(scopeOrganizationId: string | null) {
	if (scopeOrganizationId === null) {
		return [
			stocks.warehouseId,
			stocks.productId,
			stocks.binId,
		];
	}
	return [
		stocks.organizationId,
		stocks.warehouseId,
		stocks.productId,
		stocks.binId,
	];
}

/** The index predicate matching {@link conflictTarget}. */
function scopePredicateFor(scopeOrganizationId: string | null) {
	return scopeOrganizationId === null
		? sql`organization_id IS NULL`
		: sql`organization_id IS NOT NULL`;
}

/** Exact-match predicate for a balance key. */
function keyPredicate(key: TStockKey) {
	return and(
		key.scopeOrganizationId === null
			? isNull(stocks.organizationId)
			: eq(stocks.organizationId, key.scopeOrganizationId),
		eq(stocks.warehouseId, key.warehouseId),
		eq(stocks.productId, key.productId),
		key.binId === null
			? isNull(stocks.binId)
			: eq(stocks.binId, key.binId),
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
			? isNull(stocks.organizationId)
			: eq(stocks.organizationId, scopeOrganizationId),
	];
}
