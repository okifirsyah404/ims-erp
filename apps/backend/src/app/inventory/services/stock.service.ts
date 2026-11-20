import { inject, injectable } from 'tsyringe';
import { isOutbound } from '../constants/movement-direction';
import type { TPaginationResult } from '@ims-erp/common';
import { DRIZZLE_TOKEN } from '@di/provider';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type {
	MovementType,
	TStockSelect,
	TWarehouseSelect,
} from '@drizzle/schemas/inventory.schema';
import type {
	IMovementRepository,
	TMovementPaginationRequest,
	TProductMovementSelect,
} from '../contracts/movement.repository.interface';
import type {
	IStockRepository,
	TStockKey,
	TStockPaginationRequest,
} from '../contracts/stock.repository.interface';
import type { IProductRepository } from '../contracts/product.repository.interface';
import type { IWarehouseRepository } from '../contracts/warehouse.repository.interface';
import {
	STOCK_REPOSITORY_TOKEN,
	PRODUCT_IMAGE_SERVICE_TOKEN,
	PRODUCT_REPOSITORY_TOKEN,
	MOVEMENT_REPOSITORY_TOKEN,
	WAREHOUSE_REPOSITORY_TOKEN,
} from '../constants/di';
import {
	MovementAlreadyReversedError,
	MovementNotFoundError,
	WarehouseNotFoundError,
} from '../errors/inventory.errors';
import type { TTx } from '@drizzle/types';
import { applyMovementCost, type TCostState } from '../utils/moving-average';
import { INVENTORY_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { InventoryNumberingService } from './inventory-numbering.service';
import type { ProductImageService } from './product-image.service';
import { InventoryAuditWriter } from './inventory-audit.writer';

/** One balance row decorated with readable item and warehouse names. */
export type TStockBalanceWithNames = TStockSelect & {
	/** Resolved item name; `null` when the item is archived or unknown. */
	itemName: string | null;
	/** Resolved warehouse name; `null` when the warehouse is archived or unknown. */
	warehouseName: string | null;
	/** Item photo URL; `null` when the item has no photo or is unknown. */
	imageUrl: string | null;
};

/** One movement row decorated with readable item and warehouse names. */
export type TStockMovementWithNames = TProductMovementSelect & {
	itemName: string | null;
	warehouseName: string | null;
	/** Item photo URL; `null` when the item has no photo or is unknown. */
	imageUrl: string | null;
};

/** Movement types that decrease stock. Every other type increases it. */
export { isOutbound } from '../constants/movement-direction';

/** Input for appending one movement. */
export type TPostMovementInput = {
	/** The **acting** organization — who is doing it. Recorded on the ledger. */
	actorOrganizationId: string;
	warehouseId: string;
	binId?: string | null;
	productId: string;
	movementType: MovementType;
	/** Always positive; direction comes from {@link isOutbound}. */
	quantity: string;
	occurredAt?: Date;
	referenceType?: string | null;
	referenceId?: string | null;
	createdBy?: string | null;
	notes?: string | null;
	/** Required for transfer types by a schema CHECK. */
	targetWarehouseId?: string | null;
	/**
	 * Inbound unit cost in IDR minor units (ADR-0011 §5). Omitted inbound
	 * movements are valued at the current average; outbound movements always
	 * leave at the average.
	 */
	unitCost?: number | null;
};

/** A movement plus the balance it produced. */
export type TPostedMovement = {
	movement: TProductMovementSelect;
	balance: TStockSelect;
	/** The balance scope the row lives in (the warehouse's, not the caller's). */
	scopeOrganizationId: string | null;
};

/**
 * Stock ledger and balance service.
 *
 * @remarks
 * **The scope rule.** A balance's `organization_id` is derived from the
 * *warehouse*, not the caller:
 * - organization-owned warehouse → balance rows carry that warehouse's
 *   `organization_id` (per-organization stock, isolated);
 * - global warehouse (`organization_id IS NULL`) → a single balance row with
 *   `organization_id = NULL`, **shared by every organization**.
 *
 * The second case is deliberate: a global warehouse is one shared physical
 * space, so its quantity is shared too. It is the one place in this codebase
 * where isolation is intentionally *not* by caller — see
 * {@link resolveScope}. The movement row still records the acting organization
 * and user, so the ledger keeps attribution even when the balance is shared.
 *
 * **Balance maintenance is incremental and atomic.** `postMovement` writes the
 * movement and applies the delta in one transaction, and the delta is applied by
 * a database `ON CONFLICT … DO UPDATE` (never read-then-write), so concurrent
 * posts cannot lose an update. {@link recomputeFromLedger} is the repair path
 * and the test oracle: after any sequence of posts and reversals, the
 * incrementally maintained balances must equal the recomputed ones.
 */
@injectable()
export class StockService {
	constructor(
		@inject(MOVEMENT_REPOSITORY_TOKEN)
		private readonly movementRepository: IMovementRepository,
		@inject(STOCK_REPOSITORY_TOKEN)
		private readonly balanceRepository: IStockRepository,
		@inject(WAREHOUSE_REPOSITORY_TOKEN)
		private readonly warehouseRepository: IWarehouseRepository,
		/** Name resolution for stock-row decoration (items and warehouses). */
		@inject(PRODUCT_REPOSITORY_TOKEN)
		private readonly itemRepository: IProductRepository,
		/** Turns an item's stored photo key into a URL for the same rows. */
		@inject(PRODUCT_IMAGE_SERVICE_TOKEN)
		private readonly itemImages: Pick<ProductImageService, 'urlFor'>,
		/**
		 * ERP-0009 numbering authority: movement codes are sequence-allocated
		 * inside the posting transaction (hardening plan D4), replacing the
		 * former random-suffix scheme.
		 */
		@inject(INVENTORY_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<InventoryNumberingService, 'next'>,
		/** Fire-and-forget audit writer (hardening plan D3). */
		private readonly audit: InventoryAuditWriter,
		/**
		 * The live Drizzle handle, for the service-owned transaction boundary.
		 *
		 * @remarks
		 * `architecture.md` puts transaction ownership in services: the
		 * repositories accept an optional transaction handle so a movement and
		 * its balance commit as one unit.
		 */
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/** Fetches one page of the movement ledger, with item/warehouse names. */
	async paginateMovements(
		request: TMovementPaginationRequest,
	): Promise<TPaginationResult<TStockMovementWithNames>> {
		const result = await this.movementRepository.paginate(request);
		const names = await this.resolveNames(
			result.data.flatMap((row) => [row.productId, row.warehouseId]),
		);
		return {
			...result,
			data: result.data.map((row) => ({
				...row,
				itemName: names.items.get(row.productId)?.name ?? null,
				warehouseName: names.warehouses.get(row.warehouseId) ?? null,
				imageUrl: this.itemImages.urlFor(
					names.items.get(row.productId)?.imageObjectKey ?? null,
				),
			})),
		};
	}

	/** Fetches one page of balances, with item/warehouse names. */
	async paginateBalances(
		request: TStockPaginationRequest,
	): Promise<TPaginationResult<TStockBalanceWithNames>> {
		const result = await this.balanceRepository.paginate(request);
		const names = await this.resolveNames(
			result.data.flatMap((row) => [row.productId, row.warehouseId]),
		);
		return {
			...result,
			data: result.data.map((row) => ({
				...row,
				itemName: names.items.get(row.productId)?.name ?? null,
				warehouseName: names.warehouses.get(row.warehouseId) ?? null,
				imageUrl: this.itemImages.urlFor(
					names.items.get(row.productId)?.imageObjectKey ?? null,
				),
			})),
		};
	}

	/**
	 * Batch-resolves item and warehouse names for the given ids, in two
	 * queries regardless of page size. Unknown ids are absent from the maps.
	 */
	private async resolveNames(ids: string[]): Promise<{
		items: Map<string, { name: string; imageObjectKey: string | null }>;
		warehouses: Map<string, string>;
	}> {
		const unique = [...new Set(ids)];
		if (unique.length === 0) {
			return { items: new Map(), warehouses: new Map() };
		}
		const [itemRows, warehouseRows] = await Promise.all([
			this.itemRepository.findNamesByIds(unique),
			this.warehouseRepository.findNamesByIds(unique),
		]);
		return {
			items: new Map(
				itemRows.map((row) => [
					row.id,
					{ name: row.name, imageObjectKey: row.imageObjectKey },
				]),
			),
			warehouses: new Map(warehouseRows.map((row) => [row.id, row.name])),
		};
	}

	/**
	 * Rejects a client-supplied warehouse the caller's organization is not
	 * linked to (ERP-0031).
	 *
	 * @param warehouseId - The warehouse the request names
	 * @param actorOrganizationId - The validated tenant from `erp`
	 * @throws {WarehouseNotFoundError} When absent, archived, **or unlinked** —
	 *   not-found rather than forbidden, so warehouse ids cannot be probed
	 *
	 * @remarks
	 * Called from the controller for the actor-driven flows (receipt, issue,
	 * adjustment posting). Internal writers — the borrowing engine moving a
	 * unit back to `line.origin_warehouse_id`, seeded opening stock — skip
	 * this on purpose: they act on custody the system itself set up.
	 */
	async assertWarehouseLinkedFor(
		warehouseId: string,
		actorOrganizationId: string,
	): Promise<void> {
		const warehouse = await this.warehouseRepository.findById(warehouseId);
		if (!warehouse) throw new WarehouseNotFoundError();
		const linked = await this.warehouseRepository.isLinked(
			warehouseId,
			actorOrganizationId,
		);
		if (!linked) throw new WarehouseNotFoundError();
	}

	/**
	 * Resolves the balance scope a warehouse belongs to.
	 *
	 * @param warehouseId - The warehouse being moved in or out of
	 * @returns The warehouse, and the `organizationId` its balances carry
	 * @throws {WarehouseNotFoundError} When the warehouse is absent or archived
	 */
	async resolveScope(
		warehouseId: string,
	): Promise<{ warehouse: TWarehouseSelect; scopeOrganizationId: string | null }> {
		const warehouse = await this.warehouseRepository.findById(warehouseId);
		if (!warehouse) throw new WarehouseNotFoundError();
		// The warehouse's own scope decides. NOT the caller's organization:
		// posting into a global warehouse contributes to the SHARED balance.
		return { warehouse, scopeOrganizationId: warehouse.organizationId };
	}

	/**
	 * Reads one balance row.
	 *
	 * @param scopeOrganizationId - The warehouse-derived scope, not the caller's
	 * @param warehouseId - The warehouse
	 * @param productId - The item
	 * @param binId - The bin, or `null` for unassigned stock
	 */
	balanceFor(
		scopeOrganizationId: string | null,
		warehouseId: string,
		productId: string,
		binId: string | null,
	): Promise<TStockSelect | null> {
		return this.balanceRepository.findByKey({
			scopeOrganizationId,
			productId,
			warehouseId,
			binId,
		});
	}

	/**
	 * Appends a movement and applies its delta to the balance, atomically.
	 *
	 * @param input - The movement to post
	 * @param tx - An outer transaction to join.
	 * @returns The movement and the resulting balance
	 * @throws {WarehouseNotFoundError} When the warehouse is absent
	 * @throws {InsufficientStockError} When an outbound move would go below zero
	 *
	 * @remarks
	 * `tx` exists for callers that must commit the movement **with** something
	 * else. The borrowing flow is the only one today: issuing a unit writes the
	 * unit's custody, the ledger row, the balance delta, and the timeline event
	 * and none of those may commit alone. Passing an outer handle makes this
	 * method join that transaction instead of opening a nested one (Drizzle
	 * would treat a nested `database.transaction` as a savepoint, so a rollback
	 * of the outer unit-of-work would not undo a committed movement).
	 */
	async postMovement(
		input: TPostMovementInput,
		tx?: TTx,
	): Promise<TPostedMovement> {
		const { scopeOrganizationId } = await this.resolveScope(input.warehouseId);
		const outbound = isOutbound(input.movementType);
		const occurredAt = input.occurredAt ?? new Date();
		const key: TStockKey = {
			scopeOrganizationId,
			productId: input.productId,
			warehouseId: input.warehouseId,
			binId: input.binId ?? null,
		};

		// One transaction for the movement and its balance (architecture.md:
		// services own transaction boundaries). A failure in either must not
		// leave a posted movement with no matching balance, or vice versa —
		// that divergence is exactly what recomputeFromLedger would have to
		// repair later.
		const run = async (handle: TTx): Promise<TPostedMovement> => {
			// The balance row is locked for the cost update (ADR-0011 §5).
			// Negative stock is refused by `applyDelta` itself: the conditional
			// UPDATE runs under a FOR UPDATE row lock, so the check cannot race
			// (hardening plan Phase I-1 / D2); InsufficientStockError rolls this
			// transaction back, leaving no movement row behind.
			const locked = await this.balanceRepository.lockForCost(key, handle);
			const cost = applyMovementCost(costState(locked), {
				outbound,
				quantity: input.quantity,
				unitCost: outbound ? null : input.unitCost,
			});

			// Sequence-allocated code (ERP-0009, hardening plan D4): allocated
			// inside this transaction, so a rollback releases the number (an
			// accepted gap) and concurrent posts get strictly distinct codes
			// without any retry loop. Global-warehouse movements share the
			// null-scope sequence, mirroring the balance scope rule.
			const code = await this.movementCode(handle, input.actorOrganizationId);
			const movement = await this.movementRepository.create(
				{
					organizationId: input.actorOrganizationId,
					code,
					movementType: input.movementType,
					productId: input.productId,
					warehouseId: input.warehouseId,
					binId: input.binId ?? null,
					targetWarehouseId: input.targetWarehouseId ?? null,
					quantity: input.quantity,
					unitCost: cost.unitCost,
					referenceType: input.referenceType ?? null,
					referenceId: input.referenceId ?? null,
					status: 'posted',
					occurredAt,
					createdBy: input.createdBy ?? null,
					notes: input.notes ?? null,
				},
				handle,
			);

			const balance = await this.balanceRepository.applyDelta(
				key,
				{
					quantity: outbound ? negate(input.quantity) : input.quantity,
					occurredAt,
				},
				handle,
			);
			await this.balanceRepository.setCost(key, cost, handle);

			return {
				movement,
				balance: { ...balance, averageCost: cost.averageCost, totalValue: cost.totalValue },
				scopeOrganizationId,
			};
		};

		return (tx ? run(tx) : this.database.transaction(run)).then(
			async (posted) => {
				// Per-operation ledger audit (hardening plan D3): one entry per
				// postMovement invocation, NOT per ledger row — the ledger itself
				// is the row-level trail. Fire-and-forget.
				await this.audit.record({
					actor: { userId: input.createdBy ?? 'system' },
					action: 'stock.posted',
					targetType: 'stock_movement',
					targetId: posted.movement.id,
					organizationId: input.actorOrganizationId,
					meta: {
						code: posted.movement.code,
						movementType: input.movementType,
						productId: input.productId,
						warehouseId: input.warehouseId,
						binId: input.binId ?? null,
						quantity: input.quantity,
						referenceType: input.referenceType ?? null,
						referenceId: input.referenceId ?? null,
					},
				});
				return posted;
			},
		);
	}

	/**
	 * Reverses a posted movement by appending an opposing row.
	 *
	 * @param movementId - The movement to reverse
	 * @param actorOrganizationId - Who is reversing it
	 * @param createdBy - The acting user id, if known
	 * @returns The reversal movement and the resulting balance
	 * @throws {MovementNotFoundError} When the movement is absent
	 * @throws {MovementAlreadyReversedError} When it was already reversed
	 */
	async reverseMovement(
		movementId: string,
		actorOrganizationId: string,
		createdBy?: string | null,
	): Promise<TPostedMovement> {
		const original = await this.movementRepository.findById(movementId);
		if (!original) throw new MovementNotFoundError();
		if (original.status !== 'posted') {
			throw new MovementAlreadyReversedError();
		}

		// Guard before claiming, so the common case gets a clear 409 rather
		// than relying on the status flip to be the only signal.
		const existing = await this.movementRepository.findReversalOf(movementId);
		if (existing) throw new MovementAlreadyReversedError();

		// Decide the direction BEFORE claiming. `claimForReversal` returns the
		// updated row, and a repository is free to hand back a live reference
		// whose fields it has just changed — reading `original` afterwards would
		// then describe the REVERSED row, not the movement being reversed.
		const originalOutbound = isOutbound(original.movementType);
		const occurredAt = new Date();
		const { scopeOrganizationId } = await this.resolveScope(
			original.warehouseId,
		);
		const key: TStockKey = {
			scopeOrganizationId,
			productId: original.productId,
			warehouseId: original.warehouseId,
			binId: original.binId,
		};

		// The reversal mirrors the original: reversing an issue is an increase,
		// reversing a receipt is a decrease. Deriving the type rather than
		// copying it keeps `isOutbound` honest for anything that reads the
		// reversal row later.
		const reversalType: MovementType = originalOutbound
			? 'adjustment_in'
			: 'adjustment_out';

		// Claim, guard, reversal row, and balance delta are ONE unit of work.
		// The claim lives inside the transaction on purpose: if the guard or the
		// balance write fails, the rollback returns the original to `posted`
		// automatically, so a refused reversal leaves no trace and stays
		// retryable. Claiming outside would need a compensating update.
		return this.database.transaction(async (tx) => {
			// Conditional update: of two concurrent reversals exactly one wins.
			const claimed = await this.movementRepository.claimForReversal(
				movementId,
				tx,
			);
			if (!claimed) throw new MovementAlreadyReversedError();

			// A reversal is a movement like any other, so it obeys the same rule:
			// it may not take the balance below zero. Reversing a receipt for
			// stock that has since been issued is NOT allowed — the correct
			// repair is to issue again or to adjust, not to invent negative
			// stock. Enforcement lives in `applyDelta` (row-locked conditional
			// update); the insufficient-stock error rolls this transaction back,
			// which also releases the reversal claim (see comment above). The
			// lock here reads the cost state the reversal restores.
			const locked = await this.balanceRepository.lockForCost(key, tx);

			// The reversal carries the original's cost, so the value it added
			// (or took) comes back out (or in) exactly.
			const cost = applyMovementCost(costState(locked), {
				outbound: !originalOutbound,
				quantity: original.quantity,
				unitCost: original.unitCost,
			});

			const reversal = await this.movementRepository.create(
				{
					organizationId: actorOrganizationId,
					code: await this.movementCode(tx, actorOrganizationId),
					movementType: reversalType,
					productId: original.productId,
					warehouseId: original.warehouseId,
					binId: original.binId,
					targetWarehouseId: null,
					quantity: original.quantity,
					unitCost: cost.unitCost,
					referenceType: 'reversal',
					referenceId: original.id,
					status: 'posted',
					occurredAt,
					createdBy: createdBy ?? null,
					notes: `Reversal of movement ${original.code}`,
				},
				tx,
			);

			const balance = await this.balanceRepository.applyDelta(
				key,
				{
					quantity: originalOutbound
						? original.quantity
						: negate(original.quantity),
					occurredAt,
				},
				tx,
			);
			await this.balanceRepository.setCost(key, cost, tx);

			return {
				movement: reversal,
				balance: { ...balance, averageCost: cost.averageCost, totalValue: cost.totalValue },
				scopeOrganizationId,
			};
		}).then(async (reversed) => {
			await this.audit.record({
				actor: { userId: createdBy ?? 'system' },
				action: 'stock.reversed',
				targetType: 'stock_movement',
				targetId: reversed.movement.id,
				organizationId: actorOrganizationId,
				meta: {
					code: reversed.movement.code,
					reversalOf: original.code,
					reversalOfId: original.id,
					movementType: reversalType,
					productId: original.productId,
					warehouseId: original.warehouseId,
					quantity: original.quantity,
				},
			});
			return reversed;
		});
	}

	/**
	 * Rebuilds balances from the ledger for one scope.
	 *
	 * @remarks
	 * The repair operation *and* the test oracle. Derived purely from
	 * `movements`, so it is idempotent: running it twice yields the same
	 * rows as running it once, and it overwrites rather than accumulating.
	 *
	 * A key whose ledger total is zero has its balance row removed, so a fully
	 * reversed pair leaves no empty balance behind.
	 *
	 * @param scopeOrganizationId - `null` rebuilds the shared/global scope
	 * @returns How many balance rows were written or removed
	 */
	async recomputeFromLedger(
		scopeOrganizationId: string | null,
	): Promise<{ written: number; removed: number }> {
		const totals = await this.movementRepository.ledgerTotals(
			scopeOrganizationId,
		);
		const existing = await this.balanceRepository.listByScope(
			scopeOrganizationId,
		);

		const byKey = new Map(
			totals.map((total) => [
				keyOf(total.productId, total.warehouseId, total.binId),
				total.quantity,
			]),
		);

		let written = 0;
		for (const total of totals) {
			const quantity = Number(total.quantity ?? '0');
			const key: TStockKey = {
				scopeOrganizationId,
				productId: total.productId,
				warehouseId: total.warehouseId,
				binId: total.binId,
			};
			if (quantity === 0) {
				if (await this.balanceRepository.remove(key)) written += 1;
				continue;
			}
			await this.balanceRepository.setQuantity(
				key,
				normalizeQuantity(quantity),
				null,
			);
			written += 1;
		}

		// Rows that exist but have no ledger entry at all are stale.
		let removed = 0;
		for (const row of existing) {
			if (byKey.has(keyOf(row.productId, row.warehouseId, row.binId))) continue;
			if (
				await this.balanceRepository.remove({
					scopeOrganizationId,
					productId: row.productId,
					warehouseId: row.warehouseId,
					binId: row.binId,
				})
			) {
				removed += 1;
			}
		}

		// Cost is path-dependent, so it is replayed in posting order rather than
		// summed (ADR-0011 §5).
		const costs = new Map<string, TCostState & { key: TStockKey }>();
		for (const row of await this.movementRepository.ledgerRows(scopeOrganizationId)) {
			const id = keyOf(row.productId, row.warehouseId, row.binId);
			const state = costs.get(id) ?? {
				key: { scopeOrganizationId, productId: row.productId, warehouseId: row.warehouseId, binId: row.binId },
				quantity: '0',
				averageCost: 0,
				totalValue: 0,
			};
			const outbound = isOutbound(row.movementType);
			const next = applyMovementCost(state, { outbound, quantity: row.quantity, unitCost: row.unitCost });
			const quantity = Number(state.quantity) + (outbound ? -1 : 1) * Number(row.quantity);
			costs.set(id, { ...state, ...next, quantity: normalizeQuantity(quantity) });
		}
		for (const [id, state] of costs) {
			if (Number(byKey.get(id) ?? '0') === 0) continue;
			await this.balanceRepository.setCost(state.key, state);
		}

		return { written, removed };
	}

	/**
	 * Allocates and formats the next movement code (ERP-0009).
	 *
	 * @remarks
	 * Must be called inside the movement's transaction so the allocation
	 * commits/rolls back with the document. `organizationId` may be `null`
	 * for global warehouses — those share one null-scope sequence, mirroring
	 * the balance scope rule.
	 */
	private async movementCode(
		tx: TTx,
		_organizationId: string | null,
	): Promise<string> {
		return this.numbering.next('stock_movement', tx);
	}
}

/** The cost state of a locked balance. */
function costState(locked: { quantityOnHand: string; averageCost: number; totalValue: number }): TCostState {
	return { quantity: locked.quantityOnHand, averageCost: locked.averageCost, totalValue: locked.totalValue };
}

/** Key for grouping ledger totals and balance rows. */
function keyOf(
	productId: string,
	warehouseId: string,
	binId: string | null,
): string {
	return `${productId}::${warehouseId}::${binId ?? ''}`;
}

/** Negates a positive decimal string without touching precision. */
function negate(quantity: string): string {
	return quantity.startsWith('-') ? quantity.slice(1) : `-${quantity}`;
}

/** Formats a number back to the column's `numeric(18,3)` scale. */
function normalizeQuantity(quantity: number): string {
	return quantity.toFixed(3);
}

/**
 * Mints a movement code via the ERP-0009 numbering service.
 *
 * @remarks
 * Format `MV-<YYYYMMDDHHMMSS>-<#6>` — the serial part is sequence-allocated
 * per `(organization, doc_type)` inside the caller's transaction, so codes
 * are unique without a retry loop (hardening plan D4). Kept as a service
 * method (not a free function) because allocation needs the numbering
 * service and the transaction handle.
 */

