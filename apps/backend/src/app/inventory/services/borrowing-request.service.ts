import type {
	BorrowingRequestStatus,
	TBorrowingItemSelect,
	TBorrowingRequestInsert,
	TBorrowingRequestSelect,
	TItemSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import {
	BORROWING_EVENT_REPOSITORY_TOKEN,
	BORROWING_ITEM_REPOSITORY_TOKEN,
	BORROWING_REPOSITORY_TOKEN,
	BORROWING_REQUEST_EVENT_REPOSITORY_TOKEN,
	BORROWING_REQUEST_REPOSITORY_TOKEN,
	INVENTORY_NUMBERING_SERVICE_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	TOOL_SET_ITEM_REPOSITORY_TOKEN,
} from '../constants/di';
import type {
	TBorrowingActor,
	TBorrowingCreateInput,
	TBorrowingRequestListItem,
	TBorrowingTimelineEvent,
	TBorrowingView,
} from '../contracts/borrowing-view.types';
import type {
	IBorrowingEventRepository,
	IBorrowingItemRepository,
	IBorrowingRepository,
	IBorrowingRequestEventRepository,
	IBorrowingRequestRepository,
	TBorrowingItemInput,
	TBorrowingRequestPaginationRequest,
} from '../contracts/borrowing.repository.interface';
import type { IItemRepository } from '../contracts/item.repository.interface';
import type { IToolSetItemRepository } from '../contracts/item-operations.repository.interface';
import {
	BorrowerIdentityError,
	BorrowingHasNoItemsError,
	BorrowingNotFoundError,
	BorrowingSelfApprovalForbiddenError,
	BorrowingTransitionError,
	GuestIdentityIncompleteError,
	UnitNotAvailableError,
	UnitNotOnBorrowingError,
} from '../errors/borrowing.errors';
import { InventoryAuditWriter } from './inventory-audit.writer';
import type { InventoryNumberingService } from './inventory-numbering.service';

/**
 * Legal status edges of a borrowing request (D19, ADR-0024 Q26).
 *
 * @remarks
 * Data, not an `if` chain, so an illegal edge cannot be forgotten. The request
 * ends at `approved`; custody starts with the borrowing (`BorrowingService`),
 * whose own edges are `issued -> partially_returned -> returned -> closed`.
 */
const REQUEST_TRANSITIONS: Record<BorrowingRequestStatus, readonly BorrowingRequestStatus[]> = {
	draft: ['requested', 'cancelled'],
	requested: ['approved', 'rejected', 'cancelled'],
	approved: ['cancelled'],
	rejected: [],
	cancelled: [],
};

/** Whether a request status edge is legal. Unknown statuses are never legal. */
export function isLegalRequestTransition(from: string, to: BorrowingRequestStatus): boolean {
	if (!(from in REQUEST_TRANSITIONS)) return false;
	return REQUEST_TRANSITIONS[from as BorrowingRequestStatus].includes(to);
}

/**
 * Borrowing request lifecycle: draft, submit, approve, reject, cancel, and the
 * assembled view of a request with its borrowing.
 *
 * @remarks
 * Nothing physical happens here: no movement, no custody change. Availability
 * is checked so the requester learns early that a unit is unavailable, and again
 * at issue under guard (`BorrowingService.issue`).
 *
 * **Guest PII never leaves this service unredacted** unless the caller holds
 * the tier (`canSeeGuestPii`).
 */
@injectable()
export class BorrowingRequestService {
	constructor(
		@inject(BORROWING_REQUEST_REPOSITORY_TOKEN)
		private readonly requests: IBorrowingRequestRepository,
		@inject(BORROWING_REPOSITORY_TOKEN)
		private readonly borrowings: Pick<IBorrowingRepository, 'findByRequestId'>,
		@inject(BORROWING_ITEM_REPOSITORY_TOKEN)
		private readonly borrowingItems: IBorrowingItemRepository,
		@inject(BORROWING_REQUEST_EVENT_REPOSITORY_TOKEN)
		private readonly requestEvents: IBorrowingRequestEventRepository,
		@inject(BORROWING_EVENT_REPOSITORY_TOKEN)
		private readonly borrowingEvents: Pick<IBorrowingEventRepository, 'listByBorrowing'>,
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly itemRepository: Pick<IItemRepository, 'findById'>,
		@inject(TOOL_SET_ITEM_REPOSITORY_TOKEN)
		private readonly toolSetItems: IToolSetItemRepository,
		@inject(INVENTORY_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<InventoryNumberingService, 'next'>,
		private readonly audit: InventoryAuditWriter,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
	) {}

	/** One page of requests for a tenant, each with a display photo. */
	async paginate(
		request: TBorrowingRequestPaginationRequest,
	): Promise<TPaginationResult<TBorrowingRequestListItem>> {
		const result = await this.requests.paginate(request);
		const images = await this.requests.listFirstItemImages(result.data.map((row) => row.id));
		const byRequest = new Map(images.map((row) => [row.requestId, row.imageUrl]));
		return {
			...result,
			data: result.data.map((row) => ({ ...row, imageUrl: byRequest.get(row.id) ?? null })),
		};
	}

	/**
	 * Reads one request with its items, borrowing and timeline.
	 *
	 * @throws {BorrowingNotFoundError} When absent or in another tenant
	 */
	async getById(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
	): Promise<TBorrowingView> {
		const request = await this.requireRequest(id, organizationId);
		const borrowing = await this.borrowings.findByRequestId(id);
		const [items, requestEvents, borrowingEvents] = await Promise.all([
			this.borrowingItems.listByRequest(id),
			this.requestEvents.listByRequest(id),
			borrowing ? this.borrowingEvents.listByBorrowing(borrowing.id) : Promise.resolve([]),
		]);
		const events: TBorrowingTimelineEvent[] = [
			...requestEvents.map((event) => ({
				id: event.id,
				scope: 'request' as const,
				borrowingItemId: null,
				eventType: event.eventType,
				movementId: null,
				actorUserId: event.actorUserId,
				occurredAt: event.occurredAt,
				note: event.note,
			})),
			...borrowingEvents.map((event) => ({
				id: event.id,
				scope: 'borrowing' as const,
				borrowingItemId: event.borrowingItemId,
				eventType: event.eventType,
				movementId: event.movementId,
				actorUserId: event.actorUserId,
				occurredAt: event.occurredAt,
				note: event.note,
			})),
		].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
		return this.project(request, borrowing, items, events, actor);
	}

	/**
	 * Raises a request (`draft` or `requested`).
	 *
	 * @throws {BorrowingHasNoItemsError} When there is nothing to borrow
	 * @throws {UnitNotAvailableError} When a unit is not `ready` or has no warehouse
	 */
	async create(
		input: TBorrowingCreateInput,
		organizationId: string,
		actor: TBorrowingActor,
		status: 'draft' | 'requested' = 'requested',
	): Promise<TBorrowingView> {
		if (input.items.length === 0 && !input.toolSetId) throw new BorrowingHasNoItemsError();
		const identity = this.resolveIdentity(input);
		// Q37: a tool set lends as one kit, expanded into one item per member.
		const requested = input.toolSetId
			? [...input.items, ...(await this.toolSetItemInputs(input.toolSetId))]
			: input.items;
		if (requested.length === 0) throw new BorrowingHasNoItemsError();
		// Resolved once: confirms availability AND captures the origin
		// warehouse/storage, which the return and loss flows restore.
		const resolved = await this.resolveItems(requested, organizationId);
		const now = new Date();

		const request = await this.transactions.run(async (tx) => {
			const code = await this.numbering.next('borrowing', tx);
			const header = await this.requests.create(
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
					toolSetId: input.toolSetId ?? null,
					createdAt: now,
				},
				tx,
			);
			await this.borrowingItems.createMany(
				resolved.map(({ input: item, unit }) => ({
					organizationId,
					borrowingRequestId: header.id,
					borrowingId: null,
					itemId: item.itemId,
					originWarehouseId: unit.warehouseId,
					originStorageId: unit.storageId,
					dueAt: item.dueAt ?? input.dueAt,
					siteAddressText: item.siteAddressText ?? null,
					projectId: item.projectId ?? null,
					notes: item.notes ?? null,
					createdAt: now,
				})),
				tx,
			);
			if (status === 'requested') {
				await this.requestEvents.append(
					{
						borrowingRequestId: header.id,
						eventType: 'requested',
						actorUserId: actor.actorUserId,
						occurredAt: now,
						note: null,
					},
					tx,
				);
			}
			return header;
		});

		return this.getById(request.id, organizationId, actor);
	}

	/** `draft -> requested`. */
	async submit(id: string, organizationId: string, actor: TBorrowingActor): Promise<TBorrowingView> {
		await this.transition(id, organizationId, 'requested', {
			requestedBy: actor.actorUserId,
			requestedAt: new Date(),
		}, actor.actorUserId);
		return this.getById(id, organizationId, actor);
	}

	/**
	 * `requested -> approved`.
	 *
	 * @throws {BorrowingSelfApprovalForbiddenError} When the approver raised it and has no bypass
	 */
	async approve(id: string, organizationId: string, actor: TBorrowingActor): Promise<TBorrowingView> {
		const request = await this.requireRequest(id, organizationId);
		// Checked before the edge so the refusal is a specific 403, not a
		// generic transition error - mirrors the adjustment workflow.
		if (
			!actor.canApprove &&
			request.requestedBy !== null &&
			request.requestedBy === actor.actorUserId
		) {
			throw new BorrowingSelfApprovalForbiddenError();
		}
		await this.transition(id, organizationId, 'approved', {
			approvedBy: actor.actorUserId,
			approvedAt: new Date(),
		}, actor.actorUserId);
		return this.getById(id, organizationId, actor);
	}

	/** `requested -> rejected`. */
	async reject(id: string, organizationId: string, actor: TBorrowingActor): Promise<TBorrowingView> {
		await this.transition(id, organizationId, 'rejected', {}, actor.actorUserId);
		return this.getById(id, organizationId, actor);
	}

	/**
	 * Cancels a request that has not been issued. Only the requester may cancel;
	 * a request with a borrowing is never cancelled (return the items instead).
	 */
	async cancel(id: string, organizationId: string, actor: TBorrowingActor): Promise<TBorrowingView> {
		const request = await this.requireRequest(id, organizationId);
		if (request.requestedBy !== null && request.requestedBy !== actor.actorUserId) {
			throw new BorrowingSelfApprovalForbiddenError();
		}
		if (await this.borrowings.findByRequestId(id)) {
			throw new BorrowingTransitionError(request.status, 'cancelled');
		}
		await this.transition(id, organizationId, 'cancelled', {}, actor.actorUserId);
		await this.audit.record({
			actor: { userId: actor.actorUserId },
			action: 'borrowing.cancelled',
			targetType: 'borrowing',
			targetId: id,
			organizationId,
			meta: { code: request.code },
		});
		return this.getById(id, organizationId, actor);
	}

	/** Moves the due date of a request that is not issued yet (no status change). */
	async extend(
		id: string,
		organizationId: string,
		actor: TBorrowingActor,
		dueAt: Date,
	): Promise<TBorrowingView> {
		const request = await this.requireRequest(id, organizationId);
		if (request.status !== 'requested' && request.status !== 'approved') {
			throw new BorrowingTransitionError(request.status, 'due_date_extended');
		}
		await this.transactions.run(async (tx) => {
			const updated = await this.requests.update(
				id,
				{ dueAt },
				request.status as BorrowingRequestStatus,
				tx,
			);
			if (!updated) throw new BorrowingTransitionError(request.status, 'due_date_extended');
			await this.requestEvents.append(
				{
					borrowingRequestId: id,
					eventType: 'due_date_extended',
					actorUserId: actor.actorUserId,
					occurredAt: new Date(),
					note: `New due date: ${dueAt.toISOString()}`,
				},
				tx,
			);
		});
		return this.getById(id, organizationId, actor);
	}

	/** Loads a request or throws; shared with `BorrowingService`. */
	async requireRequest(id: string, organizationId: string): Promise<TBorrowingRequestSelect> {
		const request = await this.requests.findById(id, organizationId);
		if (!request) throw new BorrowingNotFoundError();
		return request;
	}

	/* ------------------------------------------------------------------ */

	/** Applies one status change with an optimistic guard and records its event. */
	private async transition(
		id: string,
		organizationId: string,
		to: BorrowingRequestStatus,
		data: Partial<TBorrowingRequestInsert>,
		actorUserId: string,
	): Promise<void> {
		const request = await this.requireRequest(id, organizationId);
		if (!isLegalRequestTransition(request.status, to)) {
			throw new BorrowingTransitionError(request.status, to);
		}
		await this.transactions.run(async (tx) => {
			const updated = await this.requests.update(
				id,
				{ ...data, status: to },
				request.status as BorrowingRequestStatus,
				tx,
			);
			if (!updated) throw new BorrowingTransitionError(request.status, to);
			await this.requestEvents.append(
				{
					borrowingRequestId: id,
					eventType: to,
					actorUserId,
					occurredAt: new Date(),
					note: null,
				},
				tx,
			);
		});
	}

	/**
	 * Resolves each requested item to its unit, refusing duplicates and units
	 * that cannot be issued. A global (organization-less) unit is lendable by any tenant.
	 */
	private async resolveItems(
		requested: readonly TBorrowingItemInput[],
		organizationId: string,
	): Promise<{ input: TBorrowingItemInput; unit: TItemSelect }[]> {
		const seen = new Set<string>();
		const resolved: { input: TBorrowingItemInput; unit: TItemSelect }[] = [];
		for (const input of requested) {
			if (seen.has(input.itemId)) throw new UnitNotOnBorrowingError();
			seen.add(input.itemId);
			const unit = await this.itemRepository.findById(input.itemId);
			if (!unit || (unit.organizationId !== null && unit.organizationId !== organizationId)) {
				throw new UnitNotOnBorrowingError();
			}
			const label = unit.serialNumber ?? unit.code;
			if (unit.status !== 'ready') throw new UnitNotAvailableError(label, unit.status);
			// Warehouse-less is not issuable: there would be no origin to restore on return.
			if (!unit.warehouseId) throw new UnitNotAvailableError(label, 'not in a warehouse');
			resolved.push({ input, unit });
		}
		return resolved;
	}

	private async toolSetItemInputs(toolSetId: string): Promise<TBorrowingItemInput[]> {
		return (await this.toolSetItems.listItemIds(toolSetId)).map((itemId) => ({ itemId }));
	}

	/** Validates and narrows the three borrower identity paths. */
	private resolveIdentity(input: TBorrowingCreateInput) {
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
			if (!input.borrowerUserId) throw new BorrowerIdentityError('borrower_user_id is required');
			return { ...empty, borrowerUserId: input.borrowerUserId };
		}
		if (input.branch === 'customer') {
			if (!input.borrowerCustomerId) {
				throw new BorrowerIdentityError('borrower_customer_id is required');
			}
			return { ...empty, borrowerCustomerId: input.borrowerCustomerId };
		}
		// Guest: identity is snapshotted; the schema CHECK needs name, phone and id number.
		if (!input.guestName) throw new GuestIdentityIncompleteError('guest_name');
		if (!input.guestPhone) throw new GuestIdentityIncompleteError('guest_phone');
		if (!input.guestIdNumber) throw new GuestIdentityIncompleteError('guest_id_number');
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
		request: TBorrowingRequestSelect,
		borrowing: TBorrowingView['borrowing'],
		items: TBorrowingItemSelect[],
		events: TBorrowingTimelineEvent[],
		actor: TBorrowingActor,
	): TBorrowingView {
		if (request.borrowerType === 'guest' && !actor.canSeeGuestPii) {
			return {
				...request,
				guestIdNumber: null,
				guestAddressText: null,
				guestIdDocumentRef: null,
				borrowing,
				items,
				events,
				guestIdentityRedacted: true,
			};
		}
		return { ...request, borrowing, items, events, guestIdentityRedacted: false };
	}
}
