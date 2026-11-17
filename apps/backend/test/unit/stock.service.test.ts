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
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { container } from 'tsyringe';
import type {
	TItemSelect,
	TStockBalanceSelect,
	TStockMovementSelect,
	TWarehouseSelect,
} from '@drizzle/schemas/inventory.schema';
import type {
	IMovementRepository,
	TMovementCreateData,
	TMovementPaginationRequest,
} from '../../src/app/inventory/contracts/movement.repository.interface';
import type {
	IBalanceRepository,
	TBalanceDelta,
	TBalanceKey,
	TBalancePaginationRequest,
} from '../../src/app/inventory/contracts/balance.repository.interface';
import type { IItemRepository } from '../../src/app/inventory/contracts/item.repository.interface';
import type { IWarehouseRepository } from '../../src/app/inventory/contracts/warehouse.repository.interface';
import {
	BALANCE_REPOSITORY_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	MOVEMENT_REPOSITORY_TOKEN,
	STOCK_SERVICE_TOKEN,
	WAREHOUSE_REPOSITORY_TOKEN,
} from '../../src/app/inventory/constants/di';
import { StockService } from '../../src/app/inventory/services/stock.service';
import { signedContribution } from '../../src/app/inventory/repositories/movement.repository';
import { createNumberingDouble } from '../helpers/numbering-double';
import { AuditWriterDouble } from '../helpers/audit-writer-double';
import {
	InsufficientStockError,
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
		isDefault: false,
		isActive: true,
		createdAt: new Date(0),
		updatedAt: null,
		deletedAt: null,
	} as TWarehouseSelect;
}

/** Balance key → sign-accumulating in-memory replica of the upsert. */
type BalanceStore = Map<string, TStockBalanceSelect>;

const keyOf = (key: TBalanceKey): string =>
	`${key.scopeOrganizationId ?? 'GLOBAL'}::${key.warehouseId}::${key.itemId}::${key.binId ?? ''}`;

/**
 * In-memory movement repository.
 *
 * @remarks
 * `claimForReversal` mirrors the real SQL: it only succeeds on a row whose
 * status is still `posted`, which is what makes a double reversal impossible.
 */
function fakeMovements(): IMovementRepository & { rows: TStockMovementSelect[] } {
	const rows: TStockMovementSelect[] = [];
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
		async create(data: TMovementCreateData) {
			sequence += 1;
			const row = {
				id: `movement-${sequence}`,
				...data,
				status: data.status ?? 'posted',
				createdAt: data.createdAt ?? new Date(),
			} as TStockMovementSelect;
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
		async claimForReversal(id) {
			const row = rows.find((row) => row.id === id);
			// Exactly the SQL predicate: a row that is no longer `posted` cannot
			// be claimed.
			if (!row || row.status !== 'posted') return null;
			row.status = 'reversed';
			return row;
		},
		async ledgerRows(scopeOrganizationId) {
			return rows
				.filter(
					(row) => (WAREHOUSES.find((w) => w.id === row.warehouseId)?.organizationId ?? null) === scopeOrganizationId,
				)
				.map(({ itemId, warehouseId, binId, movementType, quantity, unitCost }) => ({
					itemId,
					warehouseId,
					binId,
					movementType,
					quantity,
					unitCost,
				}));
		},
		async ledgerTotals(scopeOrganizationId) {
			const signed = new Map<string, number>();
			for (const row of rows) {
				// A movement's balance scope is its warehouse's scope, exactly as
				// the service decides it.
				const scope =
					WAREHOUSES.find((w) => w.id === row.warehouseId)?.organizationId ??
					null;
				if (scope !== scopeOrganizationId) continue;
				const key = `${row.warehouseId}::${row.itemId}::${row.binId ?? ''}`;
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
				const [warehouseId, itemId, binId] = key.split('::');
				return {
					itemId,
					warehouseId,
					binId: binId === '' ? null : binId,
					quantity: quantity.toFixed(3),
				};
			});
		},
	};
}

/** In-memory balance repository, mirroring the real upsert semantics. */
function fakeBalances(store: BalanceStore): IBalanceRepository {
	return {
		async paginate(request: TBalancePaginationRequest) {
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
		async applyDelta(key, delta: TBalanceDelta) {
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
					itemId: key.itemId,
					warehouseId: key.warehouseId,
					binId: key.binId,
					quantityOnHand: delta.quantity,
					quantityReserved: '0',
					quantityAvailable: delta.quantity,
					lastMovementAt: delta.occurredAt,
					createdAt: new Date(),
					updatedAt: null,
				} as TStockBalanceSelect;
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
				itemId: key.itemId,
				warehouseId: key.warehouseId,
				binId: key.binId,
				quantityOnHand: quantity,
				quantityReserved: '0',
				quantityAvailable: quantity,
				lastMovementAt: null,
				createdAt: new Date(),
				updatedAt: null,
			} as TStockBalanceSelect;
			store.set(keyOf(key), created);
			return created;
		},
		async remove(key) {
			return store.delete(keyOf(key));
		},
		async availableByItems() {
			return [];
		},
	};
}

/** Minimal warehouse repository: `findById` is all the service uses. */
function fakeItems(): IItemRepository {
	return {
		async paginate() {
			return {
				meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
				data: [],
			};
		},
		async findById() {
			return null;
		},
		async findActiveByIds() {
			return [];
		},
		async findBySku() {
			return null;
		},
		async create(data) {
			return data as TItemSelect;
		},
		async update() {
			return null;
		},
		async archive() {
			return null;
		},
		async findNamesByIds() {
			return [];
		},
		async countUnits() {
			return 0;
		},
	};
}

function fakeWarehouses(): IWarehouseRepository {
	return {
		async paginate() {
			return {
				meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
				data: [],
			};
		},
		async findById(id) {
			return WAREHOUSES.find((row) => row.id === id) ?? null;
		},
		async findAlive(ids) {
			return ids
				? WAREHOUSES.filter((row) => ids.includes(row.id))
				: WAREHOUSES;
		},
		// ERP-0031: service-level link assert — link every fake warehouse to a
		// test org so internal flows pass.
		async isLinked(warehouseId, organizationId) {
			return organizationId === 'org-a';
		},
		async listLinked(organizationId) {
			return organizationId === 'org-a' ? WAREHOUSES : [];
		},
		async listOrganizations() {
			return [];
		},
		async linkOrganization() {
			return { created: true };
		},
		async unlinkOrganization() {
			return false;
		},
		async findByCode() {
			return null;
		},
		async create(data) {
			return { ...data, id: 'new' } as TWarehouseSelect;
		},
		async update() {
			return null;
		},
		async archive() {
			return null;
		},
		async findNamesByIds() {
			return [];
		},
		async clearDefaultExcept() {},
		async countLiveUnits() {
			return 0;
		},
		async countKinds(warehouseIds) {
			return warehouseIds.map((warehouseId) => ({
				warehouseId,
				productsCount: 0,
				componentsCount: 0,
				materialsCount: 0,
				equipmentsCount: 0,
				storagesCount: 0,
			}));
		},
	} as IWarehouseRepository;
}

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
	container.register(BALANCE_REPOSITORY_TOKEN, {
		useValue: fakeBalances(balances),
	});
	container.register(WAREHOUSE_REPOSITORY_TOKEN, {
		useValue: fakeWarehouses(),
	});
	container.register(ITEM_REPOSITORY_TOKEN, {
		useValue: fakeItems(),
	});
	container.register(STOCK_SERVICE_TOKEN, { useValue: new StockService(
		container.resolve(MOVEMENT_REPOSITORY_TOKEN),
		container.resolve(BALANCE_REPOSITORY_TOKEN),
		container.resolve(WAREHOUSE_REPOSITORY_TOKEN),
		container.resolve(ITEM_REPOSITORY_TOKEN),
		// Photo URLs are decoration only; the ledger tests do not assert them.
		{ urlFor: () => null } as never,
		createNumberingDouble(),
		new AuditWriterDouble(),
		database,
	) });
	service = container.resolve<StockService>(STOCK_SERVICE_TOKEN);
});

/** Reads the balance row a scope/warehouse/item combination should produce. */
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
			itemId: ITEM_ID,
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
			itemId: ITEM_ID,
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
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		const second = await service.postMovement({
			actorOrganizationId: ORG_B,
			warehouseId: GLOBAL_WAREHOUSE,
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '5.000',
		});

		// One shared balance, and the movement still records WHO acted.
		expect(second.balance.quantityOnHand).toBe('15.000');
		expect(await balanceOf(null, GLOBAL_WAREHOUSE)).toBe('15.000');
		expect(second.movement.organizationId).toBe(ORG_B);
	});

	test('the shared and per-tenant balances for one item never mix', async () => {
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: GLOBAL_WAREHOUSE,
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '3.000',
		});

		expect(await balanceOf(null, GLOBAL_WAREHOUSE)).toBe('10.000');
		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe('3.000');
		expect(balances.size).toBe(2);
	});
});

describe('stock — negative stock is refused', () => {
	test.each([
		'issue',
		'transfer_out',
		'adjustment_out',
		'return_out',
		'consumption',
		'borrowing_out',
	] as const)('%s cannot take the balance below zero', async (movementType) => {
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '5.000',
		});

		await expect(
			service.postMovement({
				actorOrganizationId: ORG_A,
				warehouseId: ORG_A_WAREHOUSE,
				itemId: ITEM_ID,
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
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '5.000',
		});
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			itemId: ITEM_ID,
			movementType: 'issue',
			quantity: '5.000',
		});

		expect(await balanceOf(ORG_A, ORG_A_WAREHOUSE)).toBe('0.000');
	});

	test('stock in another organization does not license a withdrawal', async () => {
		await service.postMovement({
			actorOrganizationId: ORG_B,
			warehouseId: ORG_B_WAREHOUSE,
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '100.000',
		});

		// Org A's warehouse is empty even though org B is stocked.
		await expect(
			service.postMovement({
				actorOrganizationId: ORG_A,
				warehouseId: ORG_A_WAREHOUSE,
				itemId: ITEM_ID,
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
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			itemId: ITEM_ID,
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
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			itemId: ITEM_ID,
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
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		const issue = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			itemId: ITEM_ID,
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
			itemId: ITEM_ID,
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
			itemId: ITEM_ID,
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
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		const issue = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: GLOBAL_WAREHOUSE,
			itemId: ITEM_ID,
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
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '10.000',
		});
		const orgAIssue = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: ORG_A_WAREHOUSE,
			itemId: ITEM_ID,
			movementType: 'issue',
			quantity: '3.000',
		});
		await service.postMovement({
			actorOrganizationId: ORG_B,
			warehouseId: GLOBAL_WAREHOUSE,
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '7.000',
		});
		const globalIssue = await service.postMovement({
			actorOrganizationId: ORG_A,
			warehouseId: GLOBAL_WAREHOUSE,
			itemId: ITEM_ID,
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
			itemId: ITEM_ID,
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
			itemId: ITEM_ID,
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
			itemId: ITEM_ID,
			movementType: 'receipt',
			quantity: '9.000',
		});
		await service.postMovement({
			actorOrganizationId: ORG_B,
			warehouseId: ORG_B_WAREHOUSE,
			itemId: ITEM_ID,
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
		const post = (movementType: 'receipt' | 'issue', quantity: string, unitCost?: number) =>
			service.postMovement({
				actorOrganizationId: ORG_A,
				warehouseId: ORG_A_WAREHOUSE,
				itemId: ITEM_ID,
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
		expect(after).toMatchObject({ averageCost: before!.averageCost, totalValue: before!.totalValue });
	});
});
