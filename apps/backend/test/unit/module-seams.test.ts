/**
 * The ADR-0026 module seams, tested without a database.
 *
 * @remarks
 * The module split moved three things behind export facades and left one pure
 * projection behind. Each of them is a **boundary**, so what is worth testing
 * is the boundary's own contract, not the rules behind it:
 *
 * - `ExportedProductService.assertProduct` — the "does this product exist"
 *   question every other module asks before writing a logical id (ADR-0014).
 *   An unknown id must surface as the product module's own 404 type, so
 *   callers never translate it.
 * - `ExportedWarehouseService.organizationScope` — the stock ledger derives a
 *   balance's scope from the warehouse, so "unknown warehouse" must be a
 *   distinguishable answer (`{ found: false }`) rather than a `null` scope,
 *   which is a legitimate value meaning "the global warehouse".
 * - `SerialUnitService.registerUnit` — a unit is only meaningful for a
 *   serialized product, and its status must be legal for the product's kind.
 * - `withWarehouseQuantity` — the product list's warehouse column, which used
 *   to be a correlated subquery over `inventory.stocks` (forbidden, ADR-0026)
 *   and is now a pure zip.
 *
 * Only repositories are doubled here; every service and function under test is
 * the real implementation.
 */
import { describe, expect, test } from 'bun:test';
import type {
	ProductKind,
	TProductSelect,
} from '@drizzle/schemas/product.schema';
import type { TWarehouseSelect } from '@drizzle/schemas/warehouse.schema';
import type {
	SerialStatus,
	TItemSerialSelect,
} from '@drizzle/schemas/inventory.schema';
import type { IProductRepository } from '../../src/app/product/contracts/product.repository.interface';
import type { IProductCategoryRepository } from '../../src/app/product/contracts/product-category.repository.interface';
import type { TProductSerialCounts } from '../../src/app/product/contracts/product-counts.port';
import type { TProductSnapshot } from '../../src/app/product/services/exported-product.service';
import { ExportedProductService } from '../../src/app/product/services/exported-product.service';
import { ProductNotFoundError } from '../../src/app/product/errors/product.errors';
import { withWarehouseQuantity } from '../../src/app/product/utils/warehouse-quantity';
import type { IWarehouseRepository } from '../../src/app/warehouse/contracts/warehouse.repository.interface';
import type { IWarehouseAddressRepository } from '../../src/app/warehouse/contracts/warehouse-address.repository.interface';
import type { IWarehouseStorageRepository } from '../../src/app/warehouse/contracts/warehouse-storage.repository.interface';
import { ExportedWarehouseService } from '../../src/app/warehouse/services/exported-warehouse.service';
import type { IItemSerialRepository } from '../../src/app/inventory/contracts/item-serial.repository.interface';
import { SerialUnitService } from '../../src/app/inventory/services/serial-unit.service';
import { InventoryRuleViolationError } from '../../src/app/inventory/errors/inventory.errors';

const ORG = 'org-a';
const PRODUCT = '01920000-0000-7000-8000-000000000001';
const WAREHOUSE = '01920000-0000-7000-8000-0000000000aa';
const UNKNOWN = '01920000-0000-7000-8000-00000000dead';

/** One alive product row, shaped like the repository's select. */
function productRow(overrides: Partial<TProductSelect> = {}): TProductSelect {
	return {
		id: PRODUCT,
		organizationId: ORG,
		code: 'PRD-00001',
		sku: 'CTRL-01',
		serialNumber: null,
		name: 'Door controller',
		description: null,
		productKind: 'product' satisfies ProductKind,
		productCategoryId: null,
		brand: null,
		specification: null,
		imageObjectKey: null,
		unitLabel: 'pcs',
		isActive: true,
		isSerialized: true,
		isStockTracked: true,
		minStockQty: '0',
		barcode: null,
		sellingPrice: 0,
		purchasePrice: 0,
		currencyCode: 'IDR',
		createdAt: new Date(0),
		updatedAt: null,
		deletedAt: null,
		...overrides,
	} as TProductSelect;
}

/** The product facade over an in-memory product table. */
function makeProductFacade(rows: TProductSelect[] = [productRow()]) {
	const products: Pick<IProductRepository, 'findById'> = {
		async findById(id: string) {
			return rows.find((row) => row.id === id && row.deletedAt === null) ?? null;
		},
	};
	const facade = new ExportedProductService(
		// Only `findById` is reached by `assertProduct`; the rest of the
		// repository surface is not exercised here.
		products as IProductRepository,
		{} as IProductCategoryRepository,
		{} as TProductSerialCounts,
	);
	return { facade, rows };
}

describe('seam — ExportedProductService.assertProduct (ADR-0026)', () => {
	test('an unknown id is the product module’s own 404, not a raw null', async () => {
		const { facade } = makeProductFacade();

		await expect(facade.assertProduct(UNKNOWN)).rejects.toBeInstanceOf(
			ProductNotFoundError,
		);
	});

	test('a known id returns the snapshot another module may rely on', async () => {
		const { facade } = makeProductFacade();

		const snapshot: TProductSnapshot = await facade.assertProduct(PRODUCT);

		expect(snapshot).toEqual({
			id: PRODUCT,
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
		});
	});

	test('a soft-deleted product is absent, exactly like an unknown id', async () => {
		// The archive is a soft delete, so "exists" must mean "alive": a line
		// written against an archived product would reference a row no read
		// path can decorate.
		const { facade } = makeProductFacade([
			productRow({ deletedAt: new Date(0) } as Partial<TProductSelect>),
		]);

		await expect(facade.assertProduct(PRODUCT)).rejects.toBeInstanceOf(
			ProductNotFoundError,
		);
	});
});

/** The warehouse facade over in-memory warehouse rows. */
function makeWarehouseFacade(rows: TWarehouseSelect[] = []) {
	const warehouses: Pick<IWarehouseRepository, 'findById'> = {
		async findById(id: string) {
			return rows.find((row) => row.id === id && row.deletedAt === null) ?? null;
		},
	};
	const facade = new ExportedWarehouseService(
		warehouses as IWarehouseRepository,
		{} as IWarehouseStorageRepository,
		{} as IWarehouseAddressRepository,
	);
	return { facade };
}

/** One warehouse row. `organizationId: null` is the GLOBAL scope, not "missing". */
function warehouseRow(
	overrides: Partial<TWarehouseSelect> = {},
): TWarehouseSelect {
	return {
		id: WAREHOUSE,
		organizationId: ORG,
		code: 'MAIN',
		name: 'Main warehouse',
		responsibleEmployeeId: null,
		isDefault: false,
		isActive: true,
		imageUrl: null,
		createdAt: new Date(0),
		updatedAt: null,
		deletedAt: null,
		...overrides,
	} as TWarehouseSelect;
}

describe('seam — ExportedWarehouseService.organizationScope (ADR-0026)', () => {
	test('an unknown warehouse is found:false, never a null scope', async () => {
		// The distinction matters: `null` is a real answer (the global
		// warehouse), so collapsing "missing" into it would post stock to the
		// shared balance of a warehouse that does not exist.
		const { facade } = makeWarehouseFacade([]);

		expect(await facade.organizationScope(UNKNOWN)).toEqual({ found: false });
	});

	test('an org-owned warehouse reports its organization', async () => {
		const { facade } = makeWarehouseFacade([warehouseRow()]);

		expect(await facade.organizationScope(WAREHOUSE)).toEqual({
			found: true,
			organizationId: ORG,
		});
	});

	test('a global warehouse is found with a null organization', async () => {
		const { facade } = makeWarehouseFacade([
			warehouseRow({ organizationId: null }),
		]);

		expect(await facade.organizationScope(WAREHOUSE)).toEqual({
			found: true,
			organizationId: null,
		});
	});
});

/** In-memory serial-unit repository: writes are recorded, reads answer from it. */
function makeSerialRepository(seed: TItemSerialSelect[] = []) {
	const rows = [...seed];
	const units: Pick<
		IItemSerialRepository,
		'findBySerial' | 'findById' | 'create' | 'updateStatus'
	> = {
		async findBySerial(organizationId, serialNumber) {
			return (
				rows.find(
					(row) =>
						row.organizationId === organizationId &&
						row.serialNumber === serialNumber &&
						row.deletedAt === null,
				) ?? null
			);
		},
		async findById(id) {
			return rows.find((row) => row.id === id && row.deletedAt === null) ?? null;
		},
		async create(data) {
			const row = {
				id: `unit-${rows.length + 1}`,
				createdAt: new Date(0),
				updatedAt: null,
				deletedAt: null,
				...data,
			} as TItemSerialSelect;
			rows.push(row);
			return row;
		},
		async updateStatus(id, status) {
			const row = rows.find((candidate) => candidate.id === id);
			if (!row) return null;
			row.status = status;
			return row;
		},
	};
	return { units, rows };
}

/** The serial-unit service over a fresh in-memory unit table. */
function makeSerialUnitService(products: TProductSelect[] = [productRow()]) {
	const repository = makeSerialRepository();
	const service = new SerialUnitService(
		repository.units as IItemSerialRepository,
		{
			async assertProduct(productId: string) {
				const row = products.find(
					(candidate) => candidate.id === productId,
				);
				if (!row) throw new ProductNotFoundError();
				return {
					id: row.id,
					code: row.code,
					sku: row.sku,
					name: row.name,
					unitLabel: row.unitLabel,
					sellingPrice: row.sellingPrice,
					purchasePrice: row.purchasePrice,
					specification: row.specification,
					productKind: row.productKind,
					imageObjectKey: row.imageObjectKey,
					isActive: row.isActive,
					isSerialized: row.isSerialized,
					isStockTracked: row.isStockTracked,
				};
			},
		},
	);
	return { service, ...repository };
}

describe('seam — SerialUnitService.registerUnit (ADR-0026)', () => {
	test('a non-serialized product cannot have units', async () => {
		const { service, rows } = makeSerialUnitService([
			productRow({ id: PRODUCT, isSerialized: false }),
		]);

		await expect(
			service.registerUnit(PRODUCT, { serialNumber: 'SN-1' }),
		).rejects.toBeInstanceOf(InventoryRuleViolationError);
		// Refused before any write: a unit row for a quantity-tracked product
		// would be invisible to every stock path.
		expect(rows).toHaveLength(0);
	});

	test('an unknown product is refused by the product contract', async () => {
		const { service } = makeSerialUnitService([]);

		await expect(
			service.registerUnit(UNKNOWN, { serialNumber: 'SN-1' }),
		).rejects.toBeInstanceOf(ProductNotFoundError);
	});

	test('every kind accepts the legal statuses', async () => {
		const legal: SerialStatus[] = [
			'in_stock',
			'damaged',
			'lost',
			'sold',
			'applied_warranty',
			'returned',
		];
		const { service } = makeSerialUnitService([
			productRow({ id: PRODUCT, productKind: 'product', isSerialized: true }),
		]);

		for (const status of legal) {
			const unit = await service.registerUnit(PRODUCT, {
				status,
				// A provisional serial is only minted for `pre_order`, and the
				// rest need a real one.
				serialNumber: `SN-${status}`,
			});
			expect(unit.status).toBe(status);
		}
	});

	test('a status the kind can never hold is refused, and the matrix is the only source', async () => {
		// The status column is `text`, so nothing in the database stops an
		// illegal value; the matrix is what makes "a material is sold" a 422.
		const { service, rows } = makeSerialUnitService([
			productRow({ id: PRODUCT, productKind: 'component' }),
		]);

		// `inactive` is the ITEM lifecycle status, not a unit status.
		await expect(
			service.registerUnit(PRODUCT, {
				serialNumber: 'SN-X',
				status: 'inactive' as SerialStatus,
			}),
		).rejects.toBeInstanceOf(InventoryRuleViolationError);
		expect(rows).toHaveLength(0);
	});

	test('a pre-ordered unit gets a provisional serial when none is supplied', async () => {
		const { service } = makeSerialUnitService();

		const unit = await service.registerUnit(PRODUCT, { status: 'pre_order' });

		expect(unit.status).toBe('pre_order');
		expect(unit.isProvisionalSerial).toBe(true);
		expect(unit.serialNumber).toMatch(/^PO-CTRL-01-/);
	});

	test('a non-pre-ordered unit without a serial is refused', async () => {
		const { service } = makeSerialUnitService();

		await expect(
			service.registerUnit(PRODUCT, { status: 'in_stock' }),
		).rejects.toBeInstanceOf(InventoryRuleViolationError);
	});
});

describe('seam — withWarehouseQuantity', () => {
	test('maps the on-hand totals onto the page rows', () => {
		const rows = [{ id: 'p1' }, { id: 'p2' }];
		const quantities = new Map<string, string | number>([
			['p1', '12.500'],
			['p2', 3],
		]);

		expect(withWarehouseQuantity(rows, quantities)).toEqual([
			{ id: 'p1', quantityOnHand: '12.500' },
			{ id: 'p2', quantityOnHand: '3' },
		]);
	});

	test('a product with no balance reports 0, matching the old COALESCE', () => {
		const rows = [{ id: 'p1' }, { id: 'p2' }];

		expect(
			withWarehouseQuantity(rows, new Map([['p1', '4.000']])),
		).toEqual([
			{ id: 'p1', quantityOnHand: '4.000' },
			{ id: 'p2', quantityOnHand: '0' },
		]);
	});

	test('without a map there is no column, so the field is null and not zero', () => {
		// `undefined` means "no warehouse was requested"; `0` would claim the
		// product is out of stock, which is a different statement.
		const rows = [{ id: 'p1' }];

		expect(withWarehouseQuantity(rows, undefined)).toEqual([
			{ id: 'p1', quantityOnHand: null },
		]);
	});

	test('the row keeps its own properties and is not mutated', () => {
		const rows = [{ id: 'p1', name: 'Kabel' }];
		const mapped = withWarehouseQuantity(rows, new Map([['p1', '1.000']]));

		expect(mapped[0]).toEqual({
			id: 'p1',
			name: 'Kabel',
			quantityOnHand: '1.000',
		});
		expect(rows[0]).toEqual({ id: 'p1', name: 'Kabel' });
	});
});
