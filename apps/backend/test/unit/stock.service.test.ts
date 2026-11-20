/**
 * Stock ledger + balance service tests.
 *
 * These assert the invariants the module exists to guarantee, not the shape of
 * the code:
 *
 * 1. **The ledger is the truth.** However many posts and reversals happen, the
 *    incrementally maintained balance must equal a full recompute from
 *    `stock_movements`. This is the test that catches a "clever" incremental
 *    update that drifts.
 * 2. **Negative stock is refused** — for every movement type, not just issues.
 * 3. **The scope rule.** A global warehouse (`organization_id IS NULL`) has ONE
 *    shared balance that every organization contributes to and sees; an
 *    organization warehouse is isolated per organization.
 * 4. **Reversal is one-shot.** Reversing twice is a 409, never a silent no-op.
 *
 * The repositories are in-memory fakes that model the two behaviours the real
 * Drizzle repositories rely on: the atomic accumulate in `applyDelta` and the
 * conditional `status = 'posted'` claim in `claimForReversal`. The fakes are
 * deliberately dumb elsewhere — anything smarter would be testing the fake.
 *
 * ADR-0026: the product master and the warehouse estate moved to their own
 * modules, so `StockService` reads them through the repository-only export
 * facades. The warehouse fake therefore speaks the facade's contract, and the
 * product fake is only reached for row decoration.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { container } from 'tsyringe';
import type {
	TStockSelect,
	TMovementSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TProductSelect } from '@drizzle/schemas/product.schema';
import type { TWarehouseSelect } from '@drizzle/schemas/warehouse.schema';
import type {
	IMovementRepository,
	TProductMovementSelect,
	TMovementCreateData,
	TMovementPaginationRequest,
} from '../../src/app/inventory/contracts/movement.repository.interface';
import type {
	IStockRepository,
	TStockDelta,
	TStockKey,
	TStockPaginationRequest,
} from '../../src/app/inventory/contracts/stock.repository.interface';
import type { IProductRepository } from '../../src/app/product/contracts/product.repository.interface';
import type { ExportedProductService } from '../../src/app/product/services/exported-product.service';
import type { ExportedWarehouseService } from '../../src/app/warehouse/services/exported-warehouse.service';
import { MOVEMENT_REPOSITORY_TOKEN, STOCK_SERVICE_TOKEN, STOCK_REPOSITORY_TOKEN } from '../../src/app/inventory/constants/di';
import { StockService } from '../../src/app/inventory/services/stock.service';
import { signedContribution } from '../../src/app/inventory/repositories/movement.repository';
import { createNumberingDouble } from '../helpers/numbering-double';
import { AuditWriterDouble } from '../helpers/audit-writer-double';
import {
	InsufficientStockError,
	InventoryReferenceError,
	MovementAlreadyReversedError,
} from '../../src/app/inventory/errors/inventory.errors';

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const ITEM_ID = '01920000-0000-7000-8000-000000000001';
const GLOBAL_WAREHOUSE = '01920000-0000-7000-8000-0000000000ga';
const ORG_A_WAREHOUSE = '01920000-0000-7000-8000-0000000000wa';
const ORG_B_WAREHOUSE = '01920000-0000-7000-8000-0000000000wb';

/** The two warehouses under test: one global, one per organization. */
const WAREHOUSES: TWarehouseSelect[] = [
	warehouse(GLOBAL_WAREHOUSE, null),
	warehouse(ORG_A_WAREHOUSE, ORG_A),
	warehouse(ORG_B_WAREHOUSE, ORG_B),
];

function warehouse(
	id: string,
	organizationId: string | null,
): TWarehouseSelect {
	return {
		id,
		organizationId,
		code: id.slice(-2).toUpperCase(),
		name: `Warehouse ${id.slice(-2)}`,
		responsibleEmployeeId: null,
		imageUrl: null,
		isDefault: false,
		isActive: true,
		createdAt: new Date(0),
		updatedAt: null,
		deletedAt: null,
	};
}

/** Balance key → sign-accumulating in-memory replica of the upsert. */
type BalanceStore = Map<string, TStockSelect>;

const keyOf = (key: TStockKey): string =>
	`${key.scopeOrganizationId ?? 'GLOBAL'}::${key.warehouseId}::${key.productId}::${key.binId ?? ''}`;

/**
 * In-memory movement repository.
 *
 * @remarks
 * `claimForReversal` mirrors the real SQL: it only succeeds on a row whose
 * status is still `posted`, which is what makes a double reversal impossible.
 */
function fakeMovements(): IMovementRepository & { rows: TProductMovementSelect[] } {
	const rows: TProductMovementSelect[] = [];
	let sequence = 0;

	return {
		rows,
		async paginate(request: TMovementPaginationRequest) {
			return {
				meta: {
					page: request.page,
					limit: request.limit,
					total: rows.length,
					totalPages: 1,
				},
				data: rows,
			};
		},
		async findById(id) {
			return rows.find((row) => row.id === id) ?? null;
		},
		async create(data: TMovementCreateData, _tx?: never) {
			sequence += 1;
			const row = {
				id: `movement-${sequence}`,
				...data,
				status: data.status ?? 'posted',
				createdAt: data.createdAt ?? new Date(),
			} as TProductMovementSelect;
			rows.push(row);
			return row;
		},
		async findReversalOf(movementId) {
			return (
				rows.find(
					(row) =>
						row.referenceType === 'reversal' &&
						row.referenceId === movementId,
				) ?? null
			);
		},
		async claimForReversal(id: string, _tx?: never) {
			const row = rows.find((row) => row.id === id);
			// Exactly the SQL predicate: a row that is no longer `posted` cannot
			// be claimed.
			if (!row || row.status !== 'posted') return null;
			row.status = 'reversed';
			return row;
		},
		// The real ledger reads are scoped by a warehouse id set (ADR-0026: the
		// warehouse→organization mapping is the `warehouse` module's).
		async ledgerRows(warehouseIds: string[]) {
			return rows
				.filter((row) => warehouseIds.includes(row.warehouseId))
				.map(({ productId, warehouseId, binId, movementType, quantity, unitCost }) => ({
					productId,
					warehouseId,
					binId,
					movementType,
					quantity,
					unitCost,
				}));
		},
		async ledgerTotals(warehouseIds: string[]) {
			const signed = new Map<string, number>();
			for (const row of rows) {
				if (!warehouseIds.includes(row.warehouseId)) continue;
				const key = `${row.warehouseId}::${row.productId}::${row.binId ?? ''}`;
				// NOT `continue` for reversed rows: the entry must still exist so a
				// fully reversed key is reported with a total of 0 and the service
				// can remove its balance row.
				signed.set(
					key,
					(signed.get(key) ?? 0) +
						signedContribution(row.movementType, row.quantity, row.status),
				);
			}
			return [...signed.entries()].map(([key, quantity]) => {
				const [warehouseId, productId, binId] = key.split('::');
				return {
					productId: productId!,
					warehouseId: warehouseId!,
					binId: binId === '' ? null : binId!,
					quantity: quantity.toFixed(3),
				};
			});
		},
	};
}

/** In-memory balance repository, mirroring the real upsert semantics. */
function fakeBalances(store: BalanceStore): IStockRepository {
	return {
		async paginate(request: TStockPaginationRequest) {
			return {
				meta: {
					page: request.page,
					limit: request.limit,
					total: store.size,
					totalPages: 1,
				},
				data: [...store.values()],
			};
		},
		async findByKey(key) {
			return store.get(keyOf(key)) ?? null;
		},
		async lockForCost(key) {
			const row = store.get(keyOf(key));
			return {
				quantityOnHand: row?.quantityOnHand ?? '0',
				availableCost: 0,
				averageCost: row?.averageCost ?? 0,
				totalValue: row?.totalValue ?? 0,
			};
		},
		async setCost(key, cost) {
			const row = store.get(keyOf(key));
			if (row) Object.assign(row, cost);
		},
		async listByScope(scopeOrganizationId) {
			return [...store.values()].filter(
				(row) => row.organizationId === scopeOrganizationId,
			);
		},
		async applyDelta(key, delta: TStockDelta) {
			const existing = store.get(keyOf(key));
			if (!existing) {
				// Mirror the repository: a negative opening delta is refused
				// (the CHECK constraints would reject it in the database).
				if (Number(delta.quantity) < 0) {
					throw new InsufficientStockError('0.000', delta.quantity);
				}
				const created = {
					id: `balance-${store.size}`,
					organizationId: key.scopeOrganizationId,
					productId: key.productId,
					warehouseId: key.warehouseId,
					binId: key.binId,
					quantityOnHand: delta.quantity,
					quantityReserved: '0',
					quantityAvailable: delta.quantity,
					averageCost: 0,
					totalValue: 0,
					lastMovementAt: delta.occurredAt,
					createdAt: new Date(),
					updatedAt: null,
				} as TStockSelect;
				store.set(keyOf(key), created);
				return created;
			}
			// Accumulate — the whole point of the serialized upsert-then-lock
			// path. Mirrors the repository's conditional UPDATE: a delta that
			// would overdraw the balance is refused, not applied.
			const onHand = Number(existing.quantityOnHand) + Number(delta.quantity);
			if (onHand < 0) {
				throw new InsufficientStockError(
					existing.quantityOnHand,
					delta.quantity,
				);
			}
			existing.quantityOnHand = onHand.toFixed(3);
			existing.quantityAvailable = onHand.toFixed(3);
			existing.lastMovementAt = delta.occurredAt;
			return existing;
		},
		async setQuantity(key, quantity) {
			const existing = store.get(keyOf(key));
			if (existing) {
				existing.quantityOnHand = quantity;
				existing.quantityAvailable = quantity;
				return existing;
			}
			const created = {
				id: `balance-${store.size}`,
				organizationId: key.scopeOrganizationId,
				productId: key.productId,
				warehouseId: key.warehouseId,
				binId: key.binId,
				quantityOnHand: quantity,
				quantityReserved: '0',
				quantityAvailable: quantity,
				averageCost: 0,
				totalValue: 0,
				lastMovementAt: null,
				createdAt: new Date(),
				updatedAt: null,
			} as TStockSelect;
			store.set(keyOf(key), created);
			return created;
		},
		async remove(key) {
			return store.delete(keyOf(key));
		},
		async availableByProducts() {
			return [];
		},
		async productIdsInWarehouse() {
			return [];
		},
		async countMaterialStocks() {
			return [];
		},
	};
}

/**
 * Product facade double.
 *
 * @remarks
 * `StockService` only asks it for row decoration (`productsById`,
 * `getNameMap`), so the fake answers from an empty catalogue: the ledger
 * assertions never look at names.
 */
function fakeProducts(): Pick<ExportedProductService, 'productsById' | 'getNameMap'> & {
	asyncProducts?: never;
} {
	return {
		async productsById() {
			return new Map();
		},
		async getNameMap() {
			return new Map<string, string>();
		},
	};
}

/**
 * Warehouse facade double over the in-memory estate.
 *
 * @remarks
 * This replaces the old `IWarehouseRepository` fake: since ADR-0026 the
 * warehouse→scope mapping belongs to the `warehouse` module, and the only way
 * `inventory` may see it is this contract.
 */
function fakeWarehouses(): Pick<
	ExportedWarehouseService,
	'warehouseExists' | 'organizationScope' | 'isLinked' | 'getNameMap' | 'idsInScope'
> {
	return {
		async warehouseExists(warehouseId) {
			return WAREHOUSES.some((row) => row.id === warehouseId);
		},
		async organizationScope(warehouseId) {
			const row = WAREHOUSES.find((candidate) => candidate.id === warehouseId);
			return row === undefined
				? { found: false as const }
				: { found: true as const, organizationId: row.organizationId };
		},
		// ERP-0031: service-level link assert — link every fake warehouse to a
		// test org so internal flows pass.
		async isLinked(_warehouseId, organizationId) {
			return organizationId === ORG_A;
		},
		async getNameMap(ids) {
			return new Map(
				WAREHOUSES.filter((row) => ids.includes(row.id)).map((row) => [
					row.id,
					row.name,
				]),
			);
		},
		async idsInScope(organizationId) {
			return WAREHOUSES.filter((row) => row.organizationId === organizationId).map(
				(row) => row.id,
			);
		},
	};
}

/** Kept typed so a drift in the product contract is a compile error. */
export type TStockTestProductRow = TProductSelect;
export type TStockTestMovementRow = TMovementSelect;
/** The product repository is no longer injected by `StockService`; kept for
 * the type-level assertion that the contract still exists. */
export type TStockTestProductRepository = IProductRepository;

let balances: BalanceStore;
let movements: ReturnType<typeof fakeMovements>;
let service: StockService;

beforeEach(() => {
	balances = new Map();
	movements = fakeMovements();

	// The service brackets claim + reversal row + balance in
	// `database.transaction`, and relies on the rollback to undo a claim when a
	// guard fails. The fake models that with a snapshot: on throw, movements and
	// balances are restored to their pre-transaction state.
	const database = {
		transaction: async (callback: (tx: null) => unknown) => {
			const movementSnapshot = movements.rows.map((row) => ({ ...row }));
			const balanceSnapshot = new Map(
				[...balances.entries()].map(([key, row]) => [key, { ...row }]),
			);
			try {
				return await callback(null);
			} catch (error) {
				movements.rows.length = 0;
				movements.rows.push(...movementSnapshot);
				balances.clear();
				for (const [key, row] of balanceSnapshot) balances.set(key, row);
				throw error;
			}
		},
	} as never;

	container.register(MOVEMENT_REPOSITORY_TOKEN, { useValue: movements });
	container.register(STOCK_REPOSITORY_TOKEN, {
		useValue: fakeBalances(balances),
	});
	container.register(STOCK_SERVICE_TOKEN, {
		useValue: new StockService(
			movements,
			container.resolve(STOCK_REPOSITORY_TOKEN),
			fakeWarehouses() as never,
			fakeProducts() as never,
			// Photo URLs are decoration only; the ledger tests do not assert them.
			{ presignGet: () => '' },
			createNumberingDouble(),
			new AuditWriterDouble(),
			database,
		),
	});
	service = container.resolve<StockService>(STOCK_SERVICE_TOKEN);
});

/** Reads the balance row a scope/warehouse/product combination should produce. */
async function balanceOf(
	scope: string | null,
	warehouseId: string,
): Promise<string> {
	const row = await service.balanceFor(scope, warehouseId, ITEM_ID, null);
	return row?.quantityOnHand ?? '0';
}

describe('stock — scope rule', () => {
	test('a receipt into an organization warehouse lands in that organization scope', async () => {
		const posted = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});

		expect(posted.scopeOrganizationId).toBe(ORG_A);
		expect(posted.balance.organizationId).toBe(ORG_A);
		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe('10.000');
		// Isolation: org B's scope has no such balance.
		expect(await balanceOf(ORG_B, ORG_A_WAREHOUSE)).toBe('0');
	});

	test('a receipt into a global warehouse produces ONE shared row', async () => {
		const posted = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: GLOBAL_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});

		// The scope follows the WAREHOUSE, not the caller.
		expect(posted.scopeOrganizationId).toBeNull();
		expect(posted.balance.organizationId).toBeNull();
	});

	test('org B sees and adds to the stock org A received into a global warehouse', async () => {
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: GLOBAL_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		const second = await service.postMovement({
			actorOrganizationId: ORG_B,
			warehouseId: GLOBAL_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '5.000',
		});

		// One shared balance, and the movement still records WHO acted.
		expect(second.balance.quantityOnHand).toBe('15.000');
		expect(await balanceOf(null, GLOBAL_WAREHOUSE)).toBe('15.000');
		expect(second.movement.organizationId).toBe(ORG_B);
	});

	test('the shared and per-tenant balances for one product never mix', async () => {
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: GLOBAL_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '3.000',
		});

		expect(await balanceOf(null, GLOBAL_WAREHOUSE)).toBe('10.000');
		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe('3.000');
		expect(balances.size).toBe(2);
	});

	test('an unknown warehouse is a 422 reference error, not a silent global scope', async () => {
		// ADR-0026: the scope answer comes from the `warehouse` facade, and a
		// `{ found: false }` answer must stop the write.
		await expect(
			service.resolveScope('01920000-0000-7000-8000-00000000dead'),
		).rejects.toBeInstanceOf(InventoryReferenceError);
	});

	test('assertWarehouseLinkedFor refuses an unlinked warehouse', async () => {
		// The fake links every warehouse to ORG_A only.
		await expect(
			service.assertWarehouseLinkedFor(ORG_A_WAREHOUSE, ORG_B),
		).rejects.toBeInstanceOf(InventoryReferenceError);
		await expect(
			service.assertWarehouseLinkedFor(ORG_A_WAREHOUSE, ORG_A),
		).resolves.toBeUndefined();
	});
});

describe('stock — negative stock is refused', () => {
	test.each([
		'issue',
		'transfer_out',
		'adjustment_out',
		'return_out',
		'consumption',
		'issue',
	] as const)('%s cannot take the balance below zero', async (movementType) => {
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '5.000',
		});

		await expect(
			service.postMovement({
				actorOrganizationId: ORG_A,
				warehouseId: ORG_A_WAREHOUSE,
				productId: ITEM_ID,
				movementType,
				quantity: '6.000',
				...(movementType === 'transfer_out'
					? { targetWarehouseId: ORG_B_WAREHOUSE }
					: {}),
			}),
		).rejects.toBeInstanceOf(InsufficientStockError);

		// The refusal left nothing behind.
		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe('5.000');
	});

	test('an exact draw-down to zero is allowed', async () => {
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '5.000',
		});
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'issue',
			quantity: '5.000',
		});

		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe('0.000');
	});

	test('stock in another organization does not license a withdrawal', async () => {
		await service.postMovement({
			actorOrganizationId: ORG_B,
			warehouseId: ORG_B_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '100.000',
		});

		// Org A's warehouse is empty even though org B is stocked.
		await expect(
			service.postMovement({
				actorOrganizationId: ORG_A,
				warehouseId: ORG_A_WAREHOUSE,
				productId: ITEM_ID,
				movementType: 'issue',
				quantity: '1.000',
			}),
		).rejects.toBeInstanceOf(InsufficientStockError);
	});
});

describe('stock — reversal', () => {
	test('reversing a receipt is refused when its stock has already been issued', async () => {
		const receipt = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'issue',
			quantity: '4.000',
		});
		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe('6.000');

		// 6 - 10 = -4 would be negative, so it must be refused, not applied.
		// A reversal is not a licence to go negative.
		await expect(
			service.reverseMovement(receipt.movement.id, ORG_A),
		).rejects.toBeInstanceOf(InsufficientStockError);

		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe('6.000');
	});

	test('a refused reversal leaves the movement posted and retryable', async () => {
		const receipt = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'issue',
			quantity: '10.000',
		});

		await expect(
			service.reverseMovement(receipt.movement.id, ORG_A),
		).rejects.toBeInstanceOf(InsufficientStockError);

		// The claim was rolled back with the transaction, so the row is still
		// reversable once stock exists again — and no reversal row was written.
		const stored = movements.rows.find((row) => row.id === receipt.movement.id);
		expect(stored?.status).toBe('posted');
		expect(
			movements.rows.filter((row) => row.referenceType === 'reversal'),
		).toHaveLength(0);
	});

	test('reversing an issue returns the stock', async () => {
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		const issue = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'issue',
			quantity: '4.000',
		});
		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe('6.000');

		await service.reverseMovement(issue.movement.id, ORG_A);

		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe('10.000');
	});

	test('the reversal row points at its original and carries the opposite direction', async () => {
		const receipt = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});

		const reversed = await service.reverseMovement(receipt.movement.id, ORG_A);

		expect(reversed.movement.referenceType).toBe('reversal');
		expect(reversed.movement.referenceId).toBe(receipt.movement.id);
		// Reversing an inbound receipt is an outbound movement.
		expect(reversed.movement.movementType).toBe('adjustment_out');
	});

	test('reversing twice is refused', async () => {
		const receipt = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		await service.reverseMovement(receipt.movement.id, ORG_A);

		// The first reversal succeeded; a second must not re-apply it.
		await expect(
			service.reverseMovement(receipt.movement.id, ORG_A),
		).rejects.toBeInstanceOf(MovementAlreadyReversedError);
	});

	test('a reversal is reachable from a shared (global) balance', async () => {
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: GLOBAL_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		const issue = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: GLOBAL_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'issue',
			quantity: '4.000',
		});

		// Org B reverses what org A posted into the shared space: the scope is
		// the warehouse's, so this touches the same balance row.
		await service.reverseMovement(issue.movement.id, ORG_B);

		expect(await balanceOf(null, GLOBAL_WAREHOUSE)).toBe('10.000');
	});
});

describe('stock — the ledger is the truth', () => {
	/**
	 * The core invariant: incremental balances must equal a full recompute.
	 *
	 * @remarks
	 * This is the test that would catch an incremental update that drifts —
	 * the failure mode D16 exists to prevent.
	 */
	test('balances agree with recomputeFromLedger after a mixed history', async () => {
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		const orgAIssue = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'issue',
			quantity: '3.000',
		});
		await service.postMovement({
			actorOrganizationId: ORG_B,
			warehouseId: GLOBAL_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '7.000',
		});
		const globalIssue = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: GLOBAL_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'issue',
			quantity: '2.000',
		});

		// Reverse the ISSUES: that direction adds stock back, so it is legal.
		// Reversing the receipts would be refused (it would go negative), which
		// is a separate rule already covered above.
		await service.reverseMovement(orgAIssue.movement.id, ORG_A);
		await service.reverseMovement(globalIssue.movement.id, ORG_A);

		const before = {
			orgA: await balanceOf(ORG_A, ORG_A_WAREHOUSE),
			global: await balanceOf(null, GLOBAL_WAREHOUSE),
		};

		// Rebuild from the ledger only.
		await service.recomputeFromLedger(ORG_A);
		await service.recomputeFromLedger(null);

		// The invariant: incremental balances equal a full recompute.
		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe(before.orgA);
		expect(await balanceOf(null, GLOBAL_WAREHOUSE)).toBe(before.global);
		// Sanity: those are the numbers the history implies. Reversing an issue
		// puts its quantity BACK, so both balances grow relative to the issue.
		expect(before.orgA).toBe('10.000'); // 10 - 3 + 3
		expect(before.global).toBe('7.000'); // 7 - 2 + 2
	});

	test('recompute is idempotent', async () => {
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '9.000',
		});

		const first = await service.recomputeFromLedger(ORG_A);
		const second = await service.recomputeFromLedger(ORG_A);

		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe('9.000');
		expect(second).toEqual(first);
	});

	test('recompute removes a fully reversed key instead of leaving a zero row', async () => {
		const receipt = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '4.000',
		});
		await service.reverseMovement(receipt.movement.id, ORG_A);

		// The incremental path leaves the zero row; recompute cleans it up.
		expect(balances.size).toBe(1);
		await service.recomputeFromLedger(ORG_A);
		expect(balances.size).toBe(0);
	});

	test('recompute only touches its own scope', async () => {
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '9.000',
		});
		await service.postMovement({
			actorOrganizationId: ORG_B,
			warehouseId: ORG_B_WAREHOUSE,
			productId: ITEM_ID,
			movementType: 'receipt',
			quantity: '2.000',
		});

		await service.recomputeFromLedger(ORG_A);

		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe('9.000');
		// Org B untouched.
		expect(await balanceOf(ORG_B, ORG_B_WAREHOUSE)).toBe('2.000');
	});
});

describe('stock — moving-average cost (ADR-0011 §5)', () => {
	test('cost follows receipts, issues and reversals, and recompute rebuilds the same value', async () => {
		const post = (
			movementType: 'receipt' | 'issue',
			quantity: string,
			unitCost?: number,
		) =>
			service.postMovement({
				actorOrganizationId: ORG_A,
				warehouseId: ORG_A_WAREHOUSE,
				productId: ITEM_ID,
				movementType,
				quantity,
				unitCost,
			});
		const first = await post('receipt', '10.000', 1_000);
		expect(first.movement.unitCost).toBe(1_000);
		await post('receipt', '5.000', 1_300);
		const issue = await post('issue', '3.000');
		// Outbound leaves at the average of 16 500 / 15.
		expect(issue.movement.unitCost).toBe(1_100);
		expect(issue.balance).toMatchObject({ averageCost: 1_100, totalValue: 13_200 });
		const reversal = await service.reverseMovement(issue.movement.id, ORG_A);
		expect(reversal.movement.unitCost).toBe(1_100);
		expect(reversal.balance).toMatchObject({ averageCost: 1_100, totalValue: 16_500 });

		const before = await service.balanceFor(ORG_A, ORG_A_WAREHOUSE, ITEM_ID, null);
		await service.recomputeFromLedger(ORG_A);
		const after = await service.balanceFor(ORG_A, ORG_A_WAREHOUSE, ITEM_ID, null);
		expect(after).toMatchObject({
			averageCost: before!.averageCost,
			totalValue: before!.totalValue,
		});
	});
});
