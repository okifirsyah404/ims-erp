/**
 * Borrowing state-machine unit tests (S4).
 *
 * Exercises the real {@link BorrowingService} with in-memory repositories, so
 * the **transition matrix, the permission rules, and the sweep idempotency** are
 * pinned without a database. The integration path (real Elysia + guard) is
 * covered separately in `test/authorization/borrowing-authorization.test.ts`.
 *
 * What is being pinned here:
 * - every legal edge is reachable and every illegal edge is a 422;
 * - approval is **skippable only with the permission** — the panic path is
 *   that someone issues an unapproved borrowing by guessing the endpoint;
 * - each physical transition writes exactly one movement and one event, and
 *   the event carries the movement id (the schema CHECK would reject it
 *   otherwise);
 * - returning the last open line moves the header to `returned`, returning one
 *   of several moves it to `partially_returned`;
 * - both sweeps are idempotent: run twice, one outcome.
 */
import { describe, expect, test } from 'bun:test';
import type {
	TBorrowingEventSelect,
	TBorrowingLineSelect,
	TBorrowingSelect,
	TSerialTrackedItemSelect,
} from '@drizzle/schemas/inventory.schema';
import type {
	IBorrowingRepository,
	TBorrowingPaginationRequest,
} from '../../src/app/inventory/contracts/borrowing.repository.interface';
import type { ISerialUnitRepository } from '../../src/app/inventory/contracts/serial-unit.repository.interface';
import type { StockService } from '../../src/app/inventory/services/stock.service';
import {
	BorrowingService,
	isLegalBorrowingTransition,
	monthsBefore,
} from '../../src/app/inventory/services/borrowing.service';
import {
	BorrowingSelfApprovalForbiddenError,
	BorrowingTransitionError,
	GuestIdentityIncompleteError,
	UnitNotAvailableError,
} from '../../src/app/inventory/services/inventory.errors';
import type { TBorrowingActor } from '../../src/app/inventory/services/borrowing.service';

const ORG = 'org-1';
const WAREHOUSE = '01920000-0000-7000-8000-0000000000aa';
const ITEM = '01920000-0000-7000-8000-000000000001';

const NOW = new Date('2026-06-01T00:00:00.000Z');
const FUTURE = new Date('2026-06-15T00:00:00.000Z');
const PAST = new Date('2026-05-01T00:00:00.000Z');

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`;

/** A minimal in-memory borrowing store with the repository's semantics. */
class FakeBorrowingRepository implements IBorrowingRepository {
	readonly borrowings = new Map<string, TBorrowingSelect>();
	readonly lines = new Map<string, TBorrowingLineSelect>();
	readonly events: TBorrowingEventSelect[] = [];
	/** Set to make the next `update` fail as if a concurrent writer won. */
	failNextUpdate = false;

	async paginate(_request: TBorrowingPaginationRequest) {
		return {
			meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
			data: [...this.borrowings.values()],
		};
	}

	async findById(id: string, organizationId: string) {
		const row = this.borrowings.get(id);
		if (!row || row.organizationId !== organizationId) return null;
		return row;
	}

	async findByCode(organizationId: string, code: string) {
		return (
			[...this.borrowings.values()].find(
				(row) => row.organizationId === organizationId && row.code === code,
			) ?? null
		);
	}

	async create(data: Parameters<IBorrowingRepository['create']>[0]) {
		const row = {
			id: nextId('brw'),
			organizationId: data.organizationId ?? null,
			code: data.code,
			status: data.status ?? 'requested',
			purpose: data.purpose ?? 'internal_use',
			borrowerType: data.borrowerType,
			borrowerUserId: data.borrowerUserId ?? null,
			borrowerCustomerId: data.borrowerCustomerId ?? null,
			guestName: data.guestName ?? null,
			guestPhone: data.guestPhone ?? null,
			guestIdType: data.guestIdType ?? null,
			guestIdNumber: data.guestIdNumber ?? null,
			guestAddressText: data.guestAddressText ?? null,
			guestIdDocumentRef: data.guestIdDocumentRef ?? null,
			requestedBy: data.requestedBy ?? null,
			requestedAt: data.requestedAt ?? null,
			approvedBy: null,
			approvedAt: null,
			issuedBy: null,
			issuedAt: null,
			dueAt: data.dueAt,
			closedBy: null,
			closedAt: null,
			notes: data.notes ?? null,
			createdAt: NOW,
			updatedAt: null,
			deletedAt: null,
		} as TBorrowingSelect;
		this.borrowings.set(row.id, row);
		return row;
	}

	async update(
		id: string,
		data: Partial<TBorrowingSelect>,
		expectedStatus: string,
	) {
		if (this.failNextUpdate) {
			this.failNextUpdate = false;
			return null;
		}
		const row = this.borrowings.get(id);
		if (!row || row.status !== expectedStatus) return null;
		Object.assign(row, data);
		return row;
	}

	async listLines(borrowingId: string) {
		return [...this.lines.values()].filter(
			(line) => line.borrowingId === borrowingId,
		);
	}

	async findLine(lineId: string, borrowingId: string) {
		const row = this.lines.get(lineId);
		return row && row.borrowingId === borrowingId ? row : null;
	}

	async createLines(data: readonly Parameters<IBorrowingRepository['createLines']>[0][number][]) {
		const rows = data.map(
			(line) =>
				({
					id: nextId('line'),
					borrowingId: line.borrowingId,
					serialTrackedItemId: line.serialTrackedItemId,
					originWarehouseId: line.originWarehouseId,
					issuedAt: null,
					dueAt: line.dueAt ?? null,
					returnedAt: null,
					returnedCondition: null,
					markedLateAt: null,
					markedLostAt: null,
					lostReportedBy: null,
					siteAddressText: null,
					projectId: null,
					notes: null,
					createdAt: NOW,
					updatedAt: null,
					deletedAt: null,
				}) as TBorrowingLineSelect,
		);
		for (const row of rows) this.lines.set(row.id, row);
		return rows;
	}

	async updateLine(lineId: string, data: Partial<TBorrowingLineSelect>) {
		const row = this.lines.get(lineId);
		if (!row) return null;
		Object.assign(row, data);
		return row;
	}

	async appendEvent(event: Parameters<IBorrowingRepository['appendEvent']>[0]) {
		const row = {
			id: nextId('evt'),
			borrowingId: event.borrowingId,
			borrowingLineId: event.borrowingLineId ?? null,
			eventType: event.eventType,
			stockMovementId: event.stockMovementId ?? null,
			actorUserId: event.actorUserId ?? null,
			occurredAt: event.occurredAt,
			note: event.note ?? null,
		} as TBorrowingEventSelect;
		this.events.push(row);
		return row;
	}

	async listEvents(borrowingId: string) {
		return this.events.filter((event) => event.borrowingId === borrowingId);
	}

	async findDueLines(now: Date, limit: number) {
		return [...this.lines.values()]
			.filter(
				(line) =>
					line.returnedAt === null &&
					line.markedLateAt === null &&
					line.markedLostAt === null &&
					line.dueAt !== null &&
					line.dueAt < now,
			)
			.slice(0, limit)
			.map((line) => {
				const borrowing = this.borrowings.get(line.borrowingId) as TBorrowingSelect;
				return {
					line,
					borrowingId: line.borrowingId,
					organizationId: borrowing.organizationId,
					borrowerType: borrowing.borrowerType,
					guestName: borrowing.guestName,
				};
			});
	}

	async markLineLate(lineId: string, at: Date) {
		const row = this.lines.get(lineId);
		// The idempotency guard lives in the UPDATE predicate, exactly as in SQL.
		if (!row || row.markedLateAt !== null || row.returnedAt !== null) {
			return null;
		}
		row.markedLateAt = at;
		return row;
	}

	async findExpiredGuestBorrowings(cutoff: Date, limit: number) {
		return [...this.borrowings.values()]
			.filter(
				(row) =>
					row.borrowerType === 'guest' &&
					row.guestName !== null &&
					row.closedAt !== null &&
					row.closedAt < cutoff,
			)
			.slice(0, limit);
	}

	async redactGuestPii(id: string) {
		const row = this.borrowings.get(id);
		if (!row || row.guestName === null) return null;
		row.guestName = null;
		row.guestPhone = null;
		row.guestIdType = null;
		row.guestIdNumber = null;
		row.guestAddressText = null;
		row.guestIdDocumentRef = null;
		return row;
	}
}

/** In-memory unit store honouring the custody guards. */
class FakeUnitRepository implements ISerialUnitRepository {
	readonly units = new Map<string, TSerialTrackedItemSelect>();

	seed(status: string, warehouseId: string | null = WAREHOUSE) {
		const unit = {
			id: nextId('unit'),
			organizationId: ORG,
			itemId: ITEM,
			serialNumber: `SN-${this.units.size + 1}`,
			isProvisionalSerial: false,
			assetTag: null,
			status,
			warehouseId,
			binId: null,
			currentBorrowingLineId: null,
			acquiredOn: null,
			warrantyExpiresOn: null,
			purchaseOrderLineId: null,
			customerId: null,
			stockMovementId: null,
			notes: null,
			createdAt: NOW,
			updatedAt: null,
			deletedAt: null,
		} as TSerialTrackedItemSelect;
		this.units.set(unit.id, unit);
		return unit;
	}

	async paginate() {
		return {
			meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
			data: [...this.units.values()],
		};
	}
	async findById(id: string) {
		return this.units.get(id) ?? null;
	}
	async findBySerial() {
		return null;
	}
	async create(): Promise<TSerialTrackedItemSelect> {
		throw new Error('not used');
	}
	async replaceProvisionalSerial() {
		return null;
	}
	async updateStatus(id: string, status: string) {
		const row = this.units.get(id);
		if (!row) return null;
		row.status = status;
		return row;
	}
	async issueToBorrower(id: string, borrowingLineId: string) {
		const row = this.units.get(id);
		if (!row || row.status !== 'in_stock') return null;
		row.status = 'borrowed';
		row.warehouseId = null;
		row.binId = null;
		row.currentBorrowingLineId = borrowingLineId;
		return row;
	}
	async returnFromBorrower(id: string, warehouseId: string, binId: string | null) {
		const row = this.units.get(id);
		if (!row || row.status !== 'borrowed') return null;
		row.status = 'in_stock';
		row.warehouseId = warehouseId;
		row.binId = binId;
		row.currentBorrowingLineId = null;
		return row;
	}
	async markLost(id: string) {
		const row = this.units.get(id);
		if (!row || row.status !== 'borrowed') return null;
		row.status = 'lost';
		row.warehouseId = null;
		row.binId = null;
		row.currentBorrowingLineId = null;
		return row;
	}
}

/** Records every movement posted, so "one physical event, one movement" holds. */
function makeRecordingStockService() {
	const posted: {
		movementType: string;
		warehouseId: string;
		itemId: string;
		quantity: string;
		referenceType?: string | null;
		referenceId?: string | null;
	}[] = [];
	const service = {
		posted,
		async postMovement(input: Record<string, unknown>) {
			posted.push(input as never);
			return {
				movement: { id: nextId('mov') },
				balance: {},
				scopeOrganizationId: ORG,
			};
		},
	} as unknown as StockService & { posted: typeof posted };
	return service;
}

function makeHarness() {
	const borrowings = new FakeBorrowingRepository();
	const units = new FakeUnitRepository();
	const stock = makeRecordingStockService();
	const service = new BorrowingService(
		borrowings,
		units,
		stock,
		// The service owns one transaction; an immediate handler keeps the fake
		// repositories transactional enough for these assertions.
		{
			transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({}),
		} as never,
	);
	return { borrowings, units, stock, service };
}

const fullActor: TBorrowingActor = {
	actorUserId: 'user-1',
	canApprove: true,
	canIssue: true,
	canSeeGuestPii: true,
};

const plainActor: TBorrowingActor = {
	actorUserId: 'user-2',
	canApprove: false,
	canIssue: false,
	canSeeGuestPii: false,
};

/** Raises a borrowing against freshly seeded in-stock units. */
async function raise(
	harness: ReturnType<typeof makeHarness>,
	count = 1,
	actor: TBorrowingActor = fullActor,
) {
	const unitIds = Array.from({ length: count }, () => harness.units.seed('in_stock').id);
	const view = await harness.service.create(
		{
			branch: 'user',
			purpose: 'internal_use',
			dueAt: FUTURE,
			borrowerUserId: 'borrower-1',
			lines: unitIds.map((serialTrackedItemId) => ({ serialTrackedItemId })),
		},
		ORG,
		actor,
	);
	return { view, unitIds };
}

describe('isLegalBorrowingTransition', () => {
	test('allows the documented happy path', () => {
		expect(isLegalBorrowingTransition('requested', 'approved')).toBe(true);
		expect(isLegalBorrowingTransition('approved', 'issued')).toBe(true);
		expect(isLegalBorrowingTransition('issued', 'partially_returned')).toBe(true);
		expect(isLegalBorrowingTransition('partially_returned', 'returned')).toBe(true);
		expect(isLegalBorrowingTransition('returned', 'closed')).toBe(true);
	});

	test('allows skipping approval from requested straight to issued', () => {
		// The permission check, not the matrix, decides WHO may skip.
		expect(isLegalBorrowingTransition('requested', 'issued')).toBe(true);
	});

	test('refuses every backwards and terminal edge', () => {
		expect(isLegalBorrowingTransition('approved', 'requested')).toBe(false);
		expect(isLegalBorrowingTransition('issued', 'approved')).toBe(false);
		expect(isLegalBorrowingTransition('closed', 'issued')).toBe(false);
		expect(isLegalBorrowingTransition('cancelled', 'requested')).toBe(false);
		expect(isLegalBorrowingTransition('rejected', 'issued')).toBe(false);
		expect(isLegalBorrowingTransition('returned', 'issued')).toBe(false);
	});

	test('refuses an unknown status without throwing', () => {
		// The status column is text; a stray value must fall through to "illegal".
		expect(isLegalBorrowingTransition('garbage', 'issued')).toBe(false);
	});
});

describe('create', () => {
	test('captures the unit’s warehouse as the origin and writes a requested event', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness, 2);

		expect(view.status).toBe('requested');
		expect(view.lines).toHaveLength(2);
		for (const line of view.lines) {
			expect(line.originWarehouseId).toBe(WAREHOUSE);
		}
		expect(view.events.map((event) => event.eventType)).toEqual(['requested']);
		// Nothing physical happened, so no movement was posted.
		expect(harness.stock.posted).toHaveLength(0);
	});

	test('refuses a guest without a phone or id number', async () => {
		const harness = makeHarness();
		const unit = harness.units.seed('in_stock');
		await expect(
			harness.service.create(
				{
					branch: 'guest',
					purpose: 'rental',
					dueAt: FUTURE,
					guestName: 'Budi',
					guestPhone: null,
					guestIdNumber: '123',
					lines: [{ serialTrackedItemId: unit.id }],
				},
				ORG,
				fullActor,
			),
		).rejects.toBeInstanceOf(GuestIdentityIncompleteError);
	});

	test('refuses a unit that is not in stock', async () => {
		const harness = makeHarness();
		const unit = harness.units.seed('borrowed');
		await expect(
			harness.service.create(
				{
					branch: 'user',
					purpose: 'internal_use',
					dueAt: FUTURE,
					borrowerUserId: 'b',
					lines: [{ serialTrackedItemId: unit.id }],
				},
				ORG,
				fullActor,
			),
		).rejects.toBeInstanceOf(UnitNotAvailableError);
	});

	test('refuses the same unit twice in one borrowing', async () => {
		const harness = makeHarness();
		const unit = harness.units.seed('in_stock');
		await expect(
			harness.service.create(
				{
					branch: 'user',
					purpose: 'internal_use',
					dueAt: FUTURE,
					borrowerUserId: 'b',
					lines: [
						{ serialTrackedItemId: unit.id },
						{ serialTrackedItemId: unit.id },
					],
				},
				ORG,
				fullActor,
			),
		).rejects.toThrow();
	});
});

describe('issue', () => {
	test('moves custody, posts one borrowing_out per line, and links the event', async () => {
		const harness = makeHarness();
		const { view, unitIds } = await raise(harness, 2);
		await harness.service.approve(view.id, ORG, fullActor);
		const issued = await harness.service.issue(view.id, ORG, fullActor);

		expect(issued.status).toBe('issued');
		// Custody left the warehouse: no warehouse, no bin, line ref set.
		for (const unitId of unitIds) {
			const unit = harness.units.units.get(unitId);
			expect(unit?.status).toBe('borrowed');
			expect(unit?.warehouseId).toBeNull();
			expect(unit?.currentBorrowingLineId).not.toBeNull();
		}
		// One movement per unit, all typed borrowing_out and ref'd to the doc.
		expect(harness.stock.posted).toHaveLength(2);
		for (const movement of harness.stock.posted) {
			expect(movement.movementType).toBe('borrowing_out');
			expect(movement.quantity).toBe('1');
			expect(movement.referenceType).toBe('borrowing');
			expect(movement.referenceId).toBe(view.id);
			expect(movement.warehouseId).toBe(WAREHOUSE);
		}
		// Every physical event carries a movement id and the schema CHECK agrees.
		const issuedEvents = harness.borrowings.events.filter(
			(event) => event.eventType === 'issued',
		);
		expect(issuedEvents).toHaveLength(2);
		for (const event of issuedEvents) {
			expect(event.stockMovementId).not.toBeNull();
		}
	});

	test('refuses to skip approval without borrowing:issue or :approve', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness);
		await expect(
			harness.service.issue(view.id, ORG, plainActor),
		).rejects.toBeInstanceOf(BorrowingTransitionError);
		// And nothing was issued.
		expect(harness.stock.posted).toHaveLength(0);
	});

	test('allows skipping approval for a caller holding borrowing:issue', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness);
		const issued = await harness.service.issue(view.id, ORG, {
			...plainActor,
			canIssue: true,
		});
		expect(issued.status).toBe('issued');
	});

	test('refuses to issue twice', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness);
		await harness.service.issue(view.id, ORG, fullActor);
		await expect(
			harness.service.issue(view.id, ORG, fullActor),
		).rejects.toBeInstanceOf(BorrowingTransitionError);
	});

	test('refuses to issue a rejected borrowing', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness);
		await harness.service.reject(view.id, ORG, fullActor);
		await expect(
			harness.service.issue(view.id, ORG, fullActor),
		).rejects.toBeInstanceOf(BorrowingTransitionError);
	});
});

describe('return', () => {
	test('restores the unit to its origin and moves the header to returned', async () => {
		const harness = makeHarness();
		const { view, unitIds } = await raise(harness);
		await harness.service.issue(view.id, ORG, fullActor);
		const returned = await harness.service.returnLines(view.id, ORG, fullActor, {
			condition: 'good',
		});

		expect(returned.status).toBe('returned');
		const unit = harness.units.units.get(unitIds[0] as string);
		expect(unit?.status).toBe('in_stock');
		expect(unit?.warehouseId).toBe(WAREHOUSE);
		expect(unit?.currentBorrowingLineId).toBeNull();

		const inbound = harness.stock.posted.filter(
			(movement) => movement.movementType === 'borrowing_in',
		);
		expect(inbound).toHaveLength(1);
		expect(inbound[0]?.warehouseId).toBe(WAREHOUSE);
	});

	test('moves to partially_returned when one of two lines comes back', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness, 2);
		await harness.service.issue(view.id, ORG, fullActor);
		const lines = await harness.borrowings.listLines(view.id);
		const partial = await harness.service.returnLines(view.id, ORG, fullActor, {
			lineId: lines[0]?.id,
			condition: 'good',
		});
		expect(partial.status).toBe('partially_returned');

		const final = await harness.service.returnLines(view.id, ORG, fullActor, {
			condition: 'good',
		});
		expect(final.status).toBe('returned');
	});

	test('refuses to return a borrowing that was never issued', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness);
		await expect(
			harness.service.returnLines(view.id, ORG, fullActor, { condition: 'good' }),
		).rejects.toBeInstanceOf(BorrowingTransitionError);
	});
});

describe('markLost', () => {
	test('marks the unit lost, reduces stock at the origin, and links the event', async () => {
		const harness = makeHarness();
		const { view, unitIds } = await raise(harness);
		await harness.service.issue(view.id, ORG, fullActor);
		const [line] = await harness.borrowings.listLines(view.id);

		await harness.service.markLost(view.id, ORG, fullActor, {
			lineId: line?.id as string,
		});

		const unit = harness.units.units.get(unitIds[0] as string);
		expect(unit?.status).toBe('lost');
		// The loss is NOT restored to a warehouse — it is gone from stock.
		expect(unit?.warehouseId).toBeNull();

		// The reduction hits the warehouse the unit left from, at quantity 1.
		const loss = harness.stock.posted.filter(
			(movement) => movement.movementType === 'adjustment_out',
		);
		expect(loss).toHaveLength(1);
		expect(loss[0]?.warehouseId).toBe(WAREHOUSE);
		expect(loss[0]?.quantity).toBe('1');

		const lostEvent = harness.borrowings.events.find(
			(event) => event.eventType === 'marked_lost',
		);
		expect(lostEvent?.stockMovementId).not.toBeNull();
	});

	test('refuses to report a loss on a borrowing that was not issued', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness);
		const [line] = await harness.borrowings.listLines(view.id);
		await expect(
			harness.service.markLost(view.id, ORG, fullActor, {
				lineId: line?.id as string,
			}),
		).rejects.toBeInstanceOf(BorrowingTransitionError);
	});
});

describe('approve', () => {
	test('refuses self-approval without the bypass permission', async () => {
		const harness = makeHarness();
		// Raised by user-2, so approving AS user-2 is the self-approval case.
		const { view } = await raise(harness, 1, plainActor);
		await expect(
			harness.service.approve(view.id, ORG, {
				...plainActor,
				actorUserId: plainActor.actorUserId,
			}),
		).rejects.toBeInstanceOf(BorrowingSelfApprovalForbiddenError);
	});

	test('allows self-approval for a caller holding the bypass', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness, 1, fullActor);
		const approved = await harness.service.approve(view.id, ORG, fullActor);
		expect(approved.status).toBe('approved');
	});
});

describe('late sweep', () => {
	test('marks an overdue line once and appends a single auto event', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness);
		await harness.service.issue(view.id, ORG, fullActor);
		// Wind the line's due date into the past.
		const [line] = await harness.borrowings.listLines(view.id);
		if (line) line.dueAt = PAST;

		const first = await harness.service.sweepLate(NOW);
		expect(first.processed).toBe(1);

		const lateEvents = () =>
			harness.borrowings.events.filter((event) => event.eventType === 'marked_late');
		expect(lateEvents()).toHaveLength(1);
		// Automated: no actor, and no movement (nothing physical moved).
		expect(lateEvents()[0]?.actorUserId).toBeNull();
		expect(lateEvents()[0]?.stockMovementId).toBeNull();
		expect(lateEvents()[0]?.note).toBe('auto');
	});

	test('is idempotent: running twice produces one event', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness);
		await harness.service.issue(view.id, ORG, fullActor);
		const [line] = await harness.borrowings.listLines(view.id);
		if (line) line.dueAt = PAST;

		await harness.service.sweepLate(NOW);
		const second = await harness.service.sweepLate(NOW);
		expect(second.processed).toBe(0);
		expect(
			harness.borrowings.events.filter(
				(event) => event.eventType === 'marked_late',
			),
		).toHaveLength(1);
	});

	test('skips a line that is already returned', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness);
		await harness.service.issue(view.id, ORG, fullActor);
		const [line] = await harness.borrowings.listLines(view.id);
		if (line) {
			line.dueAt = PAST;
			line.returnedAt = NOW;
		}
		const result = await harness.service.sweepLate(NOW);
		expect(result.processed).toBe(0);
	});
});

describe('guest retention sweep', () => {
	async function guestBorrowing(closedAt: Date) {
		const harness = makeHarness();
		const unit = harness.units.seed('in_stock');
		const created = await harness.service.create(
			{
				branch: 'guest',
				purpose: 'rental',
				dueAt: FUTURE,
				guestName: 'Budi Santoso',
				guestPhone: '0812345678',
				guestIdNumber: '3174099999990001',
				guestAddressText: 'Jl. Merdeka 1',
				guestIdType: 'ktp',
				lines: [{ serialTrackedItemId: unit.id }],
			},
			ORG,
			fullActor,
		);
		const row = harness.borrowings.borrowings.get(created.id);
		if (row) {
			row.status = 'closed';
			row.closedAt = closedAt;
		}
		return { harness, id: created.id };
	}

	test('nulls PII past the window and keeps the row and timeline', async () => {
		const closed = new Date('2024-01-01T00:00:00.000Z');
		const { harness, id } = await guestBorrowing(closed);
		const result = await harness.service.sweepGuestRetention(24, NOW);
		expect(result.processed).toBe(1);

		const row = harness.borrowings.borrowings.get(id);
		expect(row?.guestName).toBeNull();
		expect(row?.guestIdNumber).toBeNull();
		expect(row?.guestPhone).toBeNull();
		// The borrowing itself survives, and so does its trail.
		expect(row).toBeDefined();
		expect(harness.borrowings.events.length).toBeGreaterThan(0);
	});

	test('leaves PII inside the window alone', async () => {
		const recent = new Date('2026-05-01T00:00:00.000Z');
		const { harness, id } = await guestBorrowing(recent);
		const result = await harness.service.sweepGuestRetention(24, NOW);
		expect(result.processed).toBe(0);
		expect(harness.borrowings.borrowings.get(id)?.guestName).toBe('Budi Santoso');
	});

	test('is idempotent: a second run redacts nothing', async () => {
		const closed = new Date('2024-01-01T00:00:00.000Z');
		const { harness } = await guestBorrowing(closed);
		await harness.service.sweepGuestRetention(24, NOW);
		const second = await harness.service.sweepGuestRetention(24, NOW);
		expect(second.processed).toBe(0);
	});
});

describe('guest PII projection', () => {
	test('redacts the identity fields for a caller without the tier', async () => {
		const harness = makeHarness();
		const unit = harness.units.seed('in_stock');
		const created = await harness.service.create(
			{
				branch: 'guest',
				purpose: 'rental',
				dueAt: FUTURE,
				guestName: 'Budi',
				guestPhone: '0812',
				guestIdNumber: '3174099999990001',
				guestAddressText: 'Jl. Merdeka 1',
				lines: [{ serialTrackedItemId: unit.id }],
			},
			ORG,
			fullActor,
		);
		const redacted = await harness.service.getById(
			created.id,
			ORG,
			plainActor,
		);
		expect(redacted.guestIdentityRedacted).toBe(true);
		expect(redacted.guestIdNumber).toBeNull();
		expect(redacted.guestAddressText).toBeNull();
		// The name is not in the restricted tier: the list needs to show who has
		// the tool, and a name alone does not identify a person to an outsider.
		expect(redacted.guestName).toBe('Budi');
	});

	test('shows the identity fields to a caller holding the tier', async () => {
		const harness = makeHarness();
		const unit = harness.units.seed('in_stock');
		const created = await harness.service.create(
			{
				branch: 'guest',
				purpose: 'rental',
				dueAt: FUTURE,
				guestName: 'Budi',
				guestPhone: '0812',
				guestIdNumber: '3174099999990001',
				guestAddressText: 'Jl. Merdeka 1',
				lines: [{ serialTrackedItemId: unit.id }],
			},
			ORG,
			fullActor,
		);
		const full = await harness.service.getById(created.id, ORG, fullActor);
		expect(full.guestIdentityRedacted).toBe(false);
		expect(full.guestIdNumber).toBe('3174099999990001');
	});
});

describe('monthsBefore', () => {
	test('subtracts whole months across a year boundary', () => {
		expect(monthsBefore(new Date('2026-01-15T00:00:00.000Z'), 24)).toEqual(
			new Date('2024-01-15T00:00:00.000Z'),
		);
	});

	test('clamps the day when the target month is shorter', () => {
		// 31 March minus one month is 28/29 February, not 3 March.
		const result = monthsBefore(new Date('2026-03-31T00:00:00.000Z'), 1);
		expect(result.getUTCMonth()).toBe(1);
		expect(result.getUTCDate()).toBe(28);
	});
});
