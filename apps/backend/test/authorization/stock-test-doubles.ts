/**
 * Test doubles and a capture bag for the stock/adjustment authorization tests.
 *
 * @remarks
 * Split out of the test file because both the stock and adjustment controllers
 * resolve different services, and the capture needs to be shared between them.
 * The repositories are stubbed at their DI seams, so the REAL controllers and
 * services run; only persistence is faked.
 *
 * ADR-0026 moved the product master to `@app/product` and the warehouse estate
 * to `@app/warehouse`. `StockService` / `AdjustmentService` now read those
 * modules through their repository-only export facades
 * (`EXPORTED_PRODUCT_SERVICE_TOKEN`, `EXPORTED_WAREHOUSE_SERVICE_TOKEN`), so
 * the doubles are registered at those seams instead of as foreign repositories.
 */
import { container } from 'tsyringe';
import type {
	TStockAdjustmentSelect,
	TStockSelect,
} from '@drizzle/schemas/inventory.schema';
import type {
	IMovementRepository,
	TProductMovementSelect,
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
import type { TPostMovementInput } from '../../src/app/inventory/services/stock.service';
import {
	ADJUSTMENT_REPOSITORY_TOKEN,
	ADJUSTMENT_SERVICE_TOKEN,
	STOCK_REPOSITORY_TOKEN,
	MOVEMENT_REPOSITORY_TOKEN,
	STOCK_SERVICE_TOKEN,
} from '../../src/app/inventory/constants/di';
import {
	PRODUCT_REPOSITORY_TOKEN,
	PRODUCT_CATEGORY_REPOSITORY_TOKEN,
	EXPORTED_PRODUCT_SERVICE_TOKEN,
} from '../../src/app/product/constants/di';
import {
	WAREHOUSE_ADDRESS_REPOSITORY_TOKEN,
	WAREHOUSE_REPOSITORY_TOKEN,
	WAREHOUSE_STORAGE_REPOSITORY_TOKEN,
	EXPORTED_WAREHOUSE_SERVICE_TOKEN,
} from '../../src/app/warehouse/constants/di';
import type { TProductSnapshot } from '../../src/app/product/services/exported-product.service';
import type { TWarehouseSelect } from '@drizzle/schemas/warehouse.schema';
import type { IProductRepository } from '../../src/app/product/contracts/product.repository.interface';
import type { IWarehouseRepository } from '../../src/app/warehouse/contracts/warehouse.repository.interface';
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
	/** Product ids the product facade was asked to validate. */
	assertedProducts: string[];
};

/** Mutable capture bag, reset between tests. */
export const capture: TAdjustmentCapture = {
	balanceScope: undefined,
	movementScope: undefined,
	postedMovement: null,
	movementActorOrganizationId: null,
	adjustment: null,
	assertedProducts: [],
};

/** Clears captured state. Call from `beforeEach`. */
export function resetCapture(): void {
	capture.balanceScope = undefined;
	capture.movementScope = undefined;
	capture.postedMovement = null;
	capture.movementActorOrganizationId = null;
	capture.adjustment = null;
	capture.assertedProducts = [];
}

const WAREHOUSE: TWarehouseSelect = {
	id: '01920000-0000-7000-8000-0000000000aa',
	organizationId: null,
	code: 'MAIN',
	name: 'Main warehouse',
	responsibleEmployeeId: null,
	imageUrl: null,
	imageObjectKey: null,
	isDefault: true,
	isActive: true,
	createdAt: new Date(0),
	updatedAt: null,
	deletedAt: null,
};

const emptyPage = (page: number, limit: number) => ({
	meta: { page, limit, total: 0, totalPages: 0 },
	data: [],
});

/** The product snapshot every asserted id resolves to. */
function productSnapshot(productId: string): TProductSnapshot {
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
		isSerialized: true,
		isStockTracked: true,
		productCategoryId: null,
	};
}

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
		async create(data: TMovementCreateData, _tx?: unknown) {
			// The ledger row records the ACTING organization (who did it), which
			// is what a caller-identity assertion needs — it is not the balance
			// scope, which follows the warehouse.
			capture.postedMovement = data as unknown as TPostMovementInput;
			capture.movementActorOrganizationId = data.organizationId ?? null;
			return { ...data, id: 'movement-1' } as TProductMovementSelect;
		},
		async findReversalOf() {
			return null;
		},
		async claimForReversal() {
			return null;
		},
		async ledgerRows(_warehouseIds: string[]) {
			return [];
		},
		async listForProject() {
			return [];
		},
		async ledgerTotals(_warehouseIds: string[]) {
			return [];
		},
	};

	const balances: IStockRepository = {
	availableTotals: async () => [],
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
		async productIdsInWarehouse() {
			return [];
		},
		async countMaterialStocks() {
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
		async findByIds(ids) {
			return ids.includes(WAREHOUSE.id)
				? [{ id: WAREHOUSE.id, code: WAREHOUSE.code, name: WAREHOUSE.name }]
				: [];
		},
		async clearDefaultExcept() {},
		async countStorages() {
			return new Map<string, number>();
		},
	};

	const products: IProductRepository = {
	ranges: async () => ({ maxSellingPrice: 0, maxStock: 0 }),
		async paginate(request) {
			return emptyPage(request.page, request.limit);
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
		async create() {
			throw new Error('not used in this suite');
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
		async findByIds() {
			return [];
		},
		async productKinds() {
			return [];
		},
		async searchByNameOrSku() {
			return [];
		},
		async listListed() {
			return [];
		},
		async listPublished() {
			return [];
		},
		async findBySlug() {
			return null;
		},
		async findPublishedBySlug() {
			return null;
		},
		async countUnits() {
			return 0;
		},
	};

	const storages = {
		async findById() {
			return null;
		},
		async listByWarehouse() {
			return [];
		},
		async findByCode() {
			return null;
		},
		async create() {
			throw new Error('not used in this suite');
		},
		async update() {
			return null;
		},
		async archive() {
			return null;
		},
	};

	const addresses = {
		async findByWarehouseId() {
			return null;
		},
		async upsert() {
			throw new Error('not used in this suite');
		},
		async remove() {
			return false;
		},
	};

	// The services open `database.transaction` for their multi-statement writes;
	// the double runs the callback directly because the repositories are stubs.
	const database = {
		transaction: async (callback: (tx: null) => unknown) => callback(null),
	} as never;

	const exportedProducts = {
		async assertProduct(productId: string) {
			capture.assertedProducts.push(productId);
			return productSnapshot(productId);
		},
		async isProductActive(productId: string) {
			return capture.assertedProducts.includes(productId);
		},
		// B-29: StockService.postManual reads isSerialized here. The route tests
		// post plain quantities, so the stock path sees a non-serialized product;
		// the unit routes keep the serialized snapshot through assertProduct.
		async productsById(ids: string[]) {
			return new Map(ids.map((id) => [id, { ...productSnapshot(id), isSerialized: false }]));
		},
		async getNameMap(ids: string[]) {
			return new Map(ids.map((id) => [id, productSnapshot(id).name]));
		},
		async countUnits() {
			return 0;
		},
		async categoryExists() {
			return false;
		},
		async productKinds(ids: string[]) {
			return new Map(ids.map((id) => [id, 'product']));
		},
		async findBySearch() {
			return [];
		},
	};

	const exportedWarehouses = {
		async warehouseExists(warehouseId: string) {
			return warehouseId === WAREHOUSE.id;
		},
		async warehouseIsActive(warehouseId: string) {
			return warehouseId === WAREHOUSE.id && WAREHOUSE.isActive;
		},
		async storageInWarehouse() {
			return false;
		},
		async getNameMap(ids: string[]) {
			return new Map(
				ids.filter((id) => id === WAREHOUSE.id).map((id) => [id, WAREHOUSE.name]),
			);
		},
		async organizationScope(warehouseId: string) {
			return warehouseId === WAREHOUSE.id
				? { found: true as const, organizationId: WAREHOUSE.organizationId }
				: { found: false as const };
		},
		async isLinked(warehouseId: string, organizationId: string) {
			return warehouseId === WAREHOUSE.id && organizationId === ORG_A;
		},
		async warehousesById(ids: string[]) {
			return new Map(
				ids
					.filter((id) => id === WAREHOUSE.id)
					.map((id) => [id, { id, code: WAREHOUSE.code, name: WAREHOUSE.name }]),
			);
		},
		async findByWarehouseIds(ids: string[]) {
			return new Map(
				ids
					.filter((id) => id === WAREHOUSE.id)
					.map((id) => [id, { id, code: WAREHOUSE.code, name: WAREHOUSE.name }]),
			);
		},
		async idsInScope(organizationId: string | null) {
			return WAREHOUSE.organizationId === organizationId ? [WAREHOUSE.id] : [];
		},
		async hasAddress() {
			return false;
		},
	};

	container.register(MOVEMENT_REPOSITORY_TOKEN, { useValue: movements });
	container.register(STOCK_REPOSITORY_TOKEN, { useValue: balances });
	container.register(ADJUSTMENT_REPOSITORY_TOKEN, { useValue: adjustments });
	// The warehouse storage/address seams stay registered so the module's other
	// consumers resolve; the stock services only reach the estate through the
	// export facade below (ADR-0026).
	container.register(WAREHOUSE_REPOSITORY_TOKEN, { useValue: warehouses });
	container.register(WAREHOUSE_STORAGE_REPOSITORY_TOKEN, { useValue: storages });
	container.register(WAREHOUSE_ADDRESS_REPOSITORY_TOKEN, { useValue: addresses });
	// Export facades are registered by instance: their tokens are typed against
	// the concrete service class, and a structural literal is not assignable to
	// a constructor type (`InjectionToken<T>` = `constructor<T> | string |
	// symbol`). The stub reproduces exactly the methods the consuming services
	// pick, so the `as never` only bridges the private fields, not the API.
	container.registerInstance(EXPORTED_WAREHOUSE_SERVICE_TOKEN, exportedWarehouses as never);
	container.register(PRODUCT_REPOSITORY_TOKEN, { useValue: products });
	container.registerInstance(PRODUCT_CATEGORY_REPOSITORY_TOKEN, {
		findById: async () => null,
	} as never);
	container.registerInstance(EXPORTED_PRODUCT_SERVICE_TOKEN, exportedProducts as never);
	container.register(STOCK_SERVICE_TOKEN, {
		useValue: new StockService(
			movements,
			balances,
			exportedWarehouses,
			exportedProducts,
			// Photo URLs are decoration only; these doubles never assert them.
			{ presignGet: () => '' },
			createNumberingDouble(),
			new AuditWriterDouble(),
			database,
		),
	});
	container.register(ADJUSTMENT_SERVICE_TOKEN, {
		useValue: new AdjustmentService(
			adjustments,
			exportedProducts,
			container.resolve(STOCK_SERVICE_TOKEN),
			createNumberingDouble(),
			new AuditWriterDouble(),
			database,
			// Names are presentation only; the authorization suites do not read them.
			{ summaries: async () => new Map() },
			{ storageInWarehouse: async () => true },
		),
	});
}
