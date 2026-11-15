import { DRIZZLE_TOKEN } from '@di/provider';
import { stockBalances } from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IBalanceRepository,
	TBalanceDelta,
	TBalanceKey,
	TBalancePaginationRequest,
} from '../contracts/balance.repository.interface';
import { InsufficientStockError } from '../errors/inventory.errors';
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
	 *    (`stock_balances_on_hand_check`) as the last line of defense.
	 *
	 * `quantity_available` is maintained in the same statement (it is a CHECK
	 * constraint: `available = on_hand - reserved`).
	 */
	async applyDelta(
		key: TBalanceKey,
		delta: TBalanceDelta,
		tx?: TTx,
	): Promise<TStockBalanceSelect> {
		const now = new Date();
		const db = tx ?? this.database;

		await db
			.insert(stockBalances)
			.values({
				organizationId: key.scopeOrganizationId,
				itemId: key.itemId,
				warehouseId: key.warehouseId,
				binId: key.binId,
				// A brand-new balance opens at zero and the guarded UPDATE below
				// applies the delta. Opening at the delta broke every outbound
				// movement (ERP-0061 found it): Postgres checks CHECK
				// constraints on the proposed row *before* ON CONFLICT
				// arbitration, so a negative delta failed
				// `stock_balances_on_hand_check` even when the row existed. A
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
			.select({ id: stockBalances.id })
			.from(stockBalances)
			.where(keyPredicate(key))
			.for('update')
			.limit(1);

		if (locked.length === 0) {
			// Unreachable in practice: the insert either created the row or
			// found a conflict — a row with this key must exist. Throwing keeps
			// the type honest and surfaces genuine corruption loudly.
			throw new Error(
				`stock_balances row disappeared after upsert: ${JSON.stringify(key)}`,
			);
		}

		const [row] = await db
			.update(stockBalances)
			.set({
				quantityOnHand: sql`${stockBalances.quantityOnHand} + ${delta.quantity}`,
				quantityAvailable: sql`${stockBalances.quantityOnHand} + ${delta.quantity} - ${stockBalances.quantityReserved}`,
				lastMovementAt: sql`greatest(coalesce(${stockBalances.lastMovementAt}, ${delta.occurredAt.getTime()}), ${delta.occurredAt.getTime()})`,
				updatedAt: now,
			})
			// The enforcement: refuse the delta if it would drive the balance
			// below zero. Runs under the FOR UPDATE lock, so it cannot race.
			.where(
				and(
					keyPredicate(key),
					sql`${stockBalances.quantityOnHand} + ${delta.quantity} >= 0`,
				),
			)
			.returning();

		if (!row) {
			// The WHERE guard fired: the delta would overdraw the balance. We
			// still hold the FOR UPDATE lock, so re-reading gives the exact
			// balance the refused update saw — no race can change it now.
			const [current] = await db
				.select({ onHand: stockBalances.quantityOnHand })
				.from(stockBalances)
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

	async lockForCost(
		key: TBalanceKey,
		tx: TTx,
	): Promise<{ quantityOnHand: string; averageCost: number; totalValue: number }> {
		// Create the row first (no-op when present) so the lock always has a
		// row to hold: two first-ever receipts then serialize on it.
		await tx
			.insert(stockBalances)
			.values({
				organizationId: key.scopeOrganizationId,
				itemId: key.itemId,
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
				quantityOnHand: stockBalances.quantityOnHand,
				averageCost: stockBalances.averageCost,
				totalValue: stockBalances.totalValue,
			})
			.from(stockBalances)
			.where(keyPredicate(key))
			.for('update');
		return row ?? { quantityOnHand: '0', averageCost: 0, totalValue: 0 };
	}

	async setCost(key: TBalanceKey, cost: { averageCost: number; totalValue: number }, tx?: TTx): Promise<void> {
		await (tx ?? this.database)
			.update(stockBalances)
			.set({ averageCost: cost.averageCost, totalValue: cost.totalValue, updatedAt: new Date() })
			.where(keyPredicate(key));
	}

	async availableByItems(itemIds: string[]) {
		if (itemIds.length === 0) return [];
		const rows = await this.database
			.select({ itemId: stockBalances.itemId, available: sql<string>`coalesce(sum(${stockBalances.quantityAvailable}), 0)` })
			.from(stockBalances)
			.where(inArray(stockBalances.itemId, itemIds))
			.groupBy(stockBalances.itemId);
		return rows.map((row) => ({ itemId: row.itemId, available: Number(row.available) }));
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
