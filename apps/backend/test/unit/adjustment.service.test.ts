/**
 * Stock adjustment document workflow tests.
 *
 * An adjustment is a document with an approval chain, so the things worth
 * testing are the rules that chain enforces and that no table can express:
 *
 * 1. **Legal edges only** — every illegal transition is refused, from every
 *    state. The machine is data (`ADJUSTMENT_TRANSITIONS`), so this file walks
 *    the whole matrix rather than the handful of edges someone remembered.
 * 2. **No self-approval** unless the actor holds `stock_adjustment:approve`.
 * 3. **Posting writes one movement per CHANGED line.** A recount that agrees
 *    with the system posts nothing (`stock_movements_quantity_check` forbids
 *    `quantity = 0`) yet still reaches `posted`.
 * 4. **Posting is idempotent** — `posted_at IS NOT NULL` is the guard.
 * 5. **Tenant isolation** — another organization's document is a 404.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { container } from 'tsyringe';
import type {
	TStockAdjustmentItemSelect,
	TStockAdjustmentSelect,
} from '@drizzle/schemas/inventory.schema';
import type {
	IAdjustmentRepository,
	TAdjustmentLineData,
	TAdjustmentPaginationRequest,
} from '../../src/app/inventory/contracts/adjustment.repository.interface';
import type {
	IItemRepository,
} from '../../src/app/inventory/contracts/item.repository.interface';
import {
	ADJUSTMENT_REPOSITORY_TOKEN,
	ADJUSTMENT_SERVICE_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	STOCK_SERVICE_TOKEN,
} from '../../src/app/inventory/constants/di';
import {
	AdjustmentService,
	type TAdjustmentActor,
} from '../../src/app/inventory/services/adjustment.service';
import type {
	StockService,
	TPostMovementInput,
} from '../../src/app/inventory/services/stock.service';
import {
	AdjustmentHasNoLinesError,
	AdjustmentNotFoundError,
	AdjustmentTransitionError,
	SelfApprovalForbiddenError,
} from '../../src/app/inventory/errors/inventory.errors';

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const WAREHOUSE_ID = '01920000-0000-7000-8000-0000000000aa';
const ITEM_ID = '01920000-0000-7000-8000-000000000001';
const ITEM_ID_2 = '01920000-0000-7000-8000-000000000002';

const REQUESTER = 'user-requester';
const APPROVER = 'user-approver';

const actor = (userId: string, canSelfApprove = false): TAdjustmentActor => ({
	actorUserId: userId,
	canSelfApprove,
});

/** In-memory adjustment repository. */
function fakeAdjustments() {
	const documents: TStockAdjustmentSelect[] = [];
	const lines: TStockAdjustmentItemSelect[] = [];
	let sequence = 0;

	return {
		documents,
		lines,
		async paginate(request: TAdjustmentPaginationRequest) {
			return {
				meta: {
					page: request.page,
					limit: request.limit,
					total: documents.length,
					totalPages: 1,
				},
				data: documents,
			};
		},
		async findById(id: string) {
			return (
				documents.find((row) => row.id === id && row.deletedAt === null) ??
				null
			);
		},
		async findByCode(organizationId: string, code: string) {
			return (
				documents.find(
					(row) => row.organizationId === organizationId && row.code === code,
				) ?? null
			);
		},
		async create(data: Partial<TStockAdjustmentSelect>) {
			sequence += 1;
			const row = {
				id: `adjustment-${sequence}`,
				status: 'draft',
				approvedBy: null,
				approvedAt: null,
				postedAt: null,
				deletedAt: null,
				updatedAt: null,
				...data,
			} as TStockAdjustmentSelect;
			documents.push(row);
			return row;
		},
		async update(id: string, data: Partial<TStockAdjustmentSelect>) {
			const row = documents.find((row) => row.id === id);
			if (!row) return null;
			Object.assign(row, data);
			return row;
		},
		async listLines(adjustmentId: string) {
			return lines.filter(
				(row) =>
					row.stockAdjustmentId === adjustmentId && row.deletedAt === null,
			);
		},
		async createLines(input: readonly TAdjustmentLineData[]) {
			const created = input.map((line, index) => ({
				id: `line-${sequence}-${index}`,
				deletedAt: null,
				updatedAt: null,
				...line,
			})) as TStockAdjustmentItemSelect[];
			lines.push(...created);
			return created;
		},
		async replaceLines(
			adjustmentId: string,
			input: readonly TAdjustmentLineData[],
		) {
			for (const line of lines) {
				if (line.stockAdjustmentId === adjustmentId) line.deletedAt = new Date();
			}
			const created = input.map((line, index) => ({
				id: `line-${sequence}-r${index}`,
				deletedAt: null,
				updatedAt: null,
				...line,
			})) as TStockAdjustmentItemSelect[];
			lines.push(...created);
			return created;
		},
	};
}

/** Records the movements the service asks the ledger to post. */
function fakeStock(onHand: Record<string, string> = {}) {
	const posted: TPostMovementInput[] = [];
	const service = {
		async resolveScope() {
			return { warehouse: { id: WAREHOUSE_ID }, scopeOrganizationId: ORG_A };
		},
		async balanceFor(_scope: string | null, _wh: string, itemId: string) {
			const quantity = onHand[itemId];
			return quantity === undefined ? null : { quantityOnHand: quantity };
		},
		async postMovement(input: TPostMovementInput) {
			posted.push(input);
			return { movement: {}, balance: {}, scopeOrganizationId: ORG_A };
		},
	} as unknown as StockService;
	return { service, posted };
}

/** Minimal item repository: `findById` is all the service uses. */
function fakeItems(): IItemRepository {
	return {
		async paginate() {
			return { meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] };
		},
		async findById(id: string) {
			if (id !== ITEM_ID && id !== ITEM_ID_2) return null;
			return { id } as never;
		},
		async findBySku() {
			return null;
		},
		async create() {
			return {} as never;
		},
		async update() {
			return null;
		},
		async archive() {
			return null;
		},
		async countLiveUnits() {
			return 0;
		},
	} as unknown as IItemRepository;
}

let adjustments: ReturnType<typeof fakeAdjustments>;
let stock: ReturnType<typeof fakeStock>;
let items: IItemRepository;
let service: AdjustmentService;

/** Builds the service against a fresh fake world. */
function build(onHand: Record<string, string> = {}) {
	adjustments = fakeAdjustments();
	stock = fakeStock(onHand);
	items = fakeItems();
	const database = {
		transaction: async (callback: (tx: null) => unknown) => callback(null),
	} as never;

	container.register(ADJUSTMENT_REPOSITORY_TOKEN, { useValue: adjustments });
	container.register(ITEM_REPOSITORY_TOKEN, { useValue: items });
	container.register(STOCK_SERVICE_TOKEN, { useValue: stock.service });
	container.register(ADJUSTMENT_SERVICE_TOKEN, {
		useValue: new AdjustmentService(
			adjustments as unknown as IAdjustmentRepository,
			items,
			stock.service,
			database,
		),
	});
	service = container.resolve<AdjustmentService>(ADJUSTMENT_SERVICE_TOKEN);
}

beforeEach(() => build());

/** Raises a one-line adjustment in `draft`. */
async function raise(
	quantityAfter = '10.000',
	lineItemId = ITEM_ID,
): Promise<string> {
	const detail = await service.create(
		ORG_A,
		{
			warehouseId: WAREHOUSE_ID,
			adjustmentType: 'recount',
			lines: [{ itemId: lineItemId, quantityAfter }],
		},
		actor(REQUESTER),
	);
	return detail.adjustment.id;
}

/** Drives a document to `approved`. */
async function approved(id: string): Promise<void> {
	await service.submit(id, ORG_A);
	await service.approve(id, ORG_A, actor(APPROVER));
}

describe('adjustment — lifecycle', () => {
	test('a new adjustment starts as a draft owned by the raising tenant', async () => {
		const detail = await service.findDetail(await raise(), ORG_A);

		expect(detail.adjustment.status).toBe('draft');
		expect(detail.adjustment.organizationId).toBe(ORG_A);
		expect(detail.adjustment.requestedBy).toBe(REQUESTER);
		expect(detail.lines).toHaveLength(1);
	});

	test('the happy path reaches posted and records who approved it', async () => {
		const id = await raise();
		await approved(id);

		const approvedDoc = await service.findDetail(id, ORG_A);
		expect(approvedDoc.adjustment.status).toBe('approved');
		expect(approvedDoc.adjustment.approvedBy).toBe(APPROVER);
		expect(approvedDoc.adjustment.approvedAt).not.toBeNull();

		const posted = await service.post(id, ORG_A, actor(APPROVER));
		expect(posted.adjustment.status).toBe('posted');
		expect(posted.adjustment.postedAt).not.toBeNull();
	});

	test('reject and cancel are terminal', async () => {
		const rejectedId = await raise();
		await service.submit(rejectedId, ORG_A);
		await service.reject(rejectedId, ORG_A);

		await expect(
			service.approve(rejectedId, ORG_A, actor(APPROVER)),
		).rejects.toBeInstanceOf(AdjustmentTransitionError);

		const cancelledId = await raise();
		await service.cancel(cancelledId, ORG_A);
		await expect(
			service.submit(cancelledId, ORG_A),
		).rejects.toBeInstanceOf(AdjustmentTransitionError);
	});

	test('an adjustment with no lines cannot be raised', async () => {
		await expect(
			service.create(
				ORG_A,
				{ warehouseId: WAREHOUSE_ID, adjustmentType: 'recount', lines: [] },
				actor(REQUESTER),
			),
		).rejects.toBeInstanceOf(AdjustmentHasNoLinesError);
	});

	test('another organization cannot read or transition the document', async () => {
		const id = await raise();

		await expect(service.findDetail(id, ORG_B)).rejects.toBeInstanceOf(
			AdjustmentNotFoundError,
		);
		await expect(service.submit(id, ORG_B)).rejects.toBeInstanceOf(
			AdjustmentNotFoundError,
		);
	});
});

describe('adjustment — the state machine refuses every illegal edge', () => {
	/**
	 * The full matrix, walked exhaustively.
	 *
	 * @remarks
	 * Listing the legal edges once and asserting that *everything else* is
	 * refused is what stops a new status (or a refactor) from quietly opening a
	 * path like `rejected → approved`.
	 */
	const LEGAL: Record<string, readonly string[]> = {
		draft: ['submitted', 'cancelled'],
		submitted: ['approved', 'rejected', 'cancelled'],
		approved: ['posted'],
		rejected: [],
		posted: [],
		cancelled: [],
	};

	const STATUSES = Object.keys(LEGAL);
	const ALL_TARGETS = [
		'submitted',
		'approved',
		'rejected',
		'posted',
		'cancelled',
	] as const;

	/**
	 * Forces a document into a status directly.
	 *
	 * @remarks
	 * Needed because some states (`rejected`, `posted`) are unreachable except
	 * through their own legal path, and the point here is to probe the edges
	 * *out of* them.
	 */
	async function forceStatus(id: string, status: string): Promise<void> {
		const document = adjustments.documents.find((row) => row.id === id);
		if (!document) throw new Error('missing document');
		document.status = status;
		if (status === 'approved' || status === 'posted') {
			document.approvedBy = APPROVER;
			document.approvedAt = new Date();
		}
		if (status === 'posted') document.postedAt = new Date();
	}

	/** Attempts one transition through the public API. */
	async function attempt(id: string, to: string): Promise<void> {
		switch (to) {
			case 'submitted':
				await service.submit(id, ORG_A);
				return;
			case 'approved':
				await service.approve(id, ORG_A, actor(APPROVER));
				return;
			case 'rejected':
				await service.reject(id, ORG_A);
				return;
			case 'posted':
				await service.post(id, ORG_A, actor(APPROVER));
				return;
			case 'cancelled':
				await service.cancel(id, ORG_A);
				return;
			default:
				throw new Error(`unknown target ${to}`);
		}
	}

	for (const from of STATUSES) {
		for (const to of ALL_TARGETS) {
			// `posted → posted` is not an illegal edge: posting is idempotent, so
			// re-posting a posted document returns it untouched. That is a rule
			// with its own test, not a state-machine edge.
			if (from === 'posted' && to === 'posted') continue;

			const legal = LEGAL[from].includes(to);
			const label = legal ? 'allows' : 'refuses';

			test(`${label} ${from} → ${to}`, async () => {
				// Self-approval is switched on so the machine is the only thing
				// under test here; that rule has its own tests below.
				const id = await raise('5.000');
				await forceStatus(id, from);

				const run = attempt(id, to);
				if (legal) {
					await run;
				} else {
					await expect(run).rejects.toBeInstanceOf(
						AdjustmentTransitionError,
					);
				}
			});
		}
	}
});

describe('adjustment — self-approval', () => {
	test('the requester cannot approve their own adjustment', async () => {
		const id = await raise();
		await service.submit(id, ORG_A);

		await expect(
			service.approve(id, ORG_A, actor(REQUESTER)),
		).rejects.toBeInstanceOf(SelfApprovalForbiddenError);

		// Still submitted: the refusal changed nothing.
		const document = await service.findDetail(id, ORG_A);
		expect(document.adjustment.status).toBe('submitted');
	});

	test('holding stock_adjustment:approve is the documented bypass', async () => {
		const id = await raise();
		await service.submit(id, ORG_A);

		const document = await service.approve(
			id,
			ORG_A,
			actor(REQUESTER, true),
		);
		expect(document.status).toBe('approved');
	});

	test('a different person can approve', async () => {
		const id = await raise();
		await service.submit(id, ORG_A);

		const document = await service.approve(id, ORG_A, actor(APPROVER));
		expect(document.status).toBe('approved');
		expect(document.approvedBy).toBe(APPROVER);
	});
});

describe('adjustment — posting writes one movement per CHANGED line', () => {
	test('an increase posts exactly one adjustment_in', async () => {
		build({ [ITEM_ID]: '4.000' });
		const id = await raise('10.000');
		await approved(id);

		await service.post(id, ORG_A, actor(APPROVER));

		expect(stock.posted).toHaveLength(1);
		expect(stock.posted[0]).toMatchObject({
			movementType: 'adjustment_in',
			// The DELTA (10 - 4), not the counted total.
			quantity: '6.000',
			referenceType: 'manual_adjustment',
			referenceId: id,
			// The acting tenant, even though the balance scope is the warehouse's.
			actorOrganizationId: ORG_A,
		});
	});

	test('a decrease posts exactly one adjustment_out', async () => {
		build({ [ITEM_ID]: '10.000' });
		const id = await raise('3.000');
		await approved(id);

		await service.post(id, ORG_A, actor(APPROVER));

		expect(stock.posted).toHaveLength(1);
		expect(stock.posted[0]).toMatchObject({
			movementType: 'adjustment_out',
			quantity: '7.000',
		});
	});

	test('a recount that agrees posts NOTHING but still reaches posted', async () => {
		build({ [ITEM_ID]: '5.000' });
		const id = await raise('5.000');
		await approved(id);

		const result = await service.post(id, ORG_A, actor(APPROVER));

		// `stock_movements_quantity_check` forbids quantity = 0, and "the count
		// agreed" is not a movement.
		expect(stock.posted).toHaveLength(0);
		expect(result.adjustment.status).toBe('posted');
		expect(result.adjustment.postedAt).not.toBeNull();
	});

	test('only the changed lines of a mixed document post', async () => {
		build({ [ITEM_ID]: '5.000', [ITEM_ID_2]: '2.000' });
		const detail = await service.create(
			ORG_A,
			{
				warehouseId: WAREHOUSE_ID,
				adjustmentType: 'recount',
				lines: [
					{ itemId: ITEM_ID, quantityAfter: '5.000' }, // unchanged
					{ itemId: ITEM_ID_2, quantityAfter: '9.000' }, // +7
				],
			},
			actor(REQUESTER),
		);
		await approved(detail.adjustment.id);

		await service.post(detail.adjustment.id, ORG_A, actor(APPROVER));

		expect(stock.posted).toHaveLength(1);
		expect(stock.posted[0]).toMatchObject({
			itemId: ITEM_ID_2,
			quantity: '7.000',
		});
	});

	test('an empty balance counts as zero, not as an error', async () => {
		build({});
		const id = await raise('8.000');
		await approved(id);

		await service.post(id, ORG_A, actor(APPROVER));

		expect(stock.posted[0]).toMatchObject({ quantity: '8.000' });
	});

	test('posting twice does not write the movements twice', async () => {
		build({ [ITEM_ID]: '0.000' });
		const id = await raise('10.000');
		await approved(id);

		await service.post(id, ORG_A, actor(APPROVER));
		await service.post(id, ORG_A, actor(APPROVER));

		// `posted_at IS NOT NULL` is the idempotency guard.
		expect(stock.posted).toHaveLength(1);
	});

	test('the stored snapshot records what the system believed at raise time', async () => {
		build({ [ITEM_ID]: '4.000' });
		const detail = await service.findDetail(await raise('10.000'), ORG_A);

		expect(detail.lines[0].quantityBefore).toBe('4.000');
		expect(detail.lines[0].quantityAfter).toBe('10.000');
	});
});
