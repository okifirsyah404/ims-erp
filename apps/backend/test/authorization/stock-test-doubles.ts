/**
 * Test doubles and a capture bag for the stock/adjustment authorization tests.
 *
 * @remarks
 * Split out of the test file because both the stock and adjustment controllers
 * resolve different services, and the capture needs to be shared between them.
 * The repositories are stubbed at their DI seams, so the REAL controllers and
 * services run; only persistence is faked.
 */
import { container } from 'tsyringe';
import type {
	TStockAdjustmentSelect,
	TStockSelect,
	TMovementSelect,
	TWarehouseSelect,
} from '@drizzle/schemas/inventory.schema';
import type {
	IMovementRepository,
	TMovementCreateData,
	TMovementPaginationRequest,
} from '../../src/app/inventory/contracts/movement.repository.interface';
import type {
	IStockRepository,
	TStockPaginationRequest,
} from '../../src/app/inventory/contracts/stock.repository.interface';
import type {
	IAdjustmentRepository,
	TAdjustmentPaginationRequest,
} from '../../src/app/inventory/contracts/adjustment.repository.interface';
import type {
	IProductRepository,
	TProductPaginationRequest,
} from '../../src/app/inventory/contracts/product.repository.interface';
import type { IWarehouseRepository } from '../../src/app/inventory/contracts/warehouse.repository.interface';
import type { TPostMovementInput } from '../../src/app/inventory/services/stock.service';
import {
	ADJUSTMENT_REPOSITORY_TOKEN,
	ADJUSTMENT_SERVICE_TOKEN,
	STOCK_REPOSITORY_TOKEN,
	PRODUCT_REPOSITORY_TOKEN,
	MOVEMENT_REPOSITORY_TOKEN,
	STOCK_SERVICE_TOKEN,
	WAREHOUSE_REPOSITORY_TOKEN,
} from '../../src/app/inventory/constants/di';
import { StockService } from '../../src/app/inventory/services/stock.service';
import { AdjustmentService } from '../../src/app/inventory/services/adjustment.service';
import { createNumberingDouble } from '../helpers/numbering-double';
import { AuditWriterDouble } from '../helpers/audit-writer-double';
import { ORG_A } from './test-app';

/** An adjustment row, writable by the test between requests. */
export type IStockAdjustmentSelectLike = TStockAdjustmentSelect;

/** What the stubs saw, so a test can assert on scope and payloads. */
export type TAdjustmentCapture = {
	/** Scope the balance list was asked for. */
	balanceScope: string | null | undefined;
	/** Scope the movement ledger was asked for. */
	movementScope: string | null | undefined;
	/** The last movement the service tried to post, if any. */
	postedMovement: TPostMovementInput | null;
	/** The acting organization recorded on that movement. */
	movementActorOrganizationId: string | null;
	/** The document `findById` should answer with, if any. */
	adjustment: TStockAdjustmentSelect | null;
};

/** Mutable capture bag, reset between tests. */
export const capture: TAdjustmentCapture = {
	balanceScope: undefined,
	movementScope: undefined,
	postedMovement: null,
	movementActorOrganizationId: null,
	adjustment: null,
};

/** Clears captured state. Call from `beforeEach`. */
export function resetCapture(): void {
	capture.balanceScope = undefined;
	capture.movementScope = undefined;
	capture.postedMovement = null;
	capture.movementActorOrganizationId = null;
	capture.adjustment = null;
}

const WAREHOUSE: TWarehouseSelect = {
	id: '01920000-0000-7000-8000-0000000000aa',
	organizationId: null,
	code: 'MAIN',
	name: 'Main warehouse',
	responsibleEmployeeId: null,
	isDefault: true,
	isActive: true,
	createdAt: new Date(0),
	updatedAt: null,
	deletedAt: null,
} as TWarehouseSelect;

const emptyPage = (page: number, limit: number) => ({
	meta: { page, limit, total: 0, totalPages: 0 },
	data: [],
});

/** Registers every stock/adjustment repository and service double. */
export function installStockDoubles(): void {
	const movements: IMovementRepository = {
		async paginate(request: TMovementPaginationRequest) {
			capture.movementScope = request.scopeOrganizationId;
			return emptyPage(request.page, request.limit);
		},
		async findById() {
			return null;
		},
		async create(data: TMovementCreateData) {
			// The ledger row records the ACTING organization (who did it), which
			// is what a caller-identity assertion needs — it is not the balance
			// scope, which follows the warehouse.
			capture.postedMovement = data as unknown as TPostMovementInput;
			capture.movementActorOrganizationId = data.organizationId ?? null;
			return { ...data, id: 'movement-1' } as TMovementSelect;
		},
		async findReversalOf() {
			return null;
		},
		async claimForReversal() {
			return null;
		},
		async ledgerRows() {
			return [];
		},
		async ledgerTotals() {
			return [];
		},
	};

	const balances: IStockRepository = {
		async paginate(request: TStockPaginationRequest) {
			capture.balanceScope = request.scopeOrganizationId;
			return emptyPage(request.page, request.limit);
		},
		async findByKey() {
			return null;
		},
		async lockForCost() {
			return { quantityOnHand: '0', averageCost: 0, totalValue: 0 };
		},
		async setCost() {},
		async listByScope() {
			return [];
		},
		async applyDelta(key) {
			return {
				id: 'balance-1',
				organizationId: key.scopeOrganizationId,
				productId: key.productId,
				warehouseId: key.warehouseId,
				binId: key.binId,
				quantityOnHand: '0.000',
				quantityReserved: '0.000',
				quantityAvailable: '0.000',
				lastMovementAt: null,
				createdAt: new Date(0),
				updatedAt: null,
			} as TStockSelect;
		},
		async setQuantity() {
			return {} as TStockSelect;
		},
		async remove() {
			return false;
		},
		async availableByProducts() {
			return [];
		},
	};

	const adjustments: IAdjustmentRepository = {
		async paginate(request: TAdjustmentPaginationRequest) {
			return emptyPage(request.page, request.limit);
		},
		async findById() {
			return capture.adjustment;
		},
		async findByCode() {
			return null;
		},
		async create(data) {
			return { ...data, id: 'adjustment-new' } as TStockAdjustmentSelect;
		},
		async update(id, data) {
			if (!capture.adjustment) return null;
			capture.adjustment = { ...capture.adjustment, ...data };
			return capture.adjustment;
		},
		async claimForPost(id: string, _tx: unknown) {
			const row = capture.adjustment;
			if (
				!row ||
				row.id !== id ||
				row.status !== 'approved' ||
				row.postedAt !== null
			) {
				return null;
			}
			capture.adjustment = { ...row, status: 'posted', postedAt: new Date() };
			return capture.adjustment;
		},
		async listLines() {
			return [];
		},
		async createLines() {
			return [];
		},
		async replaceLines() {
			return [];
		},
	};

	/** Simulates the single alive link row of the fake (ERP-0031). */
	let linkRow = true;

	const warehouses: IWarehouseRepository = {
		async paginate() {
			return emptyPage(1, 20);
		},
		async findById(id) {
			return id === WAREHOUSE.id ? WAREHOUSE : null;
		},
		async findAlive(ids) {
			if (ids && !ids.includes(WAREHOUSE.id)) return [];
			return [WAREHOUSE];
		},
		// ERP-0031: the test warehouse is linked to ORG_A (the fixture's member
		// org), so actor-driven stock writes pass the controller link gate.
		async isLinked(warehouseId, organizationId) {
			return warehouseId === WAREHOUSE.id && organizationId === ORG_A;
		},
		async listLinked(organizationId) {
			return organizationId === ORG_A ? [WAREHOUSE] : [];
		},
		async listOrganizations(warehouseId) {
			return warehouseId === WAREHOUSE.id && linkRow
				? [{ organizationId: ORG_A, createdAt: new Date(0) }]
				: [];
		},
		async linkOrganization(warehouseId, organizationId) {
			if (warehouseId === WAREHOUSE.id && organizationId === ORG_A && linkRow)
				return { created: false };
			linkRow = true;
			return { created: true };
		},
		async unlinkOrganization(warehouseId, organizationId) {
			const matched = warehouseId === WAREHOUSE.id && organizationId === ORG_A && linkRow;
			linkRow = false;
			return matched;
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
	};

	const items: IProductRepository = {
		async paginate(_request: TProductPaginationRequest) {
			return emptyPage(1, 20);
		},
		async findById(id: string) {
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
		async countUnits() {
			return 0;
		},
	} as unknown as IProductRepository;

	// The services open `database.transaction` for their multi-statement writes;
	// the double runs the callback directly because the repositories are stubs.
	const database = {
		transaction: async (callback: (tx: null) => unknown) => callback(null),
	} as never;

	container.register(MOVEMENT_REPOSITORY_TOKEN, { useValue: movements });
	container.register(STOCK_REPOSITORY_TOKEN, { useValue: balances });
	container.register(ADJUSTMENT_REPOSITORY_TOKEN, { useValue: adjustments });
	container.register(WAREHOUSE_REPOSITORY_TOKEN, { useValue: warehouses });
	container.register(PRODUCT_REPOSITORY_TOKEN, { useValue: items });
	container.register(STOCK_SERVICE_TOKEN, {
		useValue: new StockService(
			movements,
			balances,
			warehouses,
			items,
			// Photo URLs are decoration only; these doubles never assert them.
			{ urlFor: () => null } as never,
			createNumberingDouble(),
			new AuditWriterDouble(),
			database,
		),
	});
	container.register(ADJUSTMENT_SERVICE_TOKEN, {
		useValue: new AdjustmentService(
			adjustments,
			items,
			container.resolve(STOCK_SERVICE_TOKEN),
			createNumberingDouble(),
			new AuditWriterDouble(),
			database,
		),
	});
}
