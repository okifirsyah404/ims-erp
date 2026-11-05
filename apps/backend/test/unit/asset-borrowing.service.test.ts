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
	TAssetMovementSelect,
	TAssetSelect,
	TBorrowingEventSelect,
	TBorrowingLineSelect,
	TBorrowingSelect,
} from '@drizzle/schemas/asset.schema';
import type {
	IBorrowingRepository,
	TBorrowingPaginationRequest,
} from '../../src/app/assets/contracts/borrowing.repository.interface';
import type { IAssetRepository } from '../../src/app/assets/contracts/asset.repository.interface';
import type { IAssetOperationsRepository } from '../../src/app/assets/contracts/asset-operations.repository.interface';
import type { WarehouseService } from '../../src/app/inventory/services/warehouse.service';
import { AssetOperationsService } from '../../src/app/assets/services/asset-operations.service';
import {
	BorrowingService,
	isLegalBorrowingTransition,
	monthsBefore,
} from '../../src/app/assets/services/borrowing.service';
import {
	BorrowingSelfApprovalForbiddenError,
	BorrowingTransitionError,
	GuestIdentityIncompleteError,
	UnitNotAvailableError,
} from '../../src/app/assets/errors/borrowing.errors';
import type { TBorrowingActor } from '../../src/app/assets/services/borrowing.service';
import { createNumberingDouble } from '../helpers/numbering-double';
import { AuditWriterDouble } from '../helpers/audit-writer-double';

const ORG = 'org-1';
const WAREHOUSE = '01920000-0000-7000-8000-0000000000aa';
const STORAGE = '01920000-0000-7000-8000-0000000000ab';

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
			toolSetId: data.toolSetId ?? null,
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
					assetId: line.assetId,
					originWarehouseId: line.originWarehouseId ?? null,
					originStorageId: line.originStorageId ?? null,
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
			assetMovementId: event.assetMovementId ?? null,
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

/** In-memory asset register honouring the custody guards. */
class FakeAssetRepository {
	readonly assets = new Map<string, TAssetSelect>();

	seed(
		status = 'ready',
		warehouseId: string | null = WAREHOUSE,
		storageId: string | null = STORAGE,
	) {
		const asset = {
			id: nextId('asset'),
			organizationId: ORG,
			code: `AST-${this.assets.size + 1}`,
			name: `Tool ${this.assets.size + 1}`,
			serialNumber: `SN-${this.assets.size + 1}`,
			status,
			condition: 'good',
			warehouseId,
			storageId,
			locationDescription: null,
			custodianEmployeeId: null,
			borrowedSince: null,
			createdAt: NOW,
			updatedAt: null,
			deletedAt: null,
		} as unknown as TAssetSelect;
		this.assets.set(asset.id, asset);
		return asset;
	}

	async findById(id: string) {
		return this.assets.get(id) ?? null;
	}

	async update(id: string, data: Record<string, unknown>) {
		const row = this.assets.get(id);
		if (!row) return null;
		Object.assign(row, data);
		return row;
	}
}

/** In-memory movement ledger plus the custody reads the reconcile performs. */
class FakeOperationsRepository {
	readonly movements: TAssetMovementSelect[] = [];

	constructor(private readonly borrowings: FakeBorrowingRepository) {}

	async findOpenBorrowingLine(assetId: string) {
		const line = [...this.borrowings.lines.values()].find(
			(row) =>
				row.assetId === assetId &&
				row.issuedAt !== null &&
				row.returnedAt === null &&
				row.markedLostAt === null &&
				row.deletedAt === null,
		);
		return line ? { issuedAt: line.issuedAt } : null;
	}

	async hasOpenMaintenance() {
		return false;
	}

	async createMovement(data: Record<string, unknown>) {
		const row = {
			id: nextId('mov'),
			...data,
		} as unknown as TAssetMovementSelect;
		this.movements.push(row);
		return row;
	}

	async findToolSetById() {
		return null;
	}
	async listToolSetItems() {
		return [];
	}
	async updateToolSet() {
		return null;
	}
}

/** Inventory owns warehouses; Assets only ever calls the two contract methods. */
const warehouses = {
	assertWarehouseReachableByOrg: async () => true,
	assertStorageInWarehouse: async () => undefined,
} as unknown as WarehouseService;

function makeHarness() {
	const borrowings = new FakeBorrowingRepository();
	const assets = new FakeAssetRepository();
	const operationsRepository = new FakeOperationsRepository(borrowings);
	// The services own one transaction each; an immediate handler keeps the fake
	// repositories transactional enough for these assertions.
	const database = {
		transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({}),
	} as never;
	const operations = new AssetOperationsService(
		assets as unknown as IAssetRepository,
		operationsRepository as unknown as IAssetOperationsRepository,
		createNumberingDouble(),
		new AuditWriterDouble(),
		warehouses,
		database,
	);
	const service = new BorrowingService(
		borrowings,
		assets as unknown as IAssetRepository,
		operations,
		createNumberingDouble(),
		new AuditWriterDouble(),
		database,
	);
	return { borrowings, assets, operationsRepository, service };
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

/** Raises a borrowing against freshly seeded ready assets. */
async function raise(
	harness: ReturnType<typeof makeHarness>,
	count = 1,
	actor: TBorrowingActor = fullActor,
) {
	const assetIds = Array.from({ length: count }, () =>
		harness.assets.seed('ready').id,
	);
	const view = await harness.service.create(
		{
			branch: 'user',
			purpose: 'internal_use',
			dueAt: FUTURE,
			borrowerUserId: 'borrower-1',
			lines: assetIds.map((assetId) => ({ assetId })),
		},
		ORG,
		actor,
	);
	return { view, assetIds };
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
	test('captures the asset’s location as the origin and writes a requested event', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness, 2);

		expect(view.status).toBe('requested');
		expect(view.lines).toHaveLength(2);
		for (const line of view.lines) {
			expect(line.originWarehouseId).toBe(WAREHOUSE);
			expect(line.originStorageId).toBe(STORAGE);
		}
		expect(view.events.map((event) => event.eventType)).toEqual(['requested']);
		// Nothing physical happened, so no movement was written.
		expect(harness.operationsRepository.movements).toHaveLength(0);
	});

	test('refuses a guest without a phone or id number', async () => {
		const harness = makeHarness();
		const asset = harness.assets.seed('ready');
		await expect(
			harness.service.create(
				{
					branch: 'guest',
					purpose: 'rental',
					dueAt: FUTURE,
					guestName: 'Budi',
					guestPhone: null,
					guestIdNumber: '123',
					lines: [{ assetId: asset.id }],
				},
				ORG,
				fullActor,
			),
		).rejects.toBeInstanceOf(GuestIdentityIncompleteError);
	});

	test('refuses an asset that is not ready', async () => {
		const harness = makeHarness();
		const asset = harness.assets.seed('borrowed');
		await expect(
			harness.service.create(
				{
					branch: 'user',
					purpose: 'internal_use',
					dueAt: FUTURE,
					borrowerUserId: 'b',
					lines: [{ assetId: asset.id }],
				},
				ORG,
				fullActor,
			),
		).rejects.toBeInstanceOf(UnitNotAvailableError);
	});

	test('refuses the same asset twice in one borrowing', async () => {
		const harness = makeHarness();
		const asset = harness.assets.seed('ready');
		await expect(
			harness.service.create(
				{
					branch: 'user',
					purpose: 'internal_use',
					dueAt: FUTURE,
					borrowerUserId: 'b',
					lines: [{ assetId: asset.id }, { assetId: asset.id }],
				},
				ORG,
				fullActor,
			),
		).rejects.toThrow();
	});
});

describe('issue', () => {
	test('moves custody, writes one borrow_out per line, and links the event', async () => {
		const harness = makeHarness();
		const { view, assetIds } = await raise(harness, 2);
		await harness.service.approve(view.id, ORG, fullActor);
		const issued = await harness.service.issue(view.id, ORG, fullActor);

		expect(issued.status).toBe('issued');
		// Custody left the warehouse: no location, custody timestamp set.
		for (const assetId of assetIds) {
			const asset = harness.assets.assets.get(assetId);
			expect(asset?.status).toBe('borrowed');
			expect(asset?.warehouseId).toBeNull();
			expect(asset?.storageId).toBeNull();
			expect(asset?.borrowedSince).not.toBeNull();
		}
		// One movement per asset, all borrow_out from the origin warehouse.
		expect(harness.operationsRepository.movements).toHaveLength(2);
		for (const movement of harness.operationsRepository.movements) {
			expect(movement.movementType).toBe('borrow_out');
			expect(movement.fromWarehouseId).toBe(WAREHOUSE);
			expect(movement.fromStorageId).toBe(STORAGE);
		}
		// Every physical event carries a movement id and the schema CHECK agrees.
		const issuedEvents = harness.borrowings.events.filter(
			(event) => event.eventType === 'issued',
		);
		expect(issuedEvents).toHaveLength(2);
		for (const event of issuedEvents) {
			expect(event.assetMovementId).not.toBeNull();
		}
	});

	test('refuses to skip approval without borrowing:issue or :approve', async () => {
		const harness = makeHarness();
		const { view } = await raise(harness);
		await expect(
			harness.service.issue(view.id, ORG, plainActor),
		).rejects.toBeInstanceOf(BorrowingTransitionError);
		// And nothing was issued.
		expect(harness.operationsRepository.movements).toHaveLength(0);
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
	test('restores the asset to its origin and moves the header to returned', async () => {
		const harness = makeHarness();
		const { view, assetIds } = await raise(harness);
		await harness.service.issue(view.id, ORG, fullActor);
		const returned = await harness.service.returnLines(view.id, ORG, fullActor, {
			condition: 'good',
		});

		expect(returned.status).toBe('returned');
		const asset = harness.assets.assets.get(assetIds[0] as string);
		expect(asset?.status).toBe('ready');
		expect(asset?.warehouseId).toBe(WAREHOUSE);
		expect(asset?.storageId).toBe(STORAGE);
		expect(asset?.borrowedSince).toBeNull();

		const inbound = harness.operationsRepository.movements.filter(
			(movement) => movement.movementType === 'borrow_return',
		);
		expect(inbound).toHaveLength(1);
		expect(inbound[0]?.toWarehouseId).toBe(WAREHOUSE);
		expect(inbound[0]?.toStorageId).toBe(STORAGE);
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
	test('parks the asset as lost and links the movement event', async () => {
		const harness = makeHarness();
		const { view, assetIds } = await raise(harness);
		await harness.service.issue(view.id, ORG, fullActor);
		const [line] = await harness.borrowings.listLines(view.id);

		await harness.service.markLost(view.id, ORG, fullActor, {
			lineId: line?.id as string,
		});

		const asset = harness.assets.assets.get(assetIds[0] as string);
		expect(asset?.status).toBe('lost');
		// The loss is NOT restored to a warehouse — it is gone.
		expect(asset?.warehouseId).toBeNull();

		const loss = harness.operationsRepository.movements.filter(
			(movement) => movement.movementType === 'lost',
		);
		expect(loss).toHaveLength(1);

		const lostEvent = harness.borrowings.events.find(
			(event) => event.eventType === 'marked_lost',
		);
		expect(lostEvent?.assetMovementId).not.toBeNull();
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
		expect(lateEvents()[0]?.assetMovementId).toBeNull();
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
		const asset = harness.assets.seed('ready');
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
				lines: [{ assetId: asset.id }],
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
		const asset = harness.assets.seed('ready');
		const created = await harness.service.create(
			{
				branch: 'guest',
				purpose: 'rental',
				dueAt: FUTURE,
				guestName: 'Budi',
				guestPhone: '0812',
				guestIdNumber: '3174099999990001',
				guestAddressText: 'Jl. Merdeka 1',
				lines: [{ assetId: asset.id }],
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
		const asset = harness.assets.seed('ready');
		const created = await harness.service.create(
			{
				branch: 'guest',
				purpose: 'rental',
				dueAt: FUTURE,
				guestName: 'Budi',
				guestPhone: '0812',
				guestIdNumber: '3174099999990001',
				guestAddressText: 'Jl. Merdeka 1',
				lines: [{ assetId: asset.id }],
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
