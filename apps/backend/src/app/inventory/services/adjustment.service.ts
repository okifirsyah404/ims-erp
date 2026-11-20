import { inject, injectable } from 'tsyringe';
import { DRIZZLE_TOKEN } from '@di/provider';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	AdjustmentStatus,
	MovementType,
	TStockAdjustmentItemSelect,
	TStockAdjustmentSelect,
} from '@drizzle/schemas/inventory.schema';
import type {
	IAdjustmentRepository,
	TAdjustmentLineInput,
	TAdjustmentPaginationRequest,
} from '../contracts/adjustment.repository.interface';
import {
	ADJUSTMENT_REPOSITORY_TOKEN,
	STOCK_SERVICE_TOKEN,
} from '../constants/di';
import type { StockService } from './stock.service';
import type { TTx } from '@drizzle/types';
import { INVENTORY_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { InventoryNumberingService } from './inventory-numbering.service';
import {
	AdjustmentHasNoLinesError,
	AdjustmentNotFoundError,
	AdjustmentTransitionError,
	InventoryReferenceError,
	SelfApprovalForbiddenError,
} from '../errors/inventory.errors';
import { AuditWriter, SYSTEM_AUDIT_ACTOR, type TAuditActor } from '@shared/audit';
import { EXPORTED_PRODUCT_SERVICE_TOKEN } from '@app/product/constants/di';
import type { ExportedProductService } from '@app/product/services/exported-product.service';

/**
 * Adapts the route-layer {@link TAdjustmentActor} (permission flags, no
 * request context) to the audit actor shape. The controller supplies
 * email/ip/user-agent via {@link TAuditActor} on methods that take
 * one directly; transitions only need the user id.
 */
function actorAuditActor(actor: TAdjustmentActor): TAuditActor {
	return { userId: actor.actorUserId ?? 'system' };
}

/**
 * Legal status edges for an adjustment document.
 *
 * @remarks
 * Two terminal branches: `rejected` and `cancelled` go nowhere, and `posted` is
 * final because the movements it wrote are immutable. Declaring the machine as
 * data rather than a chain of `if`s means an illegal edge is impossible to
 * forget to forbid — see {@link AdjustmentService.transition}.
 */
const ADJUSTMENT_TRANSITIONS: Record<
	AdjustmentStatus,
	readonly AdjustmentStatus[]
> = {
	draft: ['submitted', 'cancelled'],
	submitted: ['approved', 'rejected', 'cancelled'],
	approved: ['posted'],
	rejected: [],
	posted: [],
	cancelled: [],
};

/**
 * Whether a transition is legal.
 *
 * @param from - Current status
 * @param to - Requested status
 * @remarks
 * The status column is `text` in the schema, so the value arrives as a plain
 * `string` and is narrowed with a membership test rather than cast — an
 * unrecognised status therefore falls through to "illegal edge" instead of
 * throwing a `TypeError` on an undefined lookup.
 */
function isLegalTransition(from: string, to: AdjustmentStatus): boolean {
	if (!(from in ADJUSTMENT_TRANSITIONS)) return false;
	return ADJUSTMENT_TRANSITIONS[from as AdjustmentStatus].includes(to);
}

/**
 * Performs one status change on an adjustment.
 *
 * @remarks
 * `approve` and `post` carry the extra facts the document must record to stay
 * attributable; the rest only move the status.
 */


/**
 * Actor context for a transition.
 *
 * @remarks
 * `actorUserId` is the person acting. `canSelfApprove` is derived at the route
 * layer from the session's effective permissions — the service does not read
 * the session, so it stays testable and free of transport concerns.
 */
export type TAdjustmentActor = {
	/** The acting user id, recorded on approve/post. */
	actorUserId: string | null;
	/**
	 * Whether the actor holds `stock_adjustment:approve`.
	 *
	 * @remarks
	 * This is the documented bypass for the self-approval rule: holding the
	 * permission means the approval step is not a separate person's control
	 * for that user.
	 */
	canSelfApprove: boolean;
};

/** A document plus its lines. */
export type TAdjustmentDetail = {
	adjustment: TStockAdjustmentSelect;
	lines: TStockAdjustmentItemSelect[];
};

/**
 * Stock adjustment application service.
 *
 * @remarks
 * An adjustment is a **document with an approval chain**, not a bare movement:
 * `draft → submitted → approved|rejected → posted|cancelled`. Only `posted`
 * writes ledger rows, and it writes them **once** — `posted_at IS NOT NULL` is
 * the idempotency guard, so a retried POST cannot double-count.
 *
 * Three rules are enforced here because no single table can express them:
 *
 * 1. **Legal edges only.** {@link ADJUSTMENT_TRANSITIONS} is the machine; any
 *    other edge is a 422.
 * 2. **No self-approval** unless the actor holds `stock_adjustment:approve`.
 * 3. **A line stores counted totals, not deltas.** `quantity_after` comes from
 *    the client, `quantity_before` is snapshotted from the live balance, and the
 *    movement direction is derived from their difference. A line where the two
 *    are equal writes **no** movement: `movements_quantity_check` forbids
 *    `quantity = 0`, and "the count agreed with the system" is not a movement.
 *
 * Posting takes the balance scope from the **warehouse** (via
 * {@link StockService.resolveScope}), so an adjustment raised by a tenant
 * against a global warehouse moves the shared balance — the tenant still owns
 * the document, but the stock is shared.
 */
@injectable()
export class AdjustmentService {
	constructor(
		@inject(ADJUSTMENT_REPOSITORY_TOKEN)
		private readonly adjustmentRepository: IAdjustmentRepository,
		/** Product validation, read through the `product` module (ADR-0026). */
		@inject(EXPORTED_PRODUCT_SERVICE_TOKEN)
		private readonly products: Pick<ExportedProductService, 'assertProduct'>,
		@inject(STOCK_SERVICE_TOKEN)
		private readonly stockService: StockService,
		/**
		 * ERP-0009 numbering authority: adjustment codes are sequence-allocated
		 * inside the creating transaction (hardening plan D4).
		 */
		@inject(INVENTORY_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<InventoryNumberingService, 'next'>,
		/** Fire-and-forget audit writer (hardening plan D3). */
		private readonly audit: AuditWriter,
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/** Fetches one page of adjustment documents. */
	paginate(
		request: TAdjustmentPaginationRequest,
	): Promise<TPaginationResult<TStockAdjustmentSelect>> {
		return this.adjustmentRepository.paginate(request);
	}

	/**
	 * Fetches one document with its lines.
	 *
	 * @param id - The document id
	 * @param organizationId - Tenant the caller may see, or `undefined` for an
	 *   application admin
	 * @throws {AdjustmentNotFoundError} When absent, archived, or out of scope
	 */
	async findDetail(
		id: string,
		organizationId: string | undefined,
	): Promise<TAdjustmentDetail> {
		const adjustment = await this.requireDocument(id, organizationId);
		const lines = await this.adjustmentRepository.listLines(id);
		return { adjustment, lines };
	}

	/**
	 * Raises a new adjustment in `draft`.
	 *
	 * @param organizationId - The tenant raising it (never null)
	 * @param data - Header fields plus the requested lines
	 * @param actor - Who is raising it
	 * @throws {InventoryReferenceError} When the warehouse is absent
	 * @throws {AdjustmentHasNoLinesError} When no lines are supplied
	 * @throws {InventoryReferenceError} When a line references an unknown product
	 */
	async create(
		organizationId: string,
		data: {
			warehouseId: string;
			adjustmentType: TStockAdjustmentSelect['adjustmentType'];
			reasonCode?: string | null;
			notes?: string | null;
			lines: readonly TAdjustmentLineInput[];
		},
		actor: TAdjustmentActor,
	): Promise<TAdjustmentDetail> {
		if (data.lines.length === 0) throw new AdjustmentHasNoLinesError();
		// Validates the warehouse exists and is alive before anything is written.
		await this.stockService.resolveScope(data.warehouseId);

		const now = new Date();

		return this.database.transaction(async (tx) => {
			// Sequence-allocated code (ERP-0009, hardening plan D4) — inside the
			// transaction, so a rollback releases the number (accepted gap) and
			// concurrent creates get strictly distinct codes with no retry loop.
			// Replaces the former time-stamp + random-suffix + collision-retry
			// scheme.
			const code = await this.adjustmentCode(tx, organizationId);
			const adjustment = await this.adjustmentRepository.create(
				{
					organizationId,
					code,
					warehouseId: data.warehouseId,
					adjustmentType: data.adjustmentType,
					status: 'draft',
					reasonCode: data.reasonCode ?? null,
					notes: data.notes ?? null,
					requestedBy: actor.actorUserId,
					requestedAt: now,
					createdAt: now,
				},
				tx,
			);

			const lines = await this.adjustmentRepository.createLines(
				await this.buildLines(
					organizationId,
					adjustment.id,
					requireId(adjustment.warehouseId, 'warehouse'),
					data.lines,
				),
				tx,
			);

			return { adjustment, lines };
		}).then(async (detail) => {
			await this.audit.record({
				actor: actorAuditActor(actor),
				action: 'stock_adjustment.created',
				targetType: 'stock_adjustment',
				targetId: detail.adjustment.id,
				organizationId,
				meta: {
					code: detail.adjustment.code,
					adjustmentType: detail.adjustment.adjustmentType,
					lineCount: detail.lines.length,
				},
			});
			return detail;
		});
	}

	/**
	 * Replaces the lines of a `draft` adjustment.
	 *
	 * @param id - The document id
	 * @param organizationId - Tenant scope
	 * @param inputs - The new line set
	 * @throws {AdjustmentTransitionError} When the document is not a draft
	 */
	async setLines(
		id: string,
		organizationId: string,
		inputs: readonly TAdjustmentLineInput[],
	): Promise<TAdjustmentDetail> {
		if (inputs.length === 0) throw new AdjustmentHasNoLinesError();
		const adjustment = await this.requireDocument(id, organizationId);
		if (adjustment.status !== 'draft') {
			throw new AdjustmentTransitionError(adjustment.status, 'draft');
		}
		const lines = await this.adjustmentRepository.replaceLines(
			id,
			await this.buildLines(
				organizationId,
				id,
				requireId(adjustment.warehouseId, 'warehouse'),
				inputs,
			),
		);
		return { adjustment, lines };
	}

	/** Moves `draft → submitted`. */
	async submit(
		id: string,
		organizationId: string,
		actor: TAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TStockAdjustmentSelect> {
		return this.transition(id, organizationId, 'submitted', {}, actor);
	}

	/**
	 * Moves `submitted → approved`, refusing self-approval.
	 *
	 * @param id - The document id
	 * @param organizationId - Tenant scope
	 * @param actor - Who is approving; must differ from the requester
	 * @throws {SelfApprovalForbiddenError} When the approver raised it and does
	 *   not hold the self-approval permission
	 */
	async approve(
		id: string,
		organizationId: string,
		actor: TAdjustmentActor,
	): Promise<TStockAdjustmentSelect> {
		const adjustment = await this.requireDocument(id, organizationId);
		// Checked before the transition so the refusal is a specific 403 rather
		// than a generic transition error.
		if (
			!actor.canSelfApprove &&
			adjustment.requestedBy !== null &&
			adjustment.requestedBy === actor.actorUserId
		) {
			throw new SelfApprovalForbiddenError();
		}
		return this.transition(id, organizationId, 'approved', {
			approvedBy: actorAuditActor(actor).userId,
			approvedAt: new Date(),
		}, actorAuditActor(actor));
	}

	/** Moves `submitted → rejected`. */
	async reject(
		id: string,
		organizationId: string,
		actor: TAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TStockAdjustmentSelect> {
		return this.transition(id, organizationId, 'rejected', {}, actor);
	}

	/** Moves `draft|submitted → cancelled`. */
	async cancel(
		id: string,
		organizationId: string,
		actor: TAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TStockAdjustmentSelect> {
		return this.transition(id, organizationId, 'cancelled', {}, actor);
	}

	/**
	 * Moves `approved → posted`, writing one movement per changed line.
	 *
	 * @remarks
	 * Idempotent: a document already carrying `posted_at` is returned untouched,
	 * so a retried request cannot post its movements twice.
	 *
	 * Each line's movement and balance delta are written by
	 * {@link StockService.postMovement}, joining the posting transaction. The
	 * status flip happens FIRST inside the transaction as an atomic
	 * conditional claim: of two concurrent posts exactly one wins, and a
	 * failure on any line rolls back the claim along with every movement, so
	 * a half-posted document is impossible.
	 *
	 * A line whose `quantity_after` equals the live `quantity_before` writes
	 * nothing — a recount that agrees is a valid outcome, and the document still
	 * reaches `posted`.
	 *
	 * @param id - The document id
	 * @param organizationId - Tenant scope
	 * @param actor - Who is posting
	 * @throws {AdjustmentTransitionError} When not `approved`
	 */
	async post(
		id: string,
		organizationId: string,
		actor: TAdjustmentActor,
	): Promise<TAdjustmentDetail> {
		const adjustment = await this.requireDocument(id, organizationId);
		if (adjustment.status === 'posted') {
			return {
				adjustment,
				lines: await this.adjustmentRepository.listLines(id),
			};
		}
		if (!isLegalTransition(adjustment.status, 'posted')) {
			throw new AdjustmentTransitionError(adjustment.status, 'posted');
		}

		const lines = await this.adjustmentRepository.listLines(id);
		if (lines.length === 0) throw new AdjustmentHasNoLinesError();

		const { scopeOrganizationId } = await this.stockService.resolveScope(
			requireId(adjustment.warehouseId, 'warehouse'),
		);

		// ONE transaction for the claim and every per-line movement (hardening
		// plan Phase I-4): a failed line rolls back all prior lines AND the
		// claim, so a partial posting of an approved adjustment is impossible.
		// The status flip happens FIRST inside the transaction as an atomic
		// conditional claim (`WHERE status = 'approved' AND posted_at IS
		// NULL`): of two concurrent posts exactly one wins; the loser fails
		// here rather than double-posting. A rollback of any movement returns
		// the document to `approved` and re-postable — no compensating update.
		const posted = await this.database.transaction(async (tx) => {
			const claimed = await this.adjustmentRepository.claimForPost(id, tx);
			if (!claimed) throw new AdjustmentTransitionError('approved', 'posted');

			for (const line of lines) {
				// The live balance, not the stored snapshot: the snapshot is what
				// the counter saw, but the movement must reflect reality now.
				const current = await this.stockService.balanceFor(
					scopeOrganizationId,
					requireId(adjustment.warehouseId, 'warehouse'),
					requireId(line.productId, 'product'),
					line.binId,
				);


				const before = Number(current?.quantityOnHand ?? '0');
				const after = Number(line.quantityAfter);
				const delta = after - before;

				// A recount that agrees with the system is not a movement:
				// `stock_movements_quantity_check` forbids `quantity = 0`, and
				// the document still reaches `posted`. Without this the agree-
				// path would either post a zero row (rejected by the schema
				// check) or double-count the balance.
				if (delta === 0) continue;

				const movementType: MovementType =
					delta > 0 ? 'adjustment_in' : 'adjustment_out';

				await this.stockService.postMovement(
					{
						// The acting tenant is recorded on the ledger even when the
						// warehouse is global and the balance is shared.
						actorOrganizationId: organizationId,
						warehouseId: requireId(adjustment.warehouseId, 'warehouse'),
						binId: line.binId,
						productId: requireId(line.productId, 'product'),
						movementType,
						// postMovement takes an unsigned quantity; direction is the type.
						quantity: Math.abs(delta).toFixed(3),
						// An increase enters at the line's cost (opening stock);
						// without one, and for every decrease, the moving average
						// applies.
						unitCost: delta > 0 ? line.unitCost : null,
						referenceType: 'manual_adjustment',
						referenceId: adjustment.id,
						createdBy: actor.actorUserId,
						notes: line.note ?? adjustment.notes ?? null,
					},
					tx,
				);
			}

			return claimed;
		});

		await this.audit.record({
			actor: actorAuditActor(actor),
			action: 'stock_adjustment.posted',
			targetType: 'stock_adjustment',
			targetId: id,
			organizationId,
			meta: {
				code: adjustment.code,
				movementsPosted: lines.length,
			},
		});

		return { adjustment: posted, lines };
	}

	/**
	 * Applies one status change, refusing any edge the machine forbids.
	 *
	 * @param id - The document id
	 * @param organizationId - Tenant scope
	 * @param to - Target status
	 * @param extra - Columns the transition must also record
	 */
	private async transition(
		id: string,
		organizationId: string,
		to: AdjustmentStatus,
		extra: Partial<TStockAdjustmentSelect>,
		actor: TAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TStockAdjustmentSelect> {
		const adjustment = await this.requireDocument(id, organizationId);
		if (!isLegalTransition(adjustment.status, to)) {
			throw new AdjustmentTransitionError(adjustment.status, to);
		}
		const updated = await this.adjustmentRepository.update(id, {
			status: to,
			...extra,
		});
		if (!updated) throw new AdjustmentNotFoundError();
		// Financial-control event (hardening plan D3): every workflow edge is
		// attributable. Fire-and-forget — an audit failure never fails the
		// transition.
		await this.audit.record({
			actor,
			action: `stock_adjustment.${to === 'cancelled' ? 'cancelled' : to}` as 'stock_adjustment.submitted',
			targetType: 'stock_adjustment',
			targetId: id,
			organizationId,
			meta: {
				code: adjustment.code,
				from: adjustment.status,
				to,
			},
		});
		return updated;
	}

	/**
	 * Loads a document and enforces tenant visibility.
	 *
	 * @param id - The document id
	 * @param organizationId - Required tenant, or `undefined` for an admin
	 * @throws {AdjustmentNotFoundError} When absent or out of scope
	 * @remarks
	 * An out-of-scope document is reported as **not found**, not forbidden: the
	 * caller has no business knowing a sibling tenant's document id exists.
	 */
	private async requireDocument(
		id: string,
		organizationId: string | undefined,
	): Promise<TStockAdjustmentSelect> {
		const adjustment = await this.adjustmentRepository.findById(id);
		if (!adjustment) throw new AdjustmentNotFoundError();
		if (
			organizationId !== undefined &&
			adjustment.organizationId !== organizationId
		) {
			throw new AdjustmentNotFoundError();
		}
		return adjustment;
	}

	/**
	 * Snapshots `quantity_before` onto each requested line.
	 *
	 * @param organizationId - The raising tenant
	 * @param adjustmentId - The header the lines belong to
	 * @param inputs - Lines as supplied by the client
	 * @throws {InventoryReferenceError} When a product is unknown or the client sent
	 *   the same item twice for one bin, which would make the result order
	 *   dependent
	 */
	private async buildLines(
		organizationId: string,
		adjustmentId: string,
		warehouseId: string,
		inputs: readonly TAdjustmentLineInput[],
	) {
		const { scopeOrganizationId } = await this.stockService.resolveScope(
			warehouseId,
		);
		const seen = new Set<string>();
		const lines = [];
		for (const input of inputs) {
			const key = `${input.productId}::${input.binId ?? ''}`;
			if (seen.has(key)) {
				// Two lines for one item/bin would make the posted total depend on
				// iteration order; refuse rather than silently collapse them.
				throw new AdjustmentTransitionError('duplicate line', key);
			}
			seen.add(key);

			// The product master lives in the `product` module: validate the id
			// before freezing the line (ADR-0014 / ADR-0026).
			await this.products.assertProduct(input.productId);

			// Snapshot the system's current quantity. Not just for audit: showing
			// the counter what the system believed makes a recount reviewable.
			const current = await this.stockService.balanceFor(
				scopeOrganizationId,
				warehouseId,
				input.productId,
				input.binId ?? null,
			);

			lines.push({
				organizationId,
				stockAdjustmentId: adjustmentId,
				productId: input.productId,
				binId: input.binId ?? null,
				quantityBefore: current?.quantityOnHand ?? '0',
				quantityAfter: input.quantityAfter,
				unitCost: input.unitCost ?? null,
				note: input.note ?? null,
			});
		}
		return lines;
	}

	/**
	 * Allocates and formats the next adjustment code (ERP-0009).
	 *
	 * @remarks
	 * Series `stock_adjustment` of the one numbering service (company-wide,
	 * pattern set under document numbering), allocated inside the caller's
	 * transaction.
	 * Uniqueness follows from the sequence — no collision retry needed.
	 * Must be called inside the document's transaction.
	 */
	private async adjustmentCode(
		tx: TTx,
		_organizationId: string,
	): Promise<string> {
		return this.numbering.next('stock_adjustment', tx);
	}
}
/**
 * Narrows a nullable logical id to a string.
 *
 * @remarks
 * `warehouse_id` and `product_id` are nullable plain columns since ADR-0026
 * (cross-module references are always nullable, ADR-0014). A posted adjustment
 * always carries both, so a NULL here means a corrupted row: fail loudly rather
 * than posting a movement against a missing reference.
 *
 * @throws {InventoryReferenceError} When the column is NULL
 */
function requireId(
	value: string | null,
	reference: 'product' | 'warehouse',
): string {
	if (!value) throw new InventoryReferenceError(reference);
	return value;
}
