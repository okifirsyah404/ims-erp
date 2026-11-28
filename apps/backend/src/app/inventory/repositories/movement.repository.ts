import { DRIZZLE_TOKEN } from '@di/provider';
import { movements } from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import {
	OUTBOUND_TYPES,
	isOutbound,
} from '../constants/movement-direction';
import type {
	IMovementRepository,
	TMovementCreateData,
	TMovementPaginationRequest,
	TProductMovementSelect,
} from '../contracts/movement.repository.interface';
import type { TTx } from '@drizzle/types';

/** Stock-ledger rows only: item (asset) movements share the table but never count here. */
const productMovement = and(isNotNull(movements.productId), isNotNull(movements.warehouseId));

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
		WHEN ${movements.status} = 'draft' THEN 0
		WHEN ${movements.movementType} IN (${sql.join(
			OUTBOUND_TYPES.map((type) => sql`${type}`),
			sql`, `,
		)}) THEN -${movements.quantity}
		ELSE ${movements.quantity}
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
	): Promise<TPaginationResult<TProductMovementSelect>> {
		const {
			page,
			limit,
			scopeOrganizationId,
			warehouseId,
			productId,
			movementType,
			status,
			occurredFrom,
			occurredTo,
			referenceType,
		} = request;

		const where = and(
			productMovement,
			...scopeFilter(scopeOrganizationId),
			warehouseId ? eq(movements.warehouseId, warehouseId) : undefined,
			productId ? eq(movements.productId, productId) : undefined,
			movementType
				? eq(movements.movementType, movementType)
				: undefined,
			status ? eq(movements.status, status) : undefined,
			referenceType
				? eq(movements.referenceType, referenceType)
				: undefined,
			occurredFrom ? gte(movements.occurredAt, occurredFrom) : undefined,
			occurredTo ? lte(movements.occurredAt, occurredTo) : undefined,
		);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(movements)
			.where(where);

		const data = await this.database
			.select()
			.from(movements)
			.where(where)
			.orderBy(desc(movements.occurredAt), desc(movements.id))
			.limit(limit)
			.offset((page - 1) * limit);

		return paginationResult({ page, limit }, total, data as TProductMovementSelect[]);
	}

	/** Fetches one movement by id. */
	async findById(id: string): Promise<TProductMovementSelect | null> {
		const [row] = await this.database
			.select()
			.from(movements)
			.where(and(eq(movements.id, id), productMovement))
			.limit(1);
		return (row as TProductMovementSelect | undefined) ?? null;
	}

	/** Appends one movement row. */
	listForProject(projectId: string) {
		return this.database
			.select({
				id: movements.id,
				code: movements.code,
				movementType: movements.movementType,
				quantity: movements.quantity,
				unitCost: movements.unitCost,
				occurredAt: movements.occurredAt,
			})
			.from(movements)
			.where(
				and(
					eq(movements.referenceType, 'project'),
					eq(movements.referenceId, projectId),
					eq(movements.status, 'posted'),
					inArray(movements.movementType, ['receipt', 'issue']),
				),
			)
			.orderBy(asc(movements.occurredAt));
	}

	async create(
		data: TMovementCreateData,
		tx?: TTx,
	): Promise<TProductMovementSelect> {
		const db = tx ?? this.database;
		const [row] = await db
			.insert(movements)
			.values({
				...data,
				status: data.status ?? 'posted',
				createdAt: data.createdAt ?? new Date(),
			})
			.returning();
		return row as TProductMovementSelect;
	}

	/** Finds the reversal row already pointing at `movementId`, if any. */
	async findReversalOf(
		movementId: string,
	): Promise<TProductMovementSelect | null> {
		const [row] = await this.database
			.select()
			.from(movements)
			.where(
				and(
					eq(movements.referenceType, 'reversal'),
					eq(movements.referenceId, movementId),
				),
			)
			.limit(1);
		return (row as TProductMovementSelect | undefined) ?? null;
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
	): Promise<TProductMovementSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(movements)
			.set({ status: 'reversed' })
			.where(
				and(eq(movements.id, id), eq(movements.status, 'posted')),
			)
			.returning();
		return (row as TProductMovementSelect | undefined) ?? null;
	}

	/** Every posted movement of one balance scope, in posting order. */
	async ledgerRows(warehouseIds: string[]) {
		const rows = await this.database
			.select({
				productId: movements.productId,
				warehouseId: movements.warehouseId,
				binId: movements.binId,
				movementType: movements.movementType,
				quantity: movements.quantity,
				unitCost: movements.unitCost,
			})
			.from(movements)
			.where(and(productMovement, balanceScopeFilter(warehouseIds), ne(movements.status, 'draft')))
			.orderBy(asc(movements.occurredAt), asc(movements.createdAt), asc(movements.id));
		return rows as Array<(typeof rows)[number] & { productId: string; warehouseId: string }>;
	}

	/** Sums signed quantities per `(item, warehouse, bin)` of one balance scope. */
	async ledgerTotals(
		warehouseIds: string[],
	): Promise<
		Array<{
			productId: string;
			warehouseId: string;
			binId: string | null;
			quantity: string;
		}>
	> {
		const rows = await this.database
			.select({
				productId: movements.productId,
				warehouseId: movements.warehouseId,
				binId: movements.binId,
				quantity: sql<string>`sum(${signedQuantitySql})`,
			})
			.from(movements)
			.where(
				and(
					productMovement,
					balanceScopeFilter(warehouseIds),
					// A draft movement was never posted, so it must not appear in
					// the ledger's totals at all.
					ne(movements.status, 'draft'),
				),
			)
			.groupBy(
				movements.productId,
				movements.warehouseId,
				movements.binId,
			);
		return rows as Array<(typeof rows)[number] & { productId: string; warehouseId: string }>;
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
			? isNull(movements.organizationId)
			: eq(movements.organizationId, scopeOrganizationId),
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
 * The warehouse ids of the scope come from the `warehouse` module (ADR-0026),
 * so the filter is a plain `IN` over ids resolved by the caller — never a
 * subquery into `warehouse.warehouses`.
 *
 * @param warehouseIds - Every warehouse whose balances carry this scope
 */
function balanceScopeFilter(warehouseIds: string[]) {
	return inArray(movements.warehouseId, warehouseIds);
}
