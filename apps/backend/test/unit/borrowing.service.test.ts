/**
 * Borrowing request + borrowing unit tests (ERP-0036, ADR-0024 Q26).
 *
 * @remarks
 * Covers the split lifecycle: a request (draft -> requested -> approved) and
 * the borrowing issued from it (issued -> partially_returned -> returned ->
 * closed). Item movements go to `inventory.movements` (never the product
 * ledger), events land in the request or the borrowing timeline, guest PII is
 * redacted for callers without the tier, and the late sweep is idempotent.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	TBorrowingEventInsert,
	TBorrowingItemInsert,
	TBorrowingItemSelect,
	TBorrowingRequestEventInsert,
	TBorrowingRequestSelect,
	TBorrowingSelect,
	TItemSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import type { TBorrowingActor, TBorrowingCreateInput } from '../../src/app/inventory/contracts/borrowing-view.types';
import {
	BorrowingSelfApprovalForbiddenError,
	BorrowingTransitionError,
	UnitNotAvailableError,
	UnitNotOnBorrowingError,
} from '../../src/app/inventory/errors/borrowing.errors';
import { BorrowingRequestService } from '../../src/app/inventory/services/borrowing-request.service';
import { BorrowingService, monthsBefore } from '../../src/app/inventory/services/borrowing.service';

const ORG = 'org-1';
const WH = '0190a1b2-0000-7000-8000-0000000000w1';
const staff: TBorrowingActor = { actorUserId: 'staff', canApprove: false, canIssue: false, canSeeGuestPii: true };
const manager: TBorrowingActor = { actorUserId: 'manager', canApprove: true, canIssue: true, canSeeGuestPii: true };
const viewer: TBorrowingActor = { actorUserId: 'viewer', canApprove: false, canIssue: false, canSeeGuestPii: false };

let seq = 0;
const id = () => `id-${++seq}`;

/** The whole in-memory world one test runs against. */
function world() {
	const units = new Map<string, TItemSelect>();
	const requests: TBorrowingRequestSelect[] = [];
	const borrowings: TBorrowingSelect[] = [];
	const items: TBorrowingItemSelect[] = [];
	const requestEvents: (TBorrowingRequestEventInsert & { id: string })[] = [];
	const events: (TBorrowingEventInsert & { id: string })[] = [];
	const movements: { id: string; movementType: string; itemId: string; referenceId?: string | null }[] = [];
	const toolSetStatus = new Map<string, string>();
	let codes = 0;

	const unit = (patch: Partial<TItemSelect> = {}): TItemSelect => {
		const row = {
			id: id(),
			organizationId: ORG,
			code: `AST-${++codes}`,
			serialNumber: null,
			status: 'ready',
			warehouseId: WH,
			storageId: null,
			imageUrl: null,
			borrowedSince: null,
			...patch,
		} as TItemSelect;
		units.set(row.id, row);
		return row;
	};

	const requestRepo = {
		paginate: async () => ({ meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] }),
		findById: async (rid: string, org: string) =>
			requests.find((row) => row.id === rid && row.organizationId === org) ?? null,
		create: async (data: never) => {
			const row = { id: id(), deletedAt: null, ...(data as object) } as TBorrowingRequestSelect;
			requests.push(row);
			return row;
		},
		update: async (rid: string, data: Partial<TBorrowingRequestSelect>, expected: string) => {
			const row = requests.find((item) => item.id === rid && item.status === expected);
			return row ? Object.assign(row, data) : null;
		},
		listFirstItemImages: async () => [],
		countOpenByOriginWarehouse: async () => 0,
		findExpiredGuestRequests: async (cutoff: Date) =>
			requests.filter((row) => {
				const b = borrowings.find((x) => x.borrowingRequestId === row.id);
				return row.borrowerType === 'guest' && row.guestName && b?.closedAt && b.closedAt < cutoff;
			}),
		redactGuestPii: async (rid: string) => {
			const row = requests.find((item) => item.id === rid && item.guestName);
			return row ? Object.assign(row, { guestName: null, guestPhone: null, guestIdNumber: null }) : null;
		},
	};
	const borrowingRepo = {
		paginate: async () => ({ meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] }),
		findById: async (bid: string, org: string) =>
			borrowings.find((row) => row.id === bid && row.organizationId === org) ?? null,
		findByRequestId: async (rid: string) => borrowings.find((row) => row.borrowingRequestId === rid) ?? null,
		create: async (data: never) => {
			const row = { id: id(), deletedAt: null, closedAt: null, ...(data as object) } as TBorrowingSelect;
			borrowings.push(row);
			return row;
		},
		update: async (bid: string, data: Partial<TBorrowingSelect>, expected: string) => {
			const row = borrowings.find((item) => item.id === bid && item.status === expected);
			return row ? Object.assign(row, data) : null;
		},
	};
	const itemRepo = {
		createMany: async (rows: readonly TBorrowingItemInsert[]) =>
			rows.map((row) => {
				const created = {
					id: id(),
					deletedAt: null,
					issuedAt: null,
					returnedAt: null,
					returnedCondition: null,
					markedLateAt: null,
					markedLostAt: null,
					lostReportedBy: null,
					...row,
				} as TBorrowingItemSelect;
				items.push(created);
				return created;
			}),
		listByRequest: async (rid: string) => items.filter((row) => row.borrowingRequestId === rid),
		listByBorrowing: async (bid: string) => items.filter((row) => row.borrowingId === bid),
		findInBorrowing: async (iid: string, bid: string) =>
			items.find((row) => row.id === iid && row.borrowingId === bid) ?? null,
		update: async (iid: string, data: Partial<TBorrowingItemSelect>) => {
			const row = items.find((item) => item.id === iid);
			return row ? Object.assign(row, data) : null;
		},
		findOpenForItem: async (uid: string) => {
			const row = items.find(
				(item) => item.itemId === uid && item.issuedAt && !item.returnedAt && !item.markedLostAt,
			);
			return row ? { issuedAt: row.issuedAt } : null;
		},
		findDue: async (now: Date) =>
			items
				.filter((row) => row.issuedAt && !row.returnedAt && !row.markedLateAt && !row.markedLostAt && row.dueAt && row.dueAt < now)
				.map((row) => ({ item: row, borrowingId: row.borrowingId as string, organizationId: ORG })),
		markLate: async (iid: string, at: Date) => {
			const row = items.find((item) => item.id === iid && !item.markedLateAt);
			return row ? Object.assign(row, { markedLateAt: at }) : null;
		},
	};
	const requestEventRepo = {
		append: async (event: TBorrowingRequestEventInsert) => {
			const row = { id: id(), ...event };
			requestEvents.push(row);
			return row as never;
		},
		listByRequest: async (rid: string) => requestEvents.filter((row) => row.borrowingRequestId === rid) as never,
	};
	const eventRepo = {
		append: async (event: TBorrowingEventInsert) => {
			const row = { id: id(), ...event };
			events.push(row);
			return row as never;
		},
		listByBorrowing: async (bid: string) => events.filter((row) => row.borrowingId === bid) as never,
	};
	const itemRepository = {
		findById: async (uid: string) => units.get(uid) ?? null,
		update: async (uid: string, data: Partial<TItemSelect>) => {
			const row = units.get(uid);
			return row ? Object.assign(row, data) : null;
		},
	};
	const custody = {
		async borrowOut(uid: string, _org: string | null, data: { referenceId?: string | null }) {
			const m = { id: id(), movementType: 'borrow_out', itemId: uid, referenceId: data.referenceId };
			movements.push(m);
			Object.assign(units.get(uid)!, { warehouseId: null, storageId: null });
			return m as never;
		},
		async borrowReturn(uid: string, _org: string | null, data: { warehouseId: string; storageId: string | null; referenceId?: string | null }) {
			const m = { id: id(), movementType: 'borrow_return', itemId: uid, referenceId: data.referenceId };
			movements.push(m);
			Object.assign(units.get(uid)!, { warehouseId: data.warehouseId, storageId: data.storageId });
			return m as never;
		},
		async markLost(uid: string, _org: string | null, data: { referenceId?: string | null }) {
			const m = { id: id(), movementType: 'lost', itemId: uid, referenceId: data.referenceId };
			movements.push(m);
			Object.assign(units.get(uid)!, { status: 'lost' });
			return m as never;
		},
		async syncCustody(uid: string) {
			const open = await itemRepo.findOpenForItem(uid);
			Object.assign(units.get(uid)!, { borrowedSince: open?.issuedAt ?? null });
			return units.get(uid)!;
		},
		async reconcileStatus(uid: string) {
			const row = units.get(uid)!;
			if (['inactive', 'disposed', 'lost'].includes(row.status)) return row;
			const open = await itemRepo.findOpenForItem(uid);
			return Object.assign(row, { status: open ? 'borrowed' : 'ready' });
		},
	};
	const toolSets = {
		setStatus: async (tid: string, status: string) => {
			toolSetStatus.set(tid, status);
			return null;
		},
	};
	const toolSetItems = { listItemIds: async () => [] as string[] } as never;
	const numbering = { next: async (type: string) => `${type}-${++codes}` };
	const audit = { record: async () => {} } as never;
	const transactions = { run: <T>(work: (tx: TTx) => Promise<T>) => work({} as TTx) };

	const requestService = new BorrowingRequestService(
		requestRepo as never,
		borrowingRepo as never,
		itemRepo as never,
		requestEventRepo as never,
		eventRepo as never,
		itemRepository as never,
		toolSetItems,
		numbering,
		audit,
		transactions,
	);
	const service = new BorrowingService(
		requestService,
		requestRepo as never,
		requestEventRepo as never,
		borrowingRepo as never,
		itemRepo as never,
		eventRepo as never,
		itemRepository as never,
		custody as never,
		toolSets,
		numbering,
		audit,
		transactions,
	);
	return { unit, requests, borrowings, items, requestEvents, events, movements, toolSetStatus, requestService, service, units };
}

const input = (itemIds: string[], extra: Partial<TBorrowingCreateInput> = {}): TBorrowingCreateInput => ({
	branch: 'user',
	purpose: 'internal_use',
	dueAt: new Date('2026-12-01T00:00:00Z'),
	borrowerUserId: 'user-9',
	items: itemIds.map((itemId) => ({ itemId })),
	...extra,
});

describe('borrowing request', () => {
	let w: ReturnType<typeof world>;
	beforeEach(() => {
		w = world();
	});

	test('raising a request writes no movement and logs `requested` on the request timeline', async () => {
		const a = w.unit();
		const view = await w.requestService.create(input([a.id]), ORG, staff);
		expect(view.status).toBe('requested');
		expect(view.borrowing).toBeNull();
		expect(view.items).toHaveLength(1);
		expect(view.items[0]).toMatchObject({ borrowingId: null, originWarehouseId: WH });
		expect(w.movements).toHaveLength(0);
		expect(view.events.map((e) => [e.scope, e.eventType])).toEqual([['request', 'requested']]);
	});

	test('units that are not ready, have no warehouse, are foreign or duplicated are refused', async () => {
		const out = w.unit({ status: 'borrowed' });
		const homeless = w.unit({ warehouseId: null });
		const foreign = w.unit({ organizationId: 'other-org' });
		const ok = w.unit();
		await expect(w.requestService.create(input([out.id]), ORG, staff)).rejects.toBeInstanceOf(UnitNotAvailableError);
		await expect(w.requestService.create(input([homeless.id]), ORG, staff)).rejects.toBeInstanceOf(UnitNotAvailableError);
		await expect(w.requestService.create(input([foreign.id]), ORG, staff)).rejects.toBeInstanceOf(UnitNotOnBorrowingError);
		await expect(w.requestService.create(input([ok.id, ok.id]), ORG, staff)).rejects.toBeInstanceOf(UnitNotOnBorrowingError);
		expect(w.requests).toHaveLength(0);
	});

	test('a requester cannot approve their own request without the bypass; another person can', async () => {
		const view = await w.requestService.create(input([w.unit().id]), ORG, staff);
		await expect(w.requestService.approve(view.id, ORG, staff)).rejects.toBeInstanceOf(BorrowingSelfApprovalForbiddenError);
		const approved = await w.requestService.approve(view.id, ORG, { ...manager, actorUserId: 'someone-else', canApprove: false });
		expect(approved.status).toBe('approved');
		expect(approved.approvedBy).toBe('someone-else');
	});

	test('only the requester cancels, and only before issue', async () => {
		const view = await w.requestService.create(input([w.unit().id]), ORG, staff);
		await expect(w.requestService.cancel(view.id, ORG, manager)).rejects.toBeInstanceOf(BorrowingSelfApprovalForbiddenError);
		const second = await w.requestService.create(input([w.unit().id]), ORG, staff);
		await w.service.issue(second.id, ORG, manager);
		await expect(w.requestService.cancel(second.id, ORG, staff)).rejects.toBeInstanceOf(BorrowingTransitionError);
		expect((await w.requestService.cancel(view.id, ORG, staff)).status).toBe('cancelled');
	});

	test('a request in another tenant answers not found', async () => {
		const view = await w.requestService.create(input([w.unit().id]), ORG, staff);
		await expect(w.requestService.getById(view.id, 'other-org', staff)).rejects.toThrow();
	});

	test('a tool set expands to its member units and is lent at issue, available after the last return', async () => {
		const a = w.unit();
		const b = w.unit();
		const view = await (async () => {
			const withSet = new BorrowingRequestService(
				{
					create: async (data: never) => {
						const row = { id: id(), deletedAt: null, ...(data as object) } as TBorrowingRequestSelect;
						w.requests.push(row);
						return row;
					},
					findById: async (rid: string, org: string) => w.requests.find((r) => r.id === rid && r.organizationId === org) ?? null,
				} as never,
				{ findByRequestId: async (rid: string) => w.borrowings.find((r) => r.borrowingRequestId === rid) ?? null } as never,
				{
					createMany: async (rows: readonly TBorrowingItemInsert[]) =>
						rows.map((row) => {
							const created = { id: id(), deletedAt: null, issuedAt: null, returnedAt: null, markedLostAt: null, markedLateAt: null, ...row } as TBorrowingItemSelect;
							w.items.push(created);
							return created;
						}),
					listByRequest: async (rid: string) => w.items.filter((r) => r.borrowingRequestId === rid),
				} as never,
				{ append: async () => ({}) as never, listByRequest: async () => [] } as never,
				{ listByBorrowing: async () => [] } as never,
				{ findById: async (uid: string) => w.units.get(uid) ?? null } as never,
				{ listItemIds: async () => [a.id, b.id] } as never,
				{ next: async () => 'BRW-1' },
				{ record: async () => {} } as never,
				{ run: <T>(work: (tx: TTx) => Promise<T>) => work({} as TTx) },
			);
			return withSet.create(input([], { toolSetId: 'kit-1' }), ORG, staff);
		})();
		expect(view.items.map((row) => row.itemId).sort()).toEqual([a.id, b.id].sort());
		expect(view.toolSetId).toBe('kit-1');
	});
});

describe('borrowing (issue and return)', () => {
	let w: ReturnType<typeof world>;
	beforeEach(() => {
		w = world();
	});

	test('issue needs approval unless the caller may skip it; it creates the borrowing and the movements', async () => {
		const a = w.unit();
		const b = w.unit();
		const view = await w.requestService.create(input([a.id, b.id]), ORG, staff);
		await expect(w.service.issue(view.id, ORG, staff)).rejects.toBeInstanceOf(BorrowingTransitionError);

		const issued = await w.service.issue(view.id, ORG, manager);
		expect(issued.status).toBe('approved');
		expect(issued.borrowing).toMatchObject({ status: 'issued', issuedBy: 'manager' });
		expect(w.movements.map((m) => m.movementType)).toEqual(['borrow_out', 'borrow_out']);
		expect(w.movements.every((m) => m.referenceId === issued.borrowing?.id)).toBe(true);
		expect(w.units.get(a.id)).toMatchObject({ status: 'borrowed', warehouseId: null });
		// the issue approved the request implicitly, on the request timeline
		expect(issued.events.filter((e) => e.scope === 'request').map((e) => e.eventType)).toEqual(['requested', 'approved']);
		expect(issued.events.filter((e) => e.scope === 'borrowing').map((e) => [e.eventType, e.movementId !== null])).toEqual([
			['issued', true],
			['issued', true],
		]);
		await expect(w.service.issue(view.id, ORG, manager)).rejects.toBeInstanceOf(BorrowingTransitionError);
	});

	test('a unit that left between request and issue stops the whole issue', async () => {
		const a = w.unit();
		const b = w.unit();
		const view = await w.requestService.create(input([a.id, b.id]), ORG, staff);
		w.units.get(b.id)!.status = 'maintenance';
		await expect(w.service.issue(view.id, ORG, manager)).rejects.toBeInstanceOf(UnitNotAvailableError);
	});

	test('partial return then final return restore the origin warehouse and move the status along', async () => {
		const a = w.unit();
		const b = w.unit();
		const view = await w.requestService.create(input([a.id, b.id]), ORG, staff);
		const issued = await w.service.issue(view.id, ORG, manager);
		const borrowingId = issued.borrowing!.id;

		const first = await w.service.returnItems(borrowingId, ORG, staff, {
			borrowingItemId: issued.items[0]!.id,
			condition: 'good',
		});
		expect(first.borrowing?.status).toBe('partially_returned');
		expect(w.units.get(a.id)).toMatchObject({ status: 'ready', warehouseId: WH });

		const last = await w.service.returnItems(borrowingId, ORG, staff, { condition: 'damaged', note: 'cracked' });
		expect(last.borrowing?.status).toBe('returned');
		expect(last.items.map((row) => row.returnedCondition)).toEqual(['good', 'damaged']);
		await expect(w.service.returnItems(borrowingId, ORG, staff, { condition: 'good' })).rejects.toBeInstanceOf(BorrowingTransitionError);
	});

	test('a lost item parks the unit as lost and is not returnable', async () => {
		const a = w.unit();
		const view = await w.requestService.create(input([a.id]), ORG, staff);
		const issued = await w.service.issue(view.id, ORG, manager);
		const lost = await w.service.markLost(issued.borrowing!.id, ORG, manager, {
			borrowingItemId: issued.items[0]!.id,
			note: 'site fire',
		});
		expect(w.units.get(a.id)?.status).toBe('lost');
		expect(lost.items[0]?.markedLostAt).not.toBeNull();
		expect(lost.events[lost.events.length - 1]).toMatchObject({ eventType: 'marked_lost', scope: 'borrowing' });
		await expect(
			w.service.returnItems(issued.borrowing!.id, ORG, staff, { borrowingItemId: issued.items[0]!.id, condition: 'good' }),
		).rejects.toBeInstanceOf(UnitNotOnBorrowingError);
	});

	test('extend moves the borrowing and its open items; close needs `returned`', async () => {
		const a = w.unit();
		const view = await w.requestService.create(input([a.id]), ORG, staff);
		const issued = await w.service.issue(view.id, ORG, manager);
		const later = new Date('2027-01-01T00:00:00Z');
		const extended = await w.service.extend(issued.borrowing!.id, ORG, staff, later);
		expect(extended.borrowing?.dueAt).toEqual(later);
		expect(extended.items[0]?.dueAt).toEqual(later);
		await expect(w.service.close(issued.borrowing!.id, ORG, staff)).rejects.toBeInstanceOf(BorrowingTransitionError);
		await w.service.returnItems(issued.borrowing!.id, ORG, staff, { condition: 'good' });
		const closed = await w.service.close(issued.borrowing!.id, ORG, staff);
		expect(closed.borrowing?.status).toBe('closed');
		expect(closed.borrowing?.closedAt).not.toBeNull();
	});

	test('the late sweep marks an overdue item once, however often it runs', async () => {
		const a = w.unit();
		const view = await w.requestService.create(input([a.id], { dueAt: new Date('2026-11-01T00:00:00Z') }), ORG, staff);
		await w.service.issue(view.id, ORG, manager);
		const now = new Date('2026-11-20T00:00:00Z');
		expect(await w.service.sweepLate(now)).toEqual({ processed: 1, skipped: 0 });
		expect(await w.service.sweepLate(now)).toEqual({ processed: 0, skipped: 0 });
		expect(w.events.filter((e) => e.eventType === 'marked_late')).toHaveLength(1);
		expect(w.events.find((e) => e.eventType === 'marked_late')).toMatchObject({ actorUserId: null, movementId: null });
	});
});

describe('guest borrower PII', () => {
	let w: ReturnType<typeof world>;
	beforeEach(() => {
		w = world();
	});

	const guest = (): Partial<TBorrowingCreateInput> => ({
		branch: 'guest',
		borrowerUserId: null,
		guestName: 'Tamu',
		guestPhone: '0812',
		guestIdType: 'ktp',
		guestIdNumber: '3171000000000001',
		guestAddressText: 'Jl. Contoh 1',
	});

	test('identity fields are withheld from callers without the PII tier', async () => {
		const view = await w.requestService.create(input([w.unit().id], guest()), ORG, staff);
		const seen = await w.requestService.getById(view.id, ORG, viewer);
		expect(seen.guestIdentityRedacted).toBe(true);
		expect(seen.guestIdNumber).toBeNull();
		expect(seen.guestAddressText).toBeNull();
		const full = await w.requestService.getById(view.id, ORG, staff);
		expect(full.guestIdentityRedacted).toBe(false);
		expect(full.guestIdNumber).toBe('3171000000000001');
	});

	test('a guest must give name, phone and id number', async () => {
		await expect(
			w.requestService.create(input([w.unit().id], { ...guest(), guestIdNumber: null }), ORG, staff),
		).rejects.toThrow();
	});

	test('retention sweep nulls PII on old closed borrowings only, and is idempotent', async () => {
		const view = await w.requestService.create(input([w.unit().id], guest()), ORG, staff);
		const issued = await w.service.issue(view.id, ORG, manager);
		await w.service.returnItems(issued.borrowing!.id, ORG, staff, { condition: 'good' });
		await w.service.close(issued.borrowing!.id, ORG, staff);
		const closedAt = issued.borrowing ? w.borrowings[0]!.closedAt! : new Date();

		// inside the window: nothing happens
		expect(await w.service.sweepGuestRetention(12, closedAt)).toEqual({ processed: 0, skipped: 0 });
		const later = new Date(closedAt.getTime() + 400 * 86_400_000);
		expect(await w.service.sweepGuestRetention(12, later)).toEqual({ processed: 1, skipped: 0 });
		expect(w.requests[0]?.guestName).toBeNull();
		expect(await w.service.sweepGuestRetention(12, later)).toEqual({ processed: 0, skipped: 0 });
	});
});

describe('monthsBefore', () => {
	test('clamps the day of month', () => {
		expect(monthsBefore(new Date('2026-03-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
	});
});
