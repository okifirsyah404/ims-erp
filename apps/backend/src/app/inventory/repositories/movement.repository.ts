import { DRIZZLE_TOKEN } from '@di/provider';
import { stockMovements, warehouses } from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import {
	OUTBOUND_TYPES,
	isOutbound,
} from '../constants/movement-direction';
import type { IMovementRepository, TMovementCreateData, TMovementPaginationRequest } from '../contracts/movement.repository.interface';
import type { TTx } from '@drizzle/types';
import type { TStockMovementSelect } from '@drizzle/schemas/inventory.schema';

/**
 * SQL for a movement's signed contribution to a balance.
 *
 * @remarks
 * **Every row counts, including `reversed` ones.** A reversal is a new opposing
 * movement, so the original and its reversal cancel exactly. Excluding the
 * original would leave the reversal uncancelled and drift the balance by `q` on
 * every reversal. Only a never-posted (`draft`) row contributes nothing.
 *
 * Kept as SQL (not JS) so the sum happens in the database: pulling rows back to
 * add them would not scale, and `numeric(18,3)` precision is safest there.
 */
const signedQuantitySql = sql<string>`
	CASE
		WHEN ${stockMovements.status} = 'draft' THEN 0
		WHEN ${stockMovements.movementType} IN (${sql.join(
			OUTBOUND_TYPES.map((type) => sql`${type}`),
			sql`, `,
		)}) THEN -${stockMovements.quantity}
		ELSE ${stockMovements.quantity}
	END
`;

/**
 * Computes a movement's signed contribution to a balance.
 *
 * @remarks
 * **Every row counts, including `reversed` ones.** A reversal is expressed as a
 * new opposing movement (see `StockService.reverseMovement`), so the original's
 * delta and the reversal's delta cancel each other exactly. Excluding the
 * original would leave the reversal's `+q` uncancelled and double-count the
 * correction — the balance would drift by `q` on every reversal.
 *
 * The `status` parameter is therefore not used to zero anything today; it is
 * kept so the rule stays explicit and a future `draft` state (which must NOT
 * count) has an obvious place to be handled.
 *
 * @param movementType - The movement's type
 * @param quantity - The stored, unsigned quantity
 * @param status - The movement's posting state
 */
export function signedContribution(
	movementType: string,
	quantity: string,
	status: string,
): number {
	// A movement that was never posted contributes nothing. `reversed` DID
	// post, and its reversal row cancels it, so it still counts here.
	if (status !== 'posted' && status !== 'reversed') return 0;
	return Number(quantity) * (isOutbound(movementType) ? -1 : 1);
}

/**
 * Drizzle implementation of {@link IMovementRepository}.
 *
 * @remarks
 * Append-only by design: there is no update or delete path here beyond
 * {@link claimForReversal}, whose conditional `WHERE status = 'posted'` is what
 * makes a double reversal impossible rather than merely discouraged.
 *
 * `scopeOrganizationId` is the **balance scope** (warehouse-derived), never the
 * caller's org. `null` selects the shared/global rows and is matched with
 * `isNull`, never `eq(column, null)`.
 */
@injectable()
export class MovementRepository implements IMovementRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/** Fetches one filtered page of the ledger, newest first. */
	async paginate(
		request: TMovementPaginationRequest,
	): Promise<TPaginationResult<TStockMovementSelect>> {
		const {
			page,
			limit,
			scopeOrganizationId,
			warehouseId,
			itemId,
			movementType,
			status,
			occurredFrom,
			occurredTo,
			referenceType,
		} = request;

		const where = and(
			...scopeFilter(scopeOrganizationId),
			warehouseId ? eq(stockMovements.warehouseId, warehouseId) : undefined,
			itemId ? eq(stockMovements.itemId, itemId) : undefined,
			movementType
				? eq(stockMovements.movementType, movementType)
				: undefined,
			status ? eq(stockMovements.status, status) : undefined,
			referenceType
				? eq(stockMovements.referenceType, referenceType)
				: undefined,
			occurredFrom ? gte(stockMovements.occurredAt, occurredFrom) : undefined,
			occurredTo ? lte(stockMovements.occurredAt, occurredTo) : undefined,
		);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(stockMovements)
			.where(where);

		const data = await this.database
			.select()
			.from(stockMovements)
			.where(where)
			.orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id))
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	/** Fetches one movement by id. */
	async findById(id: string): Promise<TStockMovementSelect | null> {
		const [row] = await this.database
			.select()
			.from(stockMovements)
			.where(eq(stockMovements.id, id))
			.limit(1);
		return row ?? null;
	}

	/** Appends one movement row. */
	async create(
		data: TMovementCreateData,
		tx?: TTx,
	): Promise<TStockMovementSelect> {
		const db = tx ?? this.database;
		const [row] = await db
			.insert(stockMovements)
			.values({
				...data,
				status: data.status ?? 'posted',
				createdAt: data.createdAt ?? new Date(),
			})
			.returning();
		return row;
	}

	/** Finds the reversal row already pointing at `movementId`, if any. */
	async findReversalOf(
		movementId: string,
	): Promise<TStockMovementSelect | null> {
		const [row] = await this.database
			.select()
			.from(stockMovements)
			.where(
				and(
					eq(stockMovements.referenceType, 'reversal'),
					eq(stockMovements.referenceId, movementId),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/**
	 * Atomically marks a `posted` movement as `reversed`.
	 *
	 * @remarks
	 * The status predicate is in the `WHERE`, so this doubles as the
	 * concurrency guard: of two simultaneous reversals exactly one matches a
	 * row and the other gets `null`.
	 */
	async claimForReversal(
		id: string,
		tx?: TTx,
	): Promise<TStockMovementSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(stockMovements)
			.set({ status: 'reversed' })
			.where(
				and(eq(stockMovements.id, id), eq(stockMovements.status, 'posted')),
			)
			.returning();
		return row ?? null;
	}

	/** Every posted movement of one balance scope, in posting order. */
	ledgerRows(scopeOrganizationId: string | null) {
		return this.database
			.select({
				itemId: stockMovements.itemId,
				warehouseId: stockMovements.warehouseId,
				binId: stockMovements.binId,
				movementType: stockMovements.movementType,
				quantity: stockMovements.quantity,
				unitCost: stockMovements.unitCost,
			})
			.from(stockMovements)
			.where(and(balanceScopeFilter(scopeOrganizationId), ne(stockMovements.status, 'draft')))
			.orderBy(asc(stockMovements.occurredAt), asc(stockMovements.createdAt), asc(stockMovements.id));
	}

	/** Sums signed quantities per `(item, warehouse, bin)` of one balance scope. */
	async ledgerTotals(
		scopeOrganizationId: string | null,
	): Promise<
		Array<{
			itemId: string;
			warehouseId: string;
			binId: string | null;
			quantity: string;
		}>
	> {
		return this.database
			.select({
				itemId: stockMovements.itemId,
				warehouseId: stockMovements.warehouseId,
				binId: stockMovements.binId,
				quantity: sql<string>`sum(${signedQuantitySql})`,
			})
			.from(stockMovements)
			.where(
				and(
					balanceScopeFilter(scopeOrganizationId),
					// A draft movement was never posted, so it must not appear in
					// the ledger's totals at all.
					ne(stockMovements.status, 'draft'),
				),
			)
			.groupBy(
				stockMovements.itemId,
				stockMovements.warehouseId,
				stockMovements.binId,
			);
	}
}

/**
 * Balance-scope predicate, including the shared (`NULL`) scope.
 *
 * @param scopeOrganizationId - `undefined` skips filtering; `null` = shared rows
 */
function scopeFilter(scopeOrganizationId: string | null | undefined) {
	if (scopeOrganizationId === undefined) return [];
	return [
		scopeOrganizationId === null
			? isNull(stockMovements.organizationId)
			: eq(stockMovements.organizationId, scopeOrganizationId),
	];
}

/**
 * Movements that feed the balances of one scope.
 *
 * @remarks
 * A balance's scope is its **warehouse's** organization (see
 * `StockService.resolveScope`), while a movement's `organization_id` records
 * who posted it. A member of an organization receiving into a shared warehouse
 * therefore writes a tenant-attributed movement into a shared balance, so the
 * ledger must be selected by the warehouse, not by the movement's own column.
 *
 * @param scopeOrganizationId - `null` = shared warehouses
 */
function balanceScopeFilter(scopeOrganizationId: string | null) {
	return inArray(
		stockMovements.warehouseId,
		sql`(select ${warehouses.id} from ${warehouses} where ${
			scopeOrganizationId === null
				? isNull(warehouses.organizationId)
				: eq(warehouses.organizationId, scopeOrganizationId)
		})`,
	);
}
