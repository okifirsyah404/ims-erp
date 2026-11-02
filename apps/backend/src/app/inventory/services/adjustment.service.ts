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
import type { IItemRepository } from '../contracts/item.repository.interface';
import {
	ADJUSTMENT_REPOSITORY_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	STOCK_SERVICE_TOKEN,
} from '../constants/di';
import type { StockService } from './stock.service';
import {
	AdjustmentCodeTakenError,
	AdjustmentHasNoLinesError,
	AdjustmentNotFoundError,
	AdjustmentTransitionError,
	ItemNotFoundError,
	SelfApprovalForbiddenError,
} from './inventory.errors';

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
 *    are equal writes **no** movement: `stock_movements_quantity_check` forbids
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
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly itemRepository: IItemRepository,
		@inject(STOCK_SERVICE_TOKEN)
		private readonly stockService: StockService,
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
	 * @throws {WarehouseNotFoundError} When the warehouse is absent
	 * @throws {AdjustmentHasNoLinesError} When no lines are supplied
	 * @throws {ItemNotFoundError} When a line references an unknown item
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

		const code = await this.allocateCode(organizationId);
		const now = new Date();

		return this.database.transaction(async (tx) => {
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
					adjustment.warehouseId,
					data.lines,
				),
				tx,
			);

			return { adjustment, lines };
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
				adjustment.warehouseId,
				inputs,
			),
		);
		return { adjustment, lines };
	}

	/** Moves `draft → submitted`. */
	async submit(
		id: string,
		organizationId: string,
	): Promise<TStockAdjustmentSelect> {
		return this.transition(id, organizationId, 'submitted', {});
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
			approvedBy: actor.actorUserId,
			approvedAt: new Date(),
		});
	}

	/** Moves `submitted → rejected`. */
	async reject(
		id: string,
		organizationId: string,
	): Promise<TStockAdjustmentSelect> {
		return this.transition(id, organizationId, 'rejected', {});
	}

	/** Moves `draft|submitted → cancelled`. */
	async cancel(
		id: string,
		organizationId: string,
	): Promise<TStockAdjustmentSelect> {
		return this.transition(id, organizationId, 'cancelled', {});
	}

	/**
	 * Moves `approved → posted`, writing one movement per changed line.
	 *
	 * @remarks
	 * Idempotent: a document already carrying `posted_at` is returned untouched,
	 * so a retried request cannot post its movements twice.
	 *
	 * Each line's movement and balance delta are written by
	 * {@link StockService.postMovement}, which owns its own transaction. The
	 * status flip happens **last**, so a failure anywhere leaves the document
	 * `approved` and re-postable rather than half-posted.
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
			adjustment.warehouseId,
		);

		for (const line of lines) {
			// The live balance, not the stored snapshot: the snapshot is what the
			// counter saw, but the movement must reflect reality now.
			const current = await this.stockService.balanceFor(
				scopeOrganizationId,
				adjustment.warehouseId,
				line.itemId,
				line.binId,
			);

			const before = Number(current?.quantityOnHand ?? '0');
			const after = Number(line.quantityAfter);
			const delta = after - before;
			if (delta === 0) continue;

			const movementType: MovementType =
				delta > 0 ? 'adjustment_in' : 'adjustment_out';

			await this.stockService.postMovement({
				// The acting tenant is recorded on the ledger even when the
				// warehouse is global and the balance is shared.
				actorOrganizationId: organizationId,
				warehouseId: adjustment.warehouseId,
				binId: line.binId,
				itemId: line.itemId,
				movementType,
				// postMovement takes an unsigned quantity; direction is the type.
				quantity: Math.abs(delta).toFixed(3),
				referenceType: 'manual_adjustment',
				referenceId: adjustment.id,
				createdBy: actor.actorUserId,
				notes: line.note ?? adjustment.notes ?? null,
			});
		}

		// Flip status only after every movement is committed.
		const posted = await this.adjustmentRepository.update(id, {
			status: 'posted',
			postedAt: new Date(),
		});
		if (!posted) throw new AdjustmentNotFoundError();

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
	 * @throws {ItemNotFoundError} When an item is unknown or the client sent
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
			const key = `${input.itemId}::${input.binId ?? ''}`;
			if (seen.has(key)) {
				// Two lines for one item/bin would make the posted total depend on
				// iteration order; refuse rather than silently collapse them.
				throw new AdjustmentTransitionError('duplicate line', key);
			}
			seen.add(key);

			const item = await this.itemRepository.findById(input.itemId);
			if (!item) throw new ItemNotFoundError();

			// Snapshot the system's current quantity. Not just for audit: showing
			// the counter what the system believed makes a recount reviewable.
			const current = await this.stockService.balanceFor(
				scopeOrganizationId,
				warehouseId,
				input.itemId,
				input.binId ?? null,
			);

			lines.push({
				organizationId,
				stockAdjustmentId: adjustmentId,
				itemId: input.itemId,
				binId: input.binId ?? null,
				quantityBefore: current?.quantityOnHand ?? '0',
				quantityAfter: input.quantityAfter,
				note: input.note ?? null,
			});
		}
		return lines;
	}

	/**
	 * Allocates the next document code for a tenant.
	 *
	 * @param organizationId - The raising tenant
	 * @throws {AdjustmentCodeTakenError} After too many collisions
	 * @remarks
	 * ERP-0009 (document numbering) does not exist yet, so the code is
	 * time-ordered plus a random suffix and retried on collision. Uniqueness is
	 * ultimately enforced by the `(organization_id, code)` index.
	 */
	private async allocateCode(organizationId: string): Promise<string> {
		for (let attempt = 0; attempt < 5; attempt += 1) {
			const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
			const random = Math.random().toString(36).slice(2, 6).toUpperCase();
			const code = `ADJ-${stamp}-${random}`;
			const existing = await this.adjustmentRepository.findByCode(
				organizationId,
				code,
			);
			if (!existing) return code;
		}
		throw new AdjustmentCodeTakenError();
	}
}
