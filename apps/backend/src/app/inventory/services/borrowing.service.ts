import type {
	BorrowingStatus,
	TBorrowingItemSelect,
	TBorrowingRequestSelect,
	TBorrowingSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import {
	BORROWING_EVENT_REPOSITORY_TOKEN,
	BORROWING_ITEM_REPOSITORY_TOKEN,
	BORROWING_REPOSITORY_TOKEN,
	BORROWING_REQUEST_EVENT_REPOSITORY_TOKEN,
	BORROWING_REQUEST_REPOSITORY_TOKEN,
	BORROWING_REQUEST_SERVICE_TOKEN,
	INVENTORY_NUMBERING_SERVICE_TOKEN,
	ITEM_CUSTODY_SERVICE_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	TOOL_SET_REPOSITORY_TOKEN,
} from '../constants/di';
import type { TBorrowingActor, TBorrowingView, TSweepResult } from '../contracts/borrowing-view.types';
import type {
	IBorrowingEventRepository,
	IBorrowingItemRepository,
	IBorrowingRepository,
	IBorrowingRequestEventRepository,
	IBorrowingRequestRepository,
	TBorrowingPaginationRequest,
} from '../contracts/borrowing.repository.interface';
import type { IItemRepository } from '../contracts/item.repository.interface';
import type { IToolSetRepository } from '../contracts/item-operations.repository.interface';
import {
	BorrowingHasNoItemsError,
	BorrowingItemNotFoundError,
	BorrowingNotFoundError,
	BorrowingTransitionError,
	UnitNotAvailableError,
	UnitNotOnBorrowingError,
} from '../errors/borrowing.errors';
import type { BorrowingRequestService } from './borrowing-request.service';
import { InventoryAuditWriter } from './inventory-audit.writer';
import type { InventoryNumberingService } from './inventory-numbering.service';
import type { ItemCustodyService } from './item-custody.service';

/**
 * Legal status edges of a borrowing (the issue/return document, Q26).
 *
 * @remarks
 * `issued -> partially_returned -> returned` is the per-item return path (a
 * borrowing whose items all come back in one go skips straight to `returned`);
 * `closed` follows `returned` and starts the guest-PII retention clock.
 */
const BORROWING_TRANSITIONS: Record<BorrowingStatus, readonly BorrowingStatus[]> = {
	issued: ['partially_returned', 'returned'],
	partially_returned: ['returned'],
	returned: ['closed'],
	closed: [],
};

/** Whether a borrowing status edge is legal. Unknown statuses are never legal. */
export function isLegalBorrowingTransition(from: string, to: BorrowingStatus): boolean {
	if (!(from in BORROWING_TRANSITIONS)) return false;
	return BORROWING_TRANSITIONS[from as BorrowingStatus].includes(to);
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

/**
 * Borrowing issue/return engine (D5, ADR-0024 Q26): turns an approved request
 * into a `borrowings` document, moves custody out and back, and sweeps late
 * items and expired guest PII.
 *
 * @remarks
 * **Every physical transition is one transaction**: the item's issue/return
 * snapshot, the `inventory.movements` row (borrowing never writes the product
 * ledger), the unit's location/custody/status reconcile, and the append-only
 * timeline event that points at the movement. A movement committed outside the
 * item change would leave the timeline claiming custody the register still
 * shows as in stock.
 *
 * "Tested" is a borrowing with `purpose = 'testing'`, not a parallel flow (D8).
 */
@injectable()
export class BorrowingService {
	constructor(
		@inject(BORROWING_REQUEST_SERVICE_TOKEN)
		private readonly requestService: Pick<BorrowingRequestService, 'requireRequest' | 'getById'>,
		@inject(BORROWING_REQUEST_REPOSITORY_TOKEN)
		private readonly requests: Pick<
			IBorrowingRequestRepository,
			'update' | 'findExpiredGuestRequests' | 'redactGuestPii'
		>,
		@inject(BORROWING_REQUEST_EVENT_REPOSITORY_TOKEN)
		private readonly requestEvents: Pick<IBorrowingRequestEventRepository, 'append'>,
		@inject(BORROWING_REPOSITORY_TOKEN)
		private readonly borrowings: IBorrowingRepository,
		@inject(BORROWING_ITEM_REPOSITORY_TOKEN)
		private readonly borrowingItems: IBorrowingItemRepository,
		@inject(BORROWING_EVENT_REPOSITORY_TOKEN)
		private readonly events: IBorrowingEventRepository,
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly itemRepository: Pick<IItemRepository, 'findById'>,
		@inject(ITEM_CUSTODY_SERVICE_TOKEN)
		private readonly custody: ItemCustodyService,
		@inject(TOOL_SET_REPOSITORY_TOKEN)
		private readonly toolSets: Pick<IToolSetRepository, 'setStatus'>,
		@inject(INVENTORY_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<InventoryNumberingService, 'next'>,
		private readonly audit: InventoryAuditWriter,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
	) {}

	/** One page of borrowings (issue documents) for a tenant. */
	paginate(request: TBorrowingPaginationRequest): Promise<TPaginationResult<TBorrowingSelect>> {
		return this.borrowings.paginate(request);
	}

	/**
	 * Reads one borrowing as its request view (items, both timelines, PII projection).
	 *
	 * @throws {BorrowingNotFoundError} When absent or in another tenant
	 */
	async getById(id: string, organizationId: string, actor: TBorrowingActor): Promise<TBorrowingView> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		return this.requestService.getById(borrowing.borrowingRequestId, organizationId, actor);
	}

	/**
	 * Issues every open item of a request, moving custody out of the warehouse.
	 *
	 * @remarks
	 * Legal from `approved`; from `requested` only for a caller holding
	 * `asset_borrowing:issue` or `:approve` (skippable approval is a privilege,
	 * never a default) - the request is then approved implicitly by the issuer.
	 * Creates the `borrowings` row (code `BRW-...`, unique per request).
	 *
	 * @throws {BorrowingTransitionError} When the request cannot be issued
	 * @throws {UnitNotAvailableError} When a unit is no longer `ready`
	 */
	async issue(
		requestId: string,
		organizationId: string,
		actor: TBorrowingActor,
	): Promise<TBorrowingView> {
		const request = await this.requestService.requireRequest(requestId, organizationId);
		if (request.status === 'requested' && !actor.canIssue && !actor.canApprove) {
			throw new BorrowingTransitionError(request.status, 'issued');
		}
		if (request.status !== 'requested' && request.status !== 'approved') {
			throw new BorrowingTransitionError(request.status, 'issued');
		}
		if (await this.borrowings.findByRequestId(requestId)) {
			throw new BorrowingTransitionError('issued', 'issued');
		}
		const items = await this.borrowingItems.listByRequest(requestId);
		if (items.length === 0) throw new BorrowingHasNoItemsError();

		const now = new Date();
		const borrowing = await this.transactions.run(async (tx) => {
			if (request.status === 'requested') {
				const approved = await this.requests.update(
					requestId,
					{ status: 'approved', approvedBy: actor.actorUserId, approvedAt: now },
					'requested',
					tx,
				);
				if (!approved) throw new BorrowingTransitionError(request.status, 'issued');
				await this.requestEvents.append(
					{
						borrowingRequestId: requestId,
						eventType: 'approved',
						actorUserId: actor.actorUserId,
						occurredAt: now,
						note: 'approved by issue',
					},
					tx,
				);
			}
			const header = await this.borrowings.create(
				{
					organizationId,
					code: await this.numbering.next('borrowing', tx, now),
					borrowingRequestId: requestId,
					status: 'issued',
					issuedBy: actor.actorUserId,
					issuedAt: now,
					dueAt: request.dueAt,
					createdAt: now,
				},
				tx,
			);
			for (const item of items) {
				await this.issueItem(header, request, item, organizationId, actor, now, tx);
			}
			// Q37: the kit is out as a unit while any of its items is open.
			if (request.toolSetId) await this.toolSets.setStatus(request.toolSetId, 'lent', tx);
			return header;
		});

		for (const item of items) {
			await this.audit.record({
				actor: { userId: actor.actorUserId },
				action: 'asset.borrowed',
				targetType: 'asset',
				targetId: item.itemId,
				organizationId,
				meta: {
					code: borrowing.code,
					borrowingId: borrowing.id,
					borrowingItemId: item.id,
					toolSetId: request.toolSetId,
				},
			});
		}
		return this.requestService.getById(requestId, organizationId, actor);
	}

	/**
	 * Returns one or all open items to their origin warehouse.
	 *
	 * @remarks
	 * A partial return moves the borrowing to `partially_returned`; returning
	 * the last open item moves it to `returned`.
	 */
	async returnItems(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
		options: {
			borrowingItemId?: string;
			condition: 'good' | 'damaged' | 'incomplete';
			note?: string | null;
		},
	): Promise<TBorrowingView> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		if (borrowing.status !== 'issued' && borrowing.status !== 'partially_returned') {
			throw new BorrowingTransitionError(borrowing.status, 'returned');
		}
		const request = await this.requestService.requireRequest(
			borrowing.borrowingRequestId,
			organizationId,
		);
		const all = await this.borrowingItems.listByBorrowing(id);
		const open = all.filter(
			(item) => item.issuedAt !== null && item.returnedAt === null && item.markedLostAt === null,
		);
		const targets = options.borrowingItemId
			? open.filter((item) => item.id === options.borrowingItemId)
			: open;
		if (options.borrowingItemId && targets.length === 0) {
			throw all.some((item) => item.id === options.borrowingItemId)
				? new UnitNotOnBorrowingError()
				: new BorrowingItemNotFoundError();
		}

		const now = new Date();
		let nextStatus: BorrowingStatus = 'returned';
		await this.transactions.run(async (tx) => {
			for (const item of targets) {
				await this.returnItem(borrowing, item, organizationId, actor, options, now, tx);
			}
			nextStatus = open.length - targets.length > 0 ? 'partially_returned' : 'returned';
			const updated = await this.borrowings.update(
				id,
				nextStatus === 'returned' ? { status: nextStatus } : { status: nextStatus },
				borrowing.status as BorrowingStatus,
				tx,
			);
			if (!updated) throw new BorrowingTransitionError(borrowing.status, nextStatus);
			// Q37: the kit is only available again once every item is back.
			if (nextStatus === 'returned' && request.toolSetId) {
				await this.toolSets.setStatus(request.toolSetId, 'available', tx);
			}
		});

		for (const item of targets) {
			await this.audit.record({
				actor: { userId: actor.actorUserId },
				action: 'asset.returned',
				targetType: 'asset',
				targetId: item.itemId,
				organizationId,
				meta: {
					code: borrowing.code,
					borrowingId: id,
					borrowingItemId: item.id,
					condition: options.condition,
					fullyReturned: nextStatus === 'returned',
				},
			});
		}
		return this.requestService.getById(borrowing.borrowingRequestId, organizationId, actor);
	}

	/**
	 * Reports an item lost and parks the unit in the terminal `lost` state.
	 * Nothing is restored anywhere and nothing reaches the product ledger.
	 */
	async markLost(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
		options: { borrowingItemId: string; note?: string | null },
	): Promise<TBorrowingView> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		if (borrowing.status !== 'issued' && borrowing.status !== 'partially_returned') {
			throw new BorrowingTransitionError(borrowing.status, 'marked_lost');
		}
		const item = await this.borrowingItems.findInBorrowing(options.borrowingItemId, id);
		if (!item) throw new BorrowingItemNotFoundError();
		if (item.returnedAt !== null || item.markedLostAt !== null) throw new UnitNotOnBorrowingError();

		const now = new Date();
		await this.transactions.run(async (tx) => {
			await this.borrowingItems.update(
				item.id,
				{ markedLostAt: now, lostReportedBy: actor.actorUserId },
				tx,
			);
			const movement = await this.custody.markLost(
				item.itemId,
				organizationId,
				{
					referenceId: id,
					notes: options.note ?? `Lost on borrowing ${borrowing.code}`,
					at: now,
				},
				{ userId: actor.actorUserId },
				tx,
			);
			await this.custody.syncCustody(item.itemId, tx);
			await this.events.append(
				{
					borrowingId: id,
					borrowingItemId: item.id,
					eventType: 'marked_lost',
					movementId: movement.id,
					actorUserId: actor.actorUserId,
					occurredAt: now,
					note: options.note ?? null,
				},
				tx,
			);
		});

		await this.audit.record({
			actor: { userId: actor.actorUserId },
			action: 'asset.lost',
			targetType: 'asset',
			targetId: item.itemId,
			organizationId,
			meta: { code: borrowing.code, borrowingId: id, borrowingItemId: item.id, note: options.note ?? null },
		});
		return this.requestService.getById(borrowing.borrowingRequestId, organizationId, actor);
	}

	/** Extends the due date of an issued borrowing and its open items (no movement). */
	async extend(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
		dueAt: Date,
	): Promise<TBorrowingView> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		if (borrowing.status !== 'issued' && borrowing.status !== 'partially_returned') {
			throw new BorrowingTransitionError(borrowing.status, 'due_date_extended');
		}
		const open = (await this.borrowingItems.listByBorrowing(id)).filter(
			(item) => item.returnedAt === null && item.markedLostAt === null,
		);
		await this.transactions.run(async (tx) => {
			const updated = await this.borrowings.update(
				id,
				{ dueAt },
				borrowing.status as BorrowingStatus,
				tx,
			);
			if (!updated) throw new BorrowingTransitionError(borrowing.status, 'due_date_extended');
			for (const item of open) await this.borrowingItems.update(item.id, { dueAt }, tx);
			await this.events.append(
				{
					borrowingId: id,
					borrowingItemId: null,
					eventType: 'due_date_extended',
					movementId: null,
					actorUserId: actor.actorUserId,
					occurredAt: new Date(),
					note: `New due date: ${dueAt.toISOString()}`,
				},
				tx,
			);
		});
		return this.requestService.getById(borrowing.borrowingRequestId, organizationId, actor);
	}

	/** Closes a fully returned borrowing; `closed_at` starts the PII retention clock. */
	async close(id: string, organizationId: string, actor: TBorrowingActor): Promise<TBorrowingView> {
		const borrowing = await this.requireBorrowing(id, organizationId);
		if (!isLegalBorrowingTransition(borrowing.status, 'closed')) {
			throw new BorrowingTransitionError(borrowing.status, 'closed');
		}
		const now = new Date();
		await this.transactions.run(async (tx) => {
			const updated = await this.borrowings.update(
				id,
				{ status: 'closed', closedBy: actor.actorUserId, closedAt: now },
				borrowing.status as BorrowingStatus,
				tx,
			);
			if (!updated) throw new BorrowingTransitionError(borrowing.status, 'closed');
			await this.events.append(
				{
					borrowingId: id,
					borrowingItemId: null,
					eventType: 'closed',
					movementId: null,
					actorUserId: actor.actorUserId,
					occurredAt: now,
					note: null,
				},
				tx,
			);
		});
		await this.audit.record({
			actor: { userId: actor.actorUserId },
			action: 'borrowing.closed',
			targetType: 'borrowing',
			targetId: id,
			organizationId,
			meta: { code: borrowing.code },
		});
		return this.requestService.getById(borrowing.borrowingRequestId, organizationId, actor);
	}

	/* ------------------------------------------------------------------ *
	 * Sweeps
	 * ------------------------------------------------------------------ */

	/**
	 * Marks every overdue, unreturned item as late. Safe to run repeatedly: the
	 * read excludes marked items and `markLate` re-checks `marked_late_at IS NULL`,
	 * so two workers racing produce one event. `marked_late` events carry no actor
	 * (automated) and no movement (nothing physical moved), as the CHECK requires.
	 */
	async sweepLate(now = new Date(), limit = 500): Promise<TSweepResult> {
		const due = await this.borrowingItems.findDue(now, limit);
		let processed = 0;
		let skipped = 0;
		for (const row of due) {
			const marked = await this.borrowingItems.markLate(row.item.id, now);
			if (!marked) {
				skipped += 1;
				continue;
			}
			await this.events.append({
				borrowingId: row.borrowingId,
				borrowingItemId: row.item.id,
				eventType: 'marked_late',
				movementId: null,
				actorUserId: null,
				occurredAt: now,
				note: 'auto',
			});
			processed += 1;
		}
		return { processed, skipped };
	}

	/**
	 * Nulls guest PII on requests whose borrowing closed more than the retention
	 * window ago. The request, items and both timelines survive - what expires is
	 * the link between a trail and a human. Idempotent (`guest_name IS NOT NULL`).
	 */
	async sweepGuestRetention(
		retentionMonths: number,
		now = new Date(),
		limit = 500,
	): Promise<TSweepResult> {
		const candidates = await this.requests.findExpiredGuestRequests(
			monthsBefore(now, retentionMonths),
			limit,
		);
		let processed = 0;
		let skipped = 0;
		for (const row of candidates) {
			if (await this.requests.redactGuestPii(row.id)) processed += 1;
			else skipped += 1;
		}
		return { processed, skipped };
	}

	/* ------------------------------------------------------------------ */

	private async issueItem(
		borrowing: TBorrowingSelect,
		request: TBorrowingRequestSelect,
		item: TBorrowingItemSelect,
		organizationId: string,
		actor: TBorrowingActor,
		now: Date,
		tx: TTx,
	): Promise<void> {
		const unit = await this.itemRepository.findById(item.itemId);
		if (!unit) throw new UnitNotOnBorrowingError();
		const label = unit.serialNumber ?? unit.code;
		if (unit.status !== 'ready') throw new UnitNotAvailableError(label, unit.status);
		// Warehouse-less is not issuable: there would be no origin to restore on return.
		if (!unit.warehouseId) throw new UnitNotAvailableError(label, 'not in a warehouse');

		// Snapshot the origin so return and loss need not infer it from a unit
		// that no longer has a location.
		await this.borrowingItems.update(
			item.id,
			{
				borrowingId: borrowing.id,
				originWarehouseId: unit.warehouseId,
				originStorageId: unit.storageId,
				issuedAt: now,
				dueAt: item.dueAt ?? request.dueAt,
			},
			tx,
		);
		const movement = await this.custody.borrowOut(
			unit.id,
			organizationId,
			{
				warehouseId: unit.warehouseId,
				storageId: unit.storageId,
				toLocation: item.siteAddressText,
				referenceId: borrowing.id,
				notes: `Issued on ${borrowing.code}`,
				at: now,
			},
			{ userId: actor.actorUserId },
			tx,
		);
		await this.custody.syncCustody(unit.id, tx);
		await this.custody.reconcileStatus(unit.id, tx);
		await this.events.append(
			{
				borrowingId: borrowing.id,
				borrowingItemId: item.id,
				eventType: 'issued',
				movementId: movement.id,
				actorUserId: actor.actorUserId,
				occurredAt: now,
				note: null,
			},
			tx,
		);
	}

	private async returnItem(
		borrowing: TBorrowingSelect,
		item: TBorrowingItemSelect,
		organizationId: string,
		actor: TBorrowingActor,
		options: { condition: 'good' | 'damaged' | 'incomplete'; note?: string | null },
		now: Date,
		tx: TTx,
	): Promise<void> {
		const unit = await this.itemRepository.findById(item.itemId);
		if (!unit) throw new UnitNotOnBorrowingError();
		const label = unit.serialNumber ?? unit.code;
		if (unit.status !== 'borrowed') throw new UnitNotAvailableError(label, unit.status);
		if (!item.originWarehouseId) throw new UnitNotOnBorrowingError();

		await this.borrowingItems.update(
			item.id,
			{ returnedAt: now, returnedCondition: options.condition },
			tx,
		);
		const movement = await this.custody.borrowReturn(
			unit.id,
			organizationId,
			{
				warehouseId: item.originWarehouseId,
				storageId: item.originStorageId,
				condition: options.condition,
				referenceId: borrowing.id,
				notes: `Returned from ${borrowing.code}`,
				at: now,
			},
			{ userId: actor.actorUserId },
			tx,
		);
		await this.custody.syncCustody(unit.id, tx);
		await this.custody.reconcileStatus(unit.id, tx);
		await this.events.append(
			{
				borrowingId: borrowing.id,
				borrowingItemId: item.id,
				eventType: 'returned',
				movementId: movement.id,
				actorUserId: actor.actorUserId,
				occurredAt: now,
				note: options.note ?? options.condition,
			},
			tx,
		);
	}

	private async requireBorrowing(id: string, organizationId: string): Promise<TBorrowingSelect> {
		const borrowing = await this.borrowings.findById(id, organizationId);
		if (!borrowing) throw new BorrowingNotFoundError();
		return borrowing;
	}
}
