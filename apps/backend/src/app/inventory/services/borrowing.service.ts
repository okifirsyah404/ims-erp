import { inject, injectable } from 'tsyringe';
import { DRIZZLE_TOKEN } from '@di/provider';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { TTx } from '@drizzle/types';
import type {
	BorrowingStatus,
	TBorrowingInsert,
	TBorrowingLineSelect,
	TBorrowingSelect,
	TSerialTrackedItemSelect,
} from '@drizzle/schemas/inventory.schema';
import type {
	IBorrowingRepository,
	TBorrowingLineInput,
	TBorrowingPaginationRequest,
} from '../contracts/borrowing.repository.interface';
import type { ISerialUnitRepository } from '../contracts/serial-unit.repository.interface';
import {
	BORROWING_REPOSITORY_TOKEN,
	SERIAL_UNIT_REPOSITORY_TOKEN,
	STOCK_SERVICE_TOKEN,
} from '../constants/di';
import type { StockService } from './stock.service';
import type { DocumentNumberingService } from '@app/organization/services/document-numbering.service';
import { DOCUMENT_NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import {
	BorrowerIdentityError,
	BorrowingHasNoLinesError,
	BorrowingLineNotFoundError,
	BorrowingNotFoundError,
	BorrowingSelfApprovalForbiddenError,
	BorrowingTransitionError,
	GuestIdentityIncompleteError,
	UnitNotAvailableError,
	UnitNotOnBorrowingError,
} from '../errors/inventory.errors';

/**
 * Legal status edges for a borrowing (D19).
 *
 * @remarks
 * Declared as data, not an `if` chain, so an illegal edge cannot be forgotten —
 * the same reasoning as `ADJUSTMENT_TRANSITIONS`. Notable shape:
 * - `requested → issued` is legal **only** for a caller holding
 *   `borrowing:issue`; the skippable approval is a permission rule applied in
 *   the service, not a separate edge.
 * - `issued → partially_returned → returned` is the per-line return path.
 * - `rejected` and `cancelled` are terminal; `closed` follows `returned`.
 */
const BORROWING_TRANSITIONS: Record<BorrowingStatus, readonly BorrowingStatus[]> =
	{
		draft: ['requested', 'cancelled'],
		requested: ['approved', 'rejected', 'issued', 'cancelled'],
		approved: ['issued', 'cancelled'],
		rejected: [],
		issued: ['partially_returned', 'returned', 'cancelled'],
		partially_returned: ['returned'],
		returned: ['closed'],
		closed: [],
		cancelled: [],
	};

/** Whether a status edge is legal. Unknown statuses are never legal. */
export function isLegalBorrowingTransition(
	from: string,
	to: BorrowingStatus,
): boolean {
	if (!(from in BORROWING_TRANSITIONS)) return false;
	return BORROWING_TRANSITIONS[from as BorrowingStatus].includes(to);
}

/** Who is acting, and what they may bypass. */
export type TBorrowingActor = {
	actorUserId: string;
	/** Holding `borrowing:approve` — may approve without a second person. */
	canApprove: boolean;
	/** Holding `borrowing:issue` — may skip approval entirely. */
	canIssue: boolean;
	/** Holding `borrowing:mark_lost` (or app admin) — sees guest PII. */
	canSeeGuestPii: boolean;
};

/** Input for raising a borrowing. */
export type TBorrowingCreateInput = {
	branch: 'user' | 'customer' | 'guest';
	purpose: 'rental' | 'internal_use' | 'testing' | 'warranty_service';
	dueAt: Date;
	borrowerUserId?: string | null;
	borrowerCustomerId?: string | null;
	guestName?: string | null;
	guestPhone?: string | null;
	guestIdType?: 'ktp' | 'sim' | 'passport' | 'other' | null;
	guestIdNumber?: string | null;
	guestAddressText?: string | null;
	guestIdDocumentRef?: string | null;
	notes?: string | null;
	lines: TBorrowingLineInput[];
};

/** A borrowing as returned to a client, with the PII projection applied. */
export type TBorrowingView = TBorrowingSelect & {
	lines: TBorrowingLineSelect[];
	events: {
		id: string;
		borrowingLineId: string | null;
		eventType: string;
		stockMovementId: string | null;
		actorUserId: string | null;
		occurredAt: Date;
		note: string | null;
	}[];
	/** `true` when guest identity fields were withheld from this caller. */
	guestIdentityRedacted: boolean;
};

/** Result of one sweep pass. */
export type TSweepResult = {
	/** Lines marked late, or borrowings whose PII was nulled. */
	processed: number;
	/** Rows examined but skipped because another pass won. */
	skipped: number;
};

/**
 * Borrowing lifecycle service (S4).
 *
 * @remarks
 * **One issue/return engine.** "Tested" is a borrowing with `purpose =
 * 'testing'`, not a parallel flow (D8).
 *
 * **Every physical transition is one transaction** containing, atomically:
 * 1. the unit's custody change,
 * 2. the `stock_movements` row,
 * 3. the balance delta,
 * 4. the append-only timeline event that references the movement.
 *
 * That is why {@link StockService.postMovement} accepts an outer transaction:
 * a movement committed outside the unit change would leave the ledger claiming
 * stock the warehouse still shows.
 *
 * **Guest PII never leaves this service unredacted** unless the caller holds
 * the tier required in §6.
 */
@injectable()
export class BorrowingService {
	constructor(
		@inject(BORROWING_REPOSITORY_TOKEN)
		private readonly borrowingRepository: IBorrowingRepository,
		@inject(SERIAL_UNIT_REPOSITORY_TOKEN)
		private readonly serialUnitRepository: ISerialUnitRepository,
		@inject(STOCK_SERVICE_TOKEN)
		private readonly stockService: StockService,
		/**
		 * ERP-0009 numbering authority: borrowing codes are sequence-allocated
		 * inside the creating transaction (hardening plan D4).
		 */
		@inject(DOCUMENT_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: DocumentNumberingService,
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/** Fetches one page of borrowings for a tenant. */
	paginate(
		request: TBorrowingPaginationRequest,
	): ReturnType<IBorrowingRepository['paginate']> {
		return this.borrowingRepository.paginate(request);
	}

	/**
	 * Reads one borrowing with its lines and timeline.
	 *
	 * @param actor - Resolves the guest-PII tier and the redaction flag
	 * @throws {BorrowingNotFoundError} When absent or in another tenant
	 */
	async getById(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
	): Promise<TBorrowingView> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		const [lines, events] = await Promise.all([
			this.borrowingRepository.listLines(id),
			this.borrowingRepository.listEvents(id),
		]);
		return this.project(borrowing, lines, events, actor);
	}

	/**
	 * Raises a borrowing (`draft` or `requested`).
	 *
	 * @param status - `requested` normally; `draft` when the caller is still
	 *   assembling it
	 * @remarks
	 * Lines are **not** issued here, so no unit custody changes and no movement
	 * is written. Availability is still checked so the user learns immediately
	 * that a unit is unavailable, and again at issue time under guard.
	 */
	async create(
		input: TBorrowingCreateInput,
		organizationId: string,
		actor: TBorrowingActor,
		status: 'draft' | 'requested' = 'requested',
	): Promise<TBorrowingView> {
		if (input.lines.length === 0) throw new BorrowingHasNoLinesError();
		const identity = this.resolveIdentity(input);
		// Resolves each unit once: confirms availability AND captures the origin
		// warehouse, which is NOT NULL on the line. The unit's location at
		// creation is the best known origin; issue re-snapshots it in case the
		// unit moved in the meantime.
		const resolved = await this.resolveLines(input.lines);

		const now = new Date();

		const borrowing = await this.database.transaction(async (tx) => {
			// Sequence-allocated code (ERP-0009, hardening plan D4) — inside the
			// transaction, so a rollback releases the number (accepted gap) and
			// concurrent creates get strictly distinct codes with no retry
			// loop. Replaces the former random-suffix + collision-retry scheme.
			const code = await this.borrowingCode(tx, organizationId);
			const header = await this.borrowingRepository.create(
				{
					organizationId,
					code,
					status,
					purpose: input.purpose,
					borrowerType: input.branch,
					...identity,
					requestedBy: actor.actorUserId,
					requestedAt: status === 'requested' ? now : null,
					dueAt: input.dueAt,
					notes: input.notes ?? null,
					createdAt: now,
					guestIdType: identity.guestIdType,
					guestIdNumber: identity.guestIdNumber,
					guestAddressText: identity.guestAddressText,
					guestIdDocumentRef: identity.guestIdDocumentRef,
					guestName: identity.guestName,
					guestPhone: identity.guestPhone,
					borrowerUserId: identity.borrowerUserId,
					borrowerCustomerId: identity.borrowerCustomerId,
				},
				tx,
			);
			await this.borrowingRepository.createLines(
				resolved.map(({ line, unit }) => ({
					borrowingId: header.id,
					serialTrackedItemId: line.serialTrackedItemId,
					originWarehouseId: unit.warehouseId as string,
					dueAt: line.dueAt ?? input.dueAt,
					issuedAt: null,
					returnedAt: null,
					returnedCondition: null,
					markedLateAt: null,
					markedLostAt: null,
					lostReportedBy: null,
					siteAddressText: line.siteAddressText ?? null,
					projectId: line.projectId ?? null,
					notes: line.notes ?? null,
					createdAt: now,
				})),
				tx,
			);
			if (status === 'requested') {
				await this.borrowingRepository.appendEvent(
					{
						borrowingId: header.id,
						borrowingLineId: null,
						eventType: 'requested',
						stockMovementId: null,
						actorUserId: actor.actorUserId,
						occurredAt: now,
						note: null,
					},
					tx,
				);
			}
			return header;
		});

		return this.getById(borrowing.id, organizationId, actor);
	}

	/**
	 * Moves `draft → requested` and records the `requested` event.
	 *
	 * @throws {BorrowingTransitionError} When the edge is illegal
	 */
	async submit(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
	): Promise<TBorrowingView> {
		await this.transitionHeader(id, organizationId, 'requested', {
			requestedBy: actor.actorUserId,
			requestedAt: new Date(),
		});
		await this.appendEvent(id, 'requested', null, actor.actorUserId);
		return this.getById(id, organizationId, actor);
	}

	/**
	 * Moves `requested → approved`.
	 *
	 * @throws {BorrowingSelfApprovalForbiddenError} When the approver raised it
	 *   and does not hold the approval bypass
	 */
	async approve(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
	): Promise<TBorrowingView> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		// Checked before the edge so the refusal is a specific 403 rather than a
		// generic transition error — mirrors the adjustment workflow.
		if (
			!actor.canApprove &&
			borrowing.requestedBy !== null &&
			borrowing.requestedBy === actor.actorUserId
		) {
			throw new BorrowingSelfApprovalForbiddenError();
		}
		await this.transitionHeader(id, organizationId, 'approved', {
			approvedBy: actor.actorUserId,
			approvedAt: new Date(),
		});
		await this.appendEvent(id, 'approved', null, actor.actorUserId);
		return this.getById(id, organizationId, actor);
	}

	/** Moves `requested → rejected`. */
	async reject(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
	): Promise<TBorrowingView> {
		await this.transitionHeader(id, organizationId, 'rejected', {});
		await this.appendEvent(id, 'rejected', null, actor.actorUserId);
		return this.getById(id, organizationId, actor);
	}

	/**
	 * Issues every open line, moving custody out of the warehouse.
	 *
	 * @remarks
	 * Legal from `requested` only when the caller holds `borrowing:issue`
	 * (skippable approval, §7); otherwise from `approved`.
	 *
	 * Per line, inside **one** transaction: the unit's custody, a
	 * `borrowing_out` movement, the balance delta and an `issued` event that
	 * references the movement.
	 *
	 * @throws {BorrowingTransitionError} When approval was skipped without the
	 *   permission that allows it
	 * @throws {UnitNotAvailableError} When a unit is no longer `in_stock`
	 */
	async issue(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
	): Promise<TBorrowingView> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		if (
			borrowing.status === 'requested' &&
			!actor.canIssue &&
			!actor.canApprove
		) {
			// Approval is skippable, not optional: skipping it is a privilege
			// (`borrowing:issue` or `borrowing:approve`), never a default.
			throw new BorrowingTransitionError(borrowing.status, 'issued');
		}
		if (!isLegalBorrowingTransition(borrowing.status, 'issued')) {
			throw new BorrowingTransitionError(borrowing.status, 'issued');
		}

		const lines = await this.borrowingRepository.listLines(id);
		const open = lines.filter((line) => line.issuedAt === null);
		if (open.length === 0) throw new BorrowingHasNoLinesError();

		const now = new Date();
		await this.database.transaction(async (tx) => {
			for (const line of open) {
				await this.issueLine(borrowing, line, actor, now, tx);
			}
			const issued = await this.borrowingRepository.update(
				id,
				{
					status: 'issued',
					issuedBy: actor.actorUserId,
					issuedAt: now,
				},
				borrowing.status as BorrowingStatus,
				tx,
			);
			if (!issued) {
				throw new BorrowingTransitionError(borrowing.status, 'issued');
			}
		});

		return this.getById(id, organizationId, actor);
	}

	/**
	 * Returns one or all lines to their origin warehouse.
	 *
	 * @param lineId - A single line, or omitted for every open line
	 * @param condition - Required per line; recorded on the line
	 * @remarks
	 * Partial returns move the header to `partially_returned`; returning the
	 * last open line moves it to `returned`.
	 */
	async returnLines(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
		options: {
			lineId?: string;
			condition: 'good' | 'damaged' | 'incomplete';
			note?: string | null;
		},
	): Promise<TBorrowingView> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		if (
			!isLegalBorrowingTransition(borrowing.status, 'returned') &&
			!isLegalBorrowingTransition(borrowing.status, 'partially_returned')
		) {
			throw new BorrowingTransitionError(borrowing.status, 'returned');
		}

		const lines = await this.borrowingRepository.listLines(id);
		const open = lines.filter((line) => line.issuedAt !== null && line.returnedAt === null && line.markedLostAt === null);
		const targets = options.lineId
			? open.filter((line) => line.id === options.lineId)
			: open;
		if (options.lineId && targets.length === 0) {
			const known = lines.some((line) => line.id === options.lineId);
			throw known ? new UnitNotOnBorrowingError() : new BorrowingLineNotFoundError();
		}

		const now = new Date();
		await this.database.transaction(async (tx) => {
			for (const line of targets) {
				await this.returnLine(
					borrowing,
					line,
					actor,
					options.condition,
					options.note ?? null,
					now,
					tx,
				);
			}
			const remaining = open.length - targets.length;
			const nextStatus: BorrowingStatus =
				remaining > 0 ? 'partially_returned' : 'returned';
			const updated = await this.borrowingRepository.update(
				id,
				nextStatus === 'returned'
					? { status: nextStatus, closedBy: actor.actorUserId, closedAt: now }
					: { status: nextStatus },
				borrowing.status as BorrowingStatus,
				tx,
			);
			if (!updated) {
				throw new BorrowingTransitionError(borrowing.status, nextStatus);
			}
		});

		return this.getById(id, organizationId, actor);
	}

	/**
	 * Reports a line as lost and writes the stock reduction.
	 *
	 * @remarks
	 * The loss reduces stock by 1 at the warehouse the unit **left from**,
	 * captured on the line at issue time (`origin_warehouse_id`) — the unit
	 * itself has no warehouse while out. The unit is not restored anywhere.
	 */
	async markLost(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
		options: { lineId: string; note?: string | null },
	): Promise<TBorrowingView> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		if (borrowing.status !== 'issued' && borrowing.status !== 'partially_returned') {
			throw new BorrowingTransitionError(borrowing.status, 'marked_lost');
		}
		const line = await this.borrowingRepository.findLine(options.lineId, id);
		if (!line) throw new BorrowingLineNotFoundError();
		if (line.returnedAt !== null || line.markedLostAt !== null) {
			throw new UnitNotOnBorrowingError();
		}

		const now = new Date();
		await this.database.transaction(async (tx) => {
			const unit = await this.serialUnitRepository.markLost(
				line.serialTrackedItemId,
				tx,
			);
			if (!unit) throw new UnitNotOnBorrowingError();
			await this.borrowingRepository.updateLine(
				line.id,
				{ markedLostAt: now, lostReportedBy: actor.actorUserId },
				tx,
			);

			// Quantity 1: a line is exactly one serialized unit.
			const posted = await this.stockService.postMovement(
				{
					actorOrganizationId: organizationId,
					warehouseId: line.originWarehouseId,
					itemId: unit.itemId,
					movementType: 'adjustment_out',
					quantity: '1',
					occurredAt: now,
					referenceType: 'borrowing',
					referenceId: id,
					createdBy: actor.actorUserId,
					notes: options.note ?? `Lost on borrowing ${borrowing.code}`,
				},
				tx,
			);

			await this.borrowingRepository.appendEvent(
				{
					borrowingId: id,
					borrowingLineId: line.id,
					eventType: 'marked_lost',
					stockMovementId: posted.movement.id,
					actorUserId: actor.actorUserId,
					occurredAt: now,
					note: options.note ?? null,
				},
				tx,
			);
		});

		return this.getById(id, organizationId, actor);
	}

	/**
	 * Extends the due date of the header and every open line.
	 *
	 * @remarks
	 * No movement: nothing physical changed. The line keeps its `due_at` so an
	 * extension is visible per unit when lines were due at different times.
	 */
	async extend(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
		dueAt: Date,
	): Promise<TBorrowingView> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		if (
			borrowing.status !== 'requested' &&
			borrowing.status !== 'approved' &&
			borrowing.status !== 'issued' &&
			borrowing.status !== 'partially_returned'
		) {
			throw new BorrowingTransitionError(borrowing.status, 'due_date_extended');
		}
		const now = new Date();
		await this.database.transaction(async (tx) => {
			await this.borrowingRepository.update(
				id,
				{ dueAt },
				borrowing.status as BorrowingStatus,
				tx,
			);
			await this.borrowingRepository.appendEvent(
				{
					borrowingId: id,
					borrowingLineId: null,
					eventType: 'due_date_extended',
					stockMovementId: null,
					actorUserId: actor.actorUserId,
					occurredAt: now,
					note: `New due date: ${dueAt.toISOString()}`,
				},
				tx,
			);
		});
		return this.getById(id, organizationId, actor);
	}

	/**
	 * Cancels a borrowing that has not been issued.
	 *
	 * @remarks
	 * Only the requester may cancel (`borrowing:create` in §7); the controller
	 * enforces that by comparing `requestedBy`. A cancelled borrowing never
	 * wrote a movement, so nothing needs reversing.
	 */
	async cancel(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
	): Promise<TBorrowingView> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		if (
			borrowing.requestedBy !== null &&
			borrowing.requestedBy !== actor.actorUserId
		) {
			throw new BorrowingSelfApprovalForbiddenError();
		}
		await this.transitionHeader(id, organizationId, 'cancelled', {});
		await this.appendEvent(id, 'cancelled', null, actor.actorUserId);
		return this.getById(id, organizationId, actor);
	}

	/**
	 * Closes a fully returned borrowing.
	 *
	 * @remarks
	 * `closed_at` is what the PII retention sweep keys on, so this is the step
	 * that starts the retention clock.
	 */
	async close(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
	): Promise<TBorrowingView> {
		await this.transitionHeader(id, organizationId, 'closed', {
			closedBy: actor.actorUserId,
			closedAt: new Date(),
		});
		await this.appendEvent(id, 'closed', null, actor.actorUserId);
		return this.getById(id, organizationId, actor);
	}

	/* -------------------------------------------------------------------- *
	 * Late-return sweep (§8)
	 * -------------------------------------------------------------------- */

	/**
	 * Marks every overdue, unreturned line as late. Safe to run repeatedly.
	 *
	 * @param now - The sweep's clock, injectable so a test can move time
	 * @param limit - Caps one pass
	 * @returns Counts of lines marked and skipped
	 * @remarks
	 * Idempotency has two layers: the read excludes already-marked lines, and
	 * {@link IBorrowingRepository.markLineLate} re-checks `marked_late_at IS
	 * NULL` in its `UPDATE`, so two workers racing produce one event.
	 * `marked_late` events carry `actor_user_id = NULL` (automated) and
	 * `stock_movement_id = NULL` (nothing physical moved), which the schema
	 * CHECK requires.
	 */
	async sweepLate(now = new Date(), limit = 500): Promise<TSweepResult> {
		const due = await this.borrowingRepository.findDueLines(now, limit);
		let processed = 0;
		let skipped = 0;
		for (const row of due) {
			const marked = await this.borrowingRepository.markLineLate(
				row.line.id,
				now,
			);
			if (!marked) {
				skipped += 1;
				continue;
			}
			await this.borrowingRepository.appendEvent({
				borrowingId: row.borrowingId,
				borrowingLineId: row.line.id,
				eventType: 'marked_late',
				stockMovementId: null,
				actorUserId: null,
				occurredAt: now,
				note: 'auto',
			});
			processed += 1;
		}
		return { processed, skipped };
	}

	/* -------------------------------------------------------------------- *
	 * Guest PII retention sweep (§11, OPEN-2)
	 * -------------------------------------------------------------------- */

	/**
	 * Nulls guest PII on borrowings closed more than the retention window ago.
	 *
	 * @param retentionMonths - The window; defaults to the configured constant
	 * @param now - The sweep's clock
	 * @remarks
	 * The borrowing row and its whole event timeline survive — what expires is
	 * the **link between a trail and a human**. Idempotent because the candidate
	 * query and the update both require `guest_name IS NOT NULL`.
	 */
	async sweepGuestRetention(
		retentionMonths: number,
		now = new Date(),
		limit = 500,
	): Promise<TSweepResult> {
		const cutoff = monthsBefore(now, retentionMonths);
		const candidates =
			await this.borrowingRepository.findExpiredGuestBorrowings(cutoff, limit);
		let processed = 0;
		let skipped = 0;
		for (const row of candidates) {
			const redacted = await this.borrowingRepository.redactGuestPii(row.id);
			if (redacted) processed += 1;
			else skipped += 1;
		}
		return { processed, skipped };
	}

	/* -------------------------------------------------------------------- *
	 * Internals
	 * -------------------------------------------------------------------- */

	/** Issues one line inside an existing transaction. */
	private async issueLine(
		borrowing: TBorrowingSelect,
		line: TBorrowingLineSelect,
		actor: TBorrowingActor,
		now: Date,
		tx: TTx,
	): Promise<void> {
		const unit = await this.serialUnitRepository.findById(
			line.serialTrackedItemId,
		);
		if (!unit) throw new UnitNotOnBorrowingError();
		if (unit.status !== 'in_stock') {
			throw new UnitNotAvailableError(unit.serialNumber, unit.status);
		}
		if (!unit.warehouseId) {
			// Stock-tracked but warehouse-less is not issuable: there would be no
			// balance key to decrement and no origin to restore on return.
			throw new UnitNotAvailableError(unit.serialNumber, 'not in a warehouse');
		}

		// The origin warehouse must be the one the unit is actually in, so a
		// return restores a truthful location and a loss reduces the right stock.
		const originWarehouseId = unit.warehouseId;
		const originBinId = unit.binId;

		const moved = await this.serialUnitRepository.issueToBorrower(
			unit.id,
			line.id,
			tx,
		);
		if (!moved) throw new UnitNotAvailableError(unit.serialNumber, 'unavailable');

		// Snapshot the origin so the return and the loss flows do not have to
		// infer it from a unit that no longer has a warehouse.
		await this.borrowingRepository.updateLine(
			line.id,
			{
				originWarehouseId,
				issuedAt: now,
				dueAt: line.dueAt ?? borrowing.dueAt,
			},
			tx,
		);

		const posted = await this.stockService.postMovement(
			{
				actorOrganizationId: borrowing.organizationId ?? '',
				warehouseId: originWarehouseId,
				binId: originBinId,
				itemId: unit.itemId,
				movementType: 'borrowing_out',
				quantity: '1',
				occurredAt: now,
				referenceType: 'borrowing',
				referenceId: borrowing.id,
				createdBy: actor.actorUserId,
				notes: `Issued on ${borrowing.code}`,
			},
			tx,
		);

		await this.borrowingRepository.appendEvent(
			{
				borrowingId: borrowing.id,
				borrowingLineId: line.id,
				eventType: 'issued',
				stockMovementId: posted.movement.id,
				actorUserId: actor.actorUserId,
				occurredAt: now,
				note: null,
			},
			tx,
		);
	}

	/** Returns one line inside an existing transaction. */
	private async returnLine(
		borrowing: TBorrowingSelect,
		line: TBorrowingLineSelect,
		actor: TBorrowingActor,
		condition: 'good' | 'damaged' | 'incomplete',
		note: string | null,
		now: Date,
		tx: TTx,
	): Promise<void> {
		const unit = await this.serialUnitRepository.findById(
			line.serialTrackedItemId,
		);
		if (!unit) throw new UnitNotOnBorrowingError();
		if (unit.status !== 'borrowed') {
			throw new UnitNotAvailableError(unit.serialNumber, unit.status);
		}

		const restored = await this.serialUnitRepository.returnFromBorrower(
			unit.id,
			line.originWarehouseId,
			null,
			tx,
		);
		if (!restored) throw new UnitNotOnBorrowingError();

		await this.borrowingRepository.updateLine(
			line.id,
			{ returnedAt: now, returnedCondition: condition },
			tx,
		);

		const posted = await this.stockService.postMovement(
			{
				actorOrganizationId: borrowing.organizationId ?? '',
				warehouseId: line.originWarehouseId,
				itemId: unit.itemId,
				movementType: 'borrowing_in',
				quantity: '1',
				occurredAt: now,
				referenceType: 'borrowing',
				referenceId: borrowing.id,
				createdBy: actor.actorUserId,
				notes: `Returned (${condition}) from ${borrowing.code}`,
			},
			tx,
		);

		await this.borrowingRepository.appendEvent(
			{
				borrowingId: borrowing.id,
				borrowingLineId: line.id,
				eventType: 'returned',
				stockMovementId: posted.movement.id,
				actorUserId: actor.actorUserId,
				occurredAt: now,
				note: note ?? condition,
			},
			tx,
		);
	}

	/** Applies one header status change, refusing an illegal edge. */
	private async transitionHeader(
		id: string,
		organizationId: string,
		to: BorrowingStatus,
		data: Partial<TBorrowingInsert>,
	): Promise<TBorrowingSelect> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		if (!isLegalBorrowingTransition(borrowing.status, to)) {
			throw new BorrowingTransitionError(borrowing.status, to);
		}
		const updated = await this.borrowingRepository.update(
			id,
			{ ...data, status: to },
			borrowing.status as BorrowingStatus,
		);
		if (!updated) throw new BorrowingTransitionError(borrowing.status, to);
		return updated;
	}

	/** Appends a non-physical timeline event. */
	private async appendEvent(
		borrowingId: string,
		eventType: string,
		borrowingLineId: string | null,
		actorUserId: string | null,
	): Promise<void> {
		await this.borrowingRepository.appendEvent({
			borrowingId,
			borrowingLineId,
			eventType,
			// Non-physical events must not carry a movement; the schema CHECK
			// enforces this and the service never passes one.
			stockMovementId: null,
			actorUserId,
			occurredAt: new Date(),
			note: null,
		});
	}

	/** Loads a borrowing or throws. */
	private async requireBorrowing(
		id: string,
		organizationId: string,
	): Promise<TBorrowingSelect> {
		const borrowing = await this.borrowingRepository.findById(
			id,
			organizationId,
		);
		if (!borrowing) throw new BorrowingNotFoundError();
		return borrowing;
	}

	/**
	 * Resolves each requested line to its unit, refusing duplicates and units
	 * that cannot be issued.
	 *
	 * @returns Each line paired with its unit, so the caller can snapshot the
	 *   origin warehouse without a second read
	 */
	private async resolveLines(
		lines: readonly TBorrowingLineInput[],
	): Promise<
		{ line: TBorrowingLineInput; unit: TSerialTrackedItemSelect }[]
	> {
		const seen = new Set<string>();
		const resolved: {
			line: TBorrowingLineInput;
			unit: TSerialTrackedItemSelect;
		}[] = [];
		for (const line of lines) {
			if (seen.has(line.serialTrackedItemId)) {
				throw new UnitNotOnBorrowingError();
			}
			seen.add(line.serialTrackedItemId);
			const unit = await this.serialUnitRepository.findById(
				line.serialTrackedItemId,
			);
			if (!unit) throw new UnitNotOnBorrowingError();
			if (unit.status !== 'in_stock') {
				throw new UnitNotAvailableError(unit.serialNumber, unit.status);
			}
			if (!unit.warehouseId) {
				// Stock-tracked but warehouse-less is not issuable: there would be
				// no balance key to decrement and no origin to restore on return.
				throw new UnitNotAvailableError(
					unit.serialNumber,
					'not in a warehouse',
				);
			}
			resolved.push({ line, unit });
		}
		return resolved;
	}

	/** Validates and narrows the three borrower identity paths. */
	private resolveIdentity(input: TBorrowingCreateInput): {
		borrowerUserId: string | null;
		borrowerCustomerId: string | null;
		guestName: string | null;
		guestPhone: string | null;
		guestIdType: string | null;
		guestIdNumber: string | null;
		guestAddressText: string | null;
		guestIdDocumentRef: string | null;
	} {
		const empty = {
			borrowerUserId: null,
			borrowerCustomerId: null,
			guestName: null,
			guestPhone: null,
			guestIdType: null,
			guestIdNumber: null,
			guestAddressText: null,
			guestIdDocumentRef: null,
		};
		if (input.branch === 'user') {
			if (!input.borrowerUserId) {
				throw new BorrowerIdentityError('borrower_user_id is required');
			}
			return { ...empty, borrowerUserId: input.borrowerUserId };
		}
		if (input.branch === 'customer') {
			if (!input.borrowerCustomerId) {
				throw new BorrowerIdentityError('borrower_customer_id is required');
			}
			return { ...empty, borrowerCustomerId: input.borrowerCustomerId };
		}
		// Guest: identity is snapshotted, and the schema CHECK requires the
		// name, phone and id number all to be present.
		if (!input.guestName) throw new GuestIdentityIncompleteError('guest_name');
		if (!input.guestPhone) throw new GuestIdentityIncompleteError('guest_phone');
		if (!input.guestIdNumber) {
			throw new GuestIdentityIncompleteError('guest_id_number');
		}
		return {
			...empty,
			guestName: input.guestName,
			guestPhone: input.guestPhone,
			guestIdType: input.guestIdType ?? null,
			guestIdNumber: input.guestIdNumber,
			guestAddressText: input.guestAddressText ?? null,
			guestIdDocumentRef: input.guestIdDocumentRef ?? null,
		};
	}

	/** Applies the guest-PII projection and assembles the view. */
	private project(
		borrowing: TBorrowingSelect,
		lines: TBorrowingLineSelect[],
		events: {
			id: string;
			borrowingLineId: string | null;
			eventType: string;
			stockMovementId: string | null;
			actorUserId: string | null;
			occurredAt: Date;
			note: string | null;
		}[],
		actor: TBorrowingActor,
	): TBorrowingView {
		const isGuest = borrowing.borrowerType === 'guest';
		if (isGuest && !actor.canSeeGuestPii) {
			return {
				...borrowing,
				guestIdNumber: null,
				guestAddressText: null,
				guestIdDocumentRef: null,
				lines,
				events,
				guestIdentityRedacted: true,
			};
		}
		return { ...borrowing, lines, events, guestIdentityRedacted: false };
	}

	/**
	 * Allocates and formats the next borrowing code (ERP-0009).
	 *
	 * @remarks
	 * Format `BRW-<YYYYMM>-<#4>` per the plan, serial part sequence-allocated
	 * per `(organization, 'borrowing')` inside the caller's transaction.
	 * Uniqueness follows from the sequence — no collision retry needed.
	 * Must be called inside the document's transaction.
	 */
	private async borrowingCode(
		tx: TTx,
		organizationId: string,
	): Promise<string> {
		const number = await this.numbering.allocate(
			organizationId,
			'borrowing',
			tx,
		);
		const now = new Date();
		const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
		return this.numbering.format('BRW', month, number, 4);
	}
}

/** Shifts a date back by whole months, clamping the day of month. */
export function monthsBefore(date: Date, months: number): Date {
	const result = new Date(date.getTime());
	const targetMonth = result.getUTCMonth() - months;
	const day = result.getUTCDate();
	result.setUTCMonth(targetMonth, 1);
	const daysInMonth = new Date(
		Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
	).getUTCDate();
	result.setUTCDate(Math.min(day, daysInMonth));
	return result;
}

/** Re-exported so callers never need the schema type directly. */
export type { TSerialTrackedItemSelect };
