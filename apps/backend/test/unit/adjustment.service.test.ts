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
 *
 * ADR-0026: the product master moved to `@app/product`, so line validation goes
 * through `EXPORTED_PRODUCT_SERVICE_TOKEN` (`assertProduct`).
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { container } from 'tsyringe';
import { createNumberingDouble } from '../helpers/numbering-double';
import { AuditWriterDouble } from '../helpers/audit-writer-double';
import type {
	TStockAdjustmentItemSelect,
	TStockAdjustmentSelect,
	TStockSelect,
} from '@drizzle/schemas/inventory.schema';
import type {
	IAdjustmentRepository,
	TAdjustmentLineData,
	TAdjustmentPaginationRequest,
} from '../../src/app/inventory/contracts/adjustment.repository.interface';
import type { ExportedProductService } from '../../src/app/product/services/exported-product.service';
import {
	ADJUSTMENT_REPOSITORY_TOKEN,
	ADJUSTMENT_SERVICE_TOKEN,
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
import { ProductNotFoundError } from '../../src/app/product/errors/product.errors';

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
			const row = documents.find((candidate) => candidate.id === id);
			if (!row) return null;
			Object.assign(row, data);
			return row;
		},
		async claimForPost(id: string, _tx: unknown) {
			const row = documents.find(
				(candidate) =>
					candidate.id === id &&
					candidate.deletedAt === null &&
					candidate.status === 'approved' &&
					candidate.postedAt === null,
			);
			if (!row) return null;
			row.status = 'posted';
			row.postedAt = new Date();
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

/**
 * The stock ledger double.
 *
 * @remarks
 * ADR-0026 re-cut the seam `AdjustmentService` uses, so this is an explicit
 * object rather than a partial `StockService`: `resolveScope` answers with the
 * warehouse's scope only, `balanceFor` takes that scope (not the caller's
 * organization), and `postMovement` joins the caller's transaction. It is
 * narrowed to the three methods the service actually calls.
 *
 * @param onHand - Seeded on-hand quantity per product id
 */
function fakeStock(onHand: Record<string, string> = {}) {
	const posted: TPostMovementInput[] = [];
	/**
	 * Failure hook for the atomicity test.
	 *
	 * @remarks
	 * A settable field rather than a replaced method: the double is now an
	 * explicit object, so `postMovement` is an own property that cannot be
	 * shadowed-then-restored the way the old partial-class double was.
	 */
	let onPost: (() => void) | null = null;
	/** The seam the service consumes, plus the two hooks the tests drive. */
	type TStockDouble = Pick<
		StockService,
		'resolveScope' | 'balanceFor' | 'postMovement'
	> & {
		/** Makes the next posted movement throw, simulating a failed line. */
		failNextPost(reason: string): void;
		/** Restores the healthy ledger. */
		healPosts(): void;
	};
	const stock: TStockDouble = {
		failNextPost(reason: string) {
			onPost = () => {
				throw new Error(reason);
			};
		},
		healPosts() {
			onPost = null;
		},
		/** The warehouse's balance scope — the acting tenant is not consulted. */
		async resolveScope() {
			return { scopeOrganizationId: ORG_A };
		},
		async balanceFor(_scope, _warehouseId, productId) {
			const quantity = onHand[productId];
			return quantity === undefined ? null : ({ quantityOnHand: quantity } as never);
		},
		async postMovement(input, _tx) {
			onPost?.();
			posted.push(input);
			return { movement: {}, balance: {}, scopeOrganizationId: ORG_A } as never;
		},
	};
	return { service: stock, posted };
}

/**
 * Product facade double.
 *
 * @remarks
 * The service only asks it whether a line's product exists (ADR-0014/0026), so
 * the fake knows the two fixture ids and answers `ProductNotFoundError`
 * otherwise — the same contract `ExportedProductService.assertProduct` gives.
 */
function fakeProducts(known: readonly string[]) {
	const asserted: string[] = [];
	const facade: Pick<ExportedProductService, 'assertProduct'> = {
		async assertProduct(productId: string) {
			asserted.push(productId);
			if (!known.includes(productId)) throw new ProductNotFoundError();
			return {
				id: productId,
				code: 'PRD-00001',
				sku: 'CTRL-01',
				name: 'Door controller',
				unitLabel: 'pcs',
				sellingPrice: 0,
				purchasePrice: 0,
				specification: null,
				productKind: 'product',
				imageObjectKey: null,
				isActive: true,
				isSerialized: false,
				isStockTracked: true,
			};
		},
	};
	return { facade, asserted };
}

let adjustments: ReturnType<typeof fakeAdjustments>;
let stock: ReturnType<typeof fakeStock>;
let products: ReturnType<typeof fakeProducts>;
let service: AdjustmentService;

/** Builds the service against a fresh fake world. */
function build(onHand: Record<string, string> = {}) {
	adjustments = fakeAdjustments();
	stock = fakeStock(onHand);
	products = fakeProducts([ITEM_ID, ITEM_ID_2]);
	const database = {
		// Emulates a real transaction: a thrown callback rolls the world back
		// (status/postedAt restore plus the rows it inserted, and the movements
		// the fake ledger recorded), which is exactly the property the
		// atomic-claim test asserts.
		transaction: async (callback: (tx: null) => unknown) => {
			const snapshot = adjustments.documents.map((row) => ({
				row,
				status: row.status,
				postedAt: row.postedAt,
			}));
			const documentCount = adjustments.documents.length;
			const lineCount = adjustments.lines.length;
			const movementCount = stock.posted.length;
			try {
				return await callback(null);
			} catch (error) {
				adjustments.documents.length = documentCount;
				adjustments.lines.length = lineCount;
				stock.posted.length = movementCount;
				for (const entry of snapshot) {
					entry.row.status = entry.status;
					entry.row.postedAt = entry.postedAt;
				}
				throw error;
			}
		},
		// Drizzle-bun-sql returns an array-like result; `undefined` is replaced
		// by the caller's own value, so a non-null marker is enough here.
		$(pieces: TemplateStringsArray) {
			void pieces;
			return [] as unknown[];
		},
	} as never;

	container.register(ADJUSTMENT_REPOSITORY_TOKEN, { useValue: adjustments });
	// The ledger double is registered on the seam the service resolves and is
	// then handed to the constructor. The token is typed to the whole
	// `StockService`, so — like the other suites' facade doubles — the
	// three-method stand-in is registered as a structural double.
	container.registerInstance(STOCK_SERVICE_TOKEN, stock.service as never);
	container.register(ADJUSTMENT_SERVICE_TOKEN, {
		useValue: new AdjustmentService(
			adjustments as unknown as IAdjustmentRepository,
			products.facade,
			container.resolve(STOCK_SERVICE_TOKEN),
			createNumberingDouble(),
			new AuditWriterDouble(),
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
			lines: [{ productId: lineItemId, quantityAfter }],
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

/**
 * Rebuilds the world, keeping the logging double a test already references.
 *
 * @remarks
 * `stock.posted` is captured per build, so a test that re-seeds the balances
 * mid-test must be holding the *new* recorder, not the one it built before.
 * The setup inside {@link build} is synchronous, so no `await` can be split.
 */
function seedWorld(onHand: Record<string, string>): {
	stock: ReturnType<typeof fakeStock>;
	adjustments: ReturnType<typeof fakeAdjustments>;
} {
	// `build` replaces both bindings; read them after it ran, not before.
	build(onHand);
	return { stock, adjustments };
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

	test('posting is atomic: a failing movement rolls the claim back so the document stays re-postable', async () => {
		const id = await raise();
		await approved(id);

		// Make the very first movement fail mid-transaction (simulating a
		// serialization failure or insufficient stock under the FOR UPDATE
		// lock).
		stock.service.failNextPost('boom');
		await expect(service.post(id, ORG_A, actor(APPROVER))).rejects.toThrow(
			'boom',
		);

		// The claim must have rolled back with the transaction: the document
		// is still approved, not stuck in `posted` with zero movements.
		const after = await service.findDetail(id, ORG_A);
		expect(after.adjustment.status).toBe('approved');
		expect(after.adjustment.postedAt).toBeNull();

		// Re-post with the healthy stock double succeeds.
		stock.service.healPosts();
		const posted = await service.post(id, ORG_A, actor(APPROVER));
		expect(posted.adjustment.status).toBe('posted');
		expect(stock.posted.length).toBeGreaterThan(0);
	});

	test('a second post of an already-posted document is an idempotent no-op, not a double movement', async () => {
		const id = await raise();
		await approved(id);
		await service.post(id, ORG_A, actor(APPROVER));
		const movements = stock.posted.length;

		const again = await service.post(id, ORG_A, actor(APPROVER));
		expect(again.adjustment.status).toBe('posted');
		expect(stock.posted.length).toBe(movements);
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
		await expect(service.submit(cancelledId, ORG_A)).rejects.toBeInstanceOf(
			AdjustmentTransitionError,
		);
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

describe('adjustment — lines are validated against the product module (ADR-0026)', () => {
	test('an unknown product is refused by the product contract before any write', async () => {
		// ADR-0026: the product id is a logical reference validated by the
		// owning module's façade, so the refusal is the product module's own
		// `ProductNotFoundError` (404) — inventory does not translate it.
		await expect(
			service.create(
				ORG_A,
				{
					warehouseId: WAREHOUSE_ID,
					adjustmentType: 'recount',
					lines: [
						{
							productId: '01920000-0000-7000-8000-00000000dead',
							quantityAfter: '1.000',
						},
					],
				},
				actor(REQUESTER),
			),
		).rejects.toBeInstanceOf(ProductNotFoundError);
		// The header row was written inside the create transaction and the
		// failed line validation rolled it back with it.
		expect(adjustments.documents).toHaveLength(0);
		expect(adjustments.lines).toHaveLength(0);
	});

	test('every line is asserted through the product facade exactly once', async () => {
		await service.create(
			ORG_A,
			{
				warehouseId: WAREHOUSE_ID,
				adjustmentType: 'recount',
				lines: [
					{ productId: ITEM_ID, quantityAfter: '1.000' },
					{ productId: ITEM_ID_2, quantityAfter: '2.000' },
				],
			},
			actor(REQUESTER),
		);
		expect(products.asserted).toEqual([ITEM_ID, ITEM_ID_2]);
	});

	test('two lines for one product and bin are refused', async () => {
		await expect(
			service.create(
				ORG_A,
				{
					warehouseId: WAREHOUSE_ID,
					adjustmentType: 'recount',
					lines: [
						{ productId: ITEM_ID, quantityAfter: '1.000' },
						{ productId: ITEM_ID, quantityAfter: '2.000' },
					],
				},
				actor(REQUESTER),
			),
		).rejects.toBeInstanceOf(AdjustmentTransitionError);
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

			const legal = LEGAL[from]!.includes(to);
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
					await expect(run).rejects.toBeInstanceOf(AdjustmentTransitionError);
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

		const document = await service.approve(id, ORG_A, actor(REQUESTER, true));
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
		const world = seedWorld({ [ITEM_ID]: '4.000' });
		const id = await raise('10.000');
		await approved(id);

		await service.post(id, ORG_A, actor(APPROVER));

		expect(world.stock.posted).toHaveLength(1);
		expect(world.stock.posted[0]).toMatchObject({
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
		const world = seedWorld({ [ITEM_ID]: '10.000' });
		const id = await raise('3.000');
		await approved(id);

		await service.post(id, ORG_A, actor(APPROVER));

		expect(world.stock.posted).toHaveLength(1);
		expect(world.stock.posted[0]).toMatchObject({
			movementType: 'adjustment_out',
			quantity: '7.000',
		});
	});

	test('opening stock: an increase enters at the line cost; a decrease at the average', async () => {
		const opening = seedWorld({ [ITEM_ID]: '0.000' });
		const detail = await service.create(
			ORG_A,
			{
				warehouseId: WAREHOUSE_ID,
				adjustmentType: 'increase',
				reasonCode: 'opening_stock',
				lines: [
					{ productId: ITEM_ID, quantityAfter: '5.000', unitCost: 1_250_000 },
				],
			},
			actor(REQUESTER),
		);
		expect(detail.lines[0]).toMatchObject({ unitCost: 1_250_000 });
		await approved(detail.adjustment.id);
		await service.post(detail.adjustment.id, ORG_A, actor(APPROVER));
		expect(opening.stock.posted[0]).toMatchObject({
			movementType: 'adjustment_in',
			quantity: '5.000',
			unitCost: 1_250_000,
		});

		const closing = seedWorld({ [ITEM_ID]: '10.000' });
		const down = await service.create(
			ORG_A,
			{
				warehouseId: WAREHOUSE_ID,
				adjustmentType: 'decrease',
				lines: [
					{ productId: ITEM_ID, quantityAfter: '8.000', unitCost: 99 },
				],
			},
			actor(REQUESTER),
		);
		await approved(down.adjustment.id);
		await service.post(down.adjustment.id, ORG_A, actor(APPROVER));
		expect(closing.stock.posted[0]).toMatchObject({
			movementType: 'adjustment_out',
			unitCost: null,
		});
	});

	test('a recount that agrees posts NOTHING but still reaches posted', async () => {
		const world = seedWorld({ [ITEM_ID]: '5.000' });
		const id = await raise('5.000');
		await approved(id);

		// `stock_movements_quantity_check` forbids quantity = 0, and "the count
		// agreed" is not a movement.
		expect(world.stock.posted).toHaveLength(0);
		const result = await service.post(id, ORG_A, actor(APPROVER));
		expect(result.adjustment.status).toBe('posted');
		expect(result.adjustment.postedAt).not.toBeNull();
		expect(world.stock.posted).toHaveLength(0);
	});

	test('only the changed lines of a mixed document post', async () => {
		const world = seedWorld({ [ITEM_ID]: '5.000', [ITEM_ID_2]: '2.000' });
		const detail = await service.create(
			ORG_A,
			{
				warehouseId: WAREHOUSE_ID,
				adjustmentType: 'recount',
				lines: [
					{ productId: ITEM_ID, quantityAfter: '5.000' }, // unchanged
					{ productId: ITEM_ID_2, quantityAfter: '9.000' }, // +7
				],
			},
			actor(REQUESTER),
		);
		await approved(detail.adjustment.id);
		// Raising and approving posts nothing: the ledger only moves on post.
		expect(world.stock.posted).toHaveLength(0);

		await service.post(detail.adjustment.id, ORG_A, actor(APPROVER));

		expect(world.stock.posted).toHaveLength(1);
		expect(world.stock.posted[0]).toMatchObject({
			productId: ITEM_ID_2,
			quantity: '7.000',
		});
	});

	test('an empty balance counts as zero, not as an error', async () => {
		const world = seedWorld({});
		const id = await raise('8.000');
		await approved(id);

		await service.post(id, ORG_A, actor(APPROVER));

		expect(world.stock.posted[0]).toMatchObject({ quantity: '8.000' });
	});

	test('posting twice does not write the movements twice', async () => {
		const world = seedWorld({ [ITEM_ID]: '0.000' });
		const id = await raise('10.000');
		await approved(id);

		await service.post(id, ORG_A, actor(APPROVER));
		await service.post(id, ORG_A, actor(APPROVER));

		// `posted_at IS NOT NULL` is the idempotency guard.
		expect(world.stock.posted).toHaveLength(1);
	});

	test('the stored snapshot records what the system believed at raise time', async () => {
		seedWorld({ [ITEM_ID]: '4.000' });
		const detail = await service.findDetail(await raise('10.000'), ORG_A);

		expect(detail.lines[0]!.quantityBefore).toBe('4.000');
		expect(detail.lines[0]!.quantityAfter).toBe('10.000');
	});
});
