import { beforeEach, describe, expect, test } from 'bun:test';
import { ItemService } from '../../src/app/inventory/services/item.service';
import { AuditWriterDouble } from '../helpers/audit-writer-double';
import {
	InventoryRuleViolationError,
	ItemCategoryUnavailableError,
	ItemHasUnitsError,
	ItemNotFoundError,
	ItemSkuTakenError,
	SerialNumberTakenError,
	UnitNotFoundError,
} from '../../src/app/inventory/errors/inventory.errors';
import type {
	IItemRepository,
	TItemCreateData,
} from '../../src/app/inventory/contracts/item.repository.interface';
import type { ISerialUnitRepository } from '../../src/app/inventory/contracts/serial-unit.repository.interface';
import type {
	TItemCategorySelect,
	TItemSelect,
	TSerialTrackedItemSelect,
} from '@drizzle/schemas/inventory.schema';

/** Minimal in-memory stand-ins for the two repositories. */

function makeItem(overrides: Partial<TItemSelect> = {}): TItemSelect {
	return {
		id: '01920000-0000-7000-8000-000000000001',
		organizationId: 'org-a',
		code: 'PRD-00001',
		sku: 'CTRL-01',
		serialNumber: null,
		name: 'Door controller',
		description: null,
		itemKind: 'product',
		categoryId: null,
		brand: null,
		specification: null,
		isActive: true,
		createdBy: null,
		unitLabel: 'pcs',
		isSerialized: true,
		isStockTracked: true,
		minStockQty: '0.000',
		barcode: null,
		sellingPrice: 0,
		purchasePrice: 0,
		currencyCode: 'IDR',
		createdAt: new Date(0),
		updatedAt: null,
		deletedAt: null,
		...overrides,
	} as TItemSelect;
}

function makeUnit(
	overrides: Partial<TSerialTrackedItemSelect> = {},
): TSerialTrackedItemSelect {
	return {
		id: '01920000-0000-7000-8000-0000000000aa',
		organizationId: 'org-a',
		itemId: '01920000-0000-7000-8000-000000000001',
		serialNumber: 'SN-1',
		isProvisionalSerial: false,
		assetTag: null,
		status: 'in_stock',
		warehouseId: null,
		binId: null,
		acquiredOn: null,
		warrantyExpiresOn: null,
		purchaseOrderLineId: null,
		customerId: null,
		stockMovementId: null,
		notes: null,
		createdAt: new Date(0),
		updatedAt: null,
		deletedAt: null,
		...overrides,
	} as TSerialTrackedItemSelect;
}

type Harness = {
	service: ItemService;
	items: TItemSelect[];
	units: TSerialTrackedItemSelect[];
};

/**
 * Builds an {@link ItemService} over simple in-memory arrays.
 *
 * @remarks
 * The provisional-serial guard is reproduced faithfully: the replacement
 * matches only a provisional unit in `pre_order`, so the concurrency
 * behaviour under test is not an artefact of the fake.
 */
/** Categories known to the fake category repository (ADR-0011). */
const ACTIVE_CATEGORY = '01920000-0000-7000-8000-00000000c001';
const INACTIVE_CATEGORY = '01920000-0000-7000-8000-00000000c002';
const categories = new Map<string, TItemCategorySelect>(
	[
		{ id: ACTIVE_CATEGORY, isActive: true },
		{ id: INACTIVE_CATEGORY, isActive: false },
	].map((row) => [row.id, { ...row, slug: row.id, name: row.id } as TItemCategorySelect]),
);

function makeService(seed?: {
	items?: TItemSelect[];
	units?: TSerialTrackedItemSelect[];
}): Harness {
	const items = [...(seed?.items ?? [])];
	const units = [...(seed?.units ?? [])];

	const itemRepository: IItemRepository = {
		paginate: async (r) => ({
			meta: { page: r.page, limit: r.limit, total: items.length, totalPages: 1 },
			data: items,
		}),
		findById: async (id) => items.find((i) => i.id === id) ?? null,
		findActiveByIds: async (ids) => items.filter((i) => ids.includes(i.id) && i.isActive),
		findBySku: async (org, sku) =>
			items.find((i) => i.organizationId === org && i.sku === sku) ?? null,
		create: async (data, code) => {
			const row = makeItem({ ...data, code, id: crypto.randomUUID() } as never);
			items.push(row);
			return row;
		},
		update: async (id, data) => {
			const row = items.find((i) => i.id === id);
			if (!row) return null;
			Object.assign(row, data);
			return row;
		},
		archive: async (id) => {
			const row = items.find((i) => i.id === id);
			if (!row) return null;
			row.deletedAt = new Date();
			return row;
		},
		findNamesByIds: async (ids) =>
			items
				.filter((i) => ids.includes(i.id) && i.deletedAt === null)
				.map((i) => ({
					id: i.id,
					name: i.name,
					imageObjectKey: i.imageObjectKey ?? null,
				})),
		countUnits: async (itemId) =>
			units.filter((u) => u.itemId === itemId && u.deletedAt === null).length,
	};

	const serialUnitRepository: ISerialUnitRepository = {
		paginate: async (r) => ({
			meta: { page: r.page, limit: r.limit, total: units.length, totalPages: 1 },
			data: units,
		}),
		findById: async (id) => units.find((u) => u.id === id) ?? null,
		findBySerial: async (org, serial) =>
			units.find(
				(u) => u.organizationId === org && u.serialNumber === serial,
			) ?? null,
		create: async (data) => {
			const row = makeUnit({ ...data, id: crypto.randomUUID() } as never);
			units.push(row);
			return row;
		},
		replaceProvisionalSerial: async (id, serialNumber) => {
			const row = units.find(
				(u) =>
					u.id === id &&
					u.isProvisionalSerial &&
					u.status === 'pre_order' &&
					u.deletedAt === null,
			);
			if (!row) return null;
			row.serialNumber = serialNumber;
			row.isProvisionalSerial = false;
			return row;
		},
		updateStatus: async (id, status) => {
			const row = units.find((u) => u.id === id);
			if (!row) return null;
			row.status = status;
			return row;
		},
		listInStockSerials: async () => [],
		sell: async () => [],
		returnToSupplier: async () => [],
	};

	return {
		service: new ItemService(
			itemRepository,
			serialUnitRepository,
			{ findById: async (id) => categories.get(id) ?? null },
			new AuditWriterDouble(),
			{ next: async (codeType) => `${codeType}-code` },
		),
		items,
		units,
	};
}

describe('ItemService — item shape rules', () => {
	test('creates a valid product', async () => {
		const { service, items } = makeService();
		const created = await service.createItem({
			organizationId: 'org-a',
			sku: 'CTRL-01',
			name: 'Door controller',
			itemKind: 'product',
			isSerialized: true,
			isStockTracked: true,
		} as TItemCreateData);

		expect(created.sku).toBe('CTRL-01');
		// ERP-0043: the code comes from the numbering authority, per kind.
		expect(created.code).toBe('item_product-code');
		expect(items).toHaveLength(1);
	});

	test('rejects a serialized item that is not stock-tracked', async () => {
		const { service } = makeService();
		await expect(
			service.createItem({
				organizationId: 'org-a',
				sku: 'CTRL-02',
				name: 'Ghost controller',
				itemKind: 'product',
				isSerialized: true,
				isStockTracked: false,
			} as TItemCreateData),
		).rejects.toBeInstanceOf(InventoryRuleViolationError);
	});

	test('rejects a duplicate SKU in the same tenant', async () => {
		const { service } = makeService({ items: [makeItem()] });
		await expect(
			service.createItem(makeItem() as unknown as TItemCreateData),
		).rejects.toBeInstanceOf(ItemSkuTakenError);
	});

	test('allows the same SKU in a different tenant', async () => {
		const { service } = makeService({ items: [makeItem()] });
		const created = await service.createItem({
			organizationId: 'org-b',
			sku: 'CTRL-01',
			name: 'Door controller',
			itemKind: 'product',
			isSerialized: true,
			isStockTracked: true,
		} as TItemCreateData);
		expect(created.organizationId).toBe('org-b');
	});

	test('allows the same SKU for a global item and an org item', async () => {
		// The partial-unique pair makes these distinct keys; `null` is not
		// "equal to" any organization string.
		const { service } = makeService({
			items: [makeItem({ organizationId: null })],
		});
		const created = await service.createItem({
			organizationId: 'org-a',
			sku: 'CTRL-01',
			name: 'Door controller',
			itemKind: 'product',
			isSerialized: true,
			isStockTracked: true,
		} as TItemCreateData);
		expect(created.organizationId).toBe('org-a');
	});

	test('rejects a second global item with the same SKU', async () => {
		const { service } = makeService({
			items: [makeItem({ organizationId: null })],
		});
		await expect(
			service.createItem({
				organizationId: null,
				sku: 'CTRL-01',
				name: 'Door controller',
				itemKind: 'product',
				isSerialized: true,
				isStockTracked: true,
			} as TItemCreateData),
		).rejects.toBeInstanceOf(ItemSkuTakenError);
	});
});

describe('ItemService — archive', () => {
	test('archives an item with no units', async () => {
		const { service, items } = makeService({ items: [makeItem()] });
		await service.archiveItem(items[0]!.id);
		expect(items[0]!.deletedAt).not.toBeNull();
	});

	test('refuses to archive an item that still has live units', async () => {
		const { service, items } = makeService({
			items: [makeItem()],
			units: [makeUnit()],
		});
		await expect(service.archiveItem(items[0]!.id)).rejects.toBeInstanceOf(
			ItemHasUnitsError,
		);
	});

	test('throws not-found for an absent item', async () => {
		const { service } = makeService();
		await expect(
			service.archiveItem('01920000-0000-7000-8000-00000000ffff'),
		).rejects.toBeInstanceOf(ItemNotFoundError);
	});
});

describe('ItemService — units', () => {
	test('registers a unit on a serialized item', async () => {
		const { service, items, units } = makeService({ items: [makeItem()] });
		const unit = await service.registerUnit(items[0]!.id, {
			serialNumber: 'SN-42',
			organizationId: 'org-a',
		});
		expect(unit.serialNumber).toBe('SN-42');
		expect(unit.status).toBe('in_stock');
		expect(unit.isProvisionalSerial).toBe(false);
		expect(units).toHaveLength(1);
	});

	test('refuses a unit on a non-serialized item', async () => {
		const { service, items } = makeService({
			items: [makeItem({ isSerialized: false })],
		});
		await expect(
			service.registerUnit(items[0]!.id, { serialNumber: 'SN-1' }),
		).rejects.toBeInstanceOf(InventoryRuleViolationError);
	});

	test('rejects a duplicate serial in the same tenant', async () => {
		const { service, items } = makeService({
			items: [makeItem()],
			units: [makeUnit({ serialNumber: 'SN-1' })],
		});
		await expect(
			service.registerUnit(items[0]!.id, {
				serialNumber: 'SN-1',
				organizationId: 'org-a',
			}),
		).rejects.toBeInstanceOf(SerialNumberTakenError);
	});

	test('mints a provisional serial for a pre-ordered unit', async () => {
		const { service, items } = makeService({ items: [makeItem()] });
		const unit = await service.registerUnit(items[0]!.id, {
			status: 'pre_order',
			organizationId: 'org-a',
		});
		expect(unit.isProvisionalSerial).toBe(true);
		expect(unit.serialNumber.startsWith('PO-CTRL-01-')).toBe(true);
	});

	test('requires a serial for a unit that is not pre-ordered', async () => {
		const { service, items } = makeService({ items: [makeItem()] });
		await expect(
			service.registerUnit(items[0]!.id, {
				status: 'in_stock',
				organizationId: 'org-a',
			}),
		).rejects.toBeInstanceOf(InventoryRuleViolationError);
	});
});

describe('ItemService — provisional serial replacement', () => {
	let harness: Harness;
	let unitId: string;

	beforeEach(() => {
		harness = makeService({
			items: [makeItem()],
			units: [
				makeUnit({
					serialNumber: 'PO-CTRL-01-XYZ',
					isProvisionalSerial: true,
					status: 'pre_order',
				}),
			],
		});
		unitId = harness.units[0]!.id;
	});

	test('replaces a provisional serial exactly once', async () => {
		const unit = await harness.service.replaceProvisionalSerial(
			unitId,
			'REAL-SN-1',
		);
		expect(unit.serialNumber).toBe('REAL-SN-1');
		expect(unit.isProvisionalSerial).toBe(false);
	});

	test('refuses a second replacement', async () => {
		await harness.service.replaceProvisionalSerial(unitId, 'REAL-SN-1');
		await expect(
			harness.service.replaceProvisionalSerial(unitId, 'REAL-SN-2'),
		).rejects.toBeInstanceOf(InventoryRuleViolationError);
	});

	test('refuses replacement once the unit has left pre_order', async () => {
		harness.units[0]!.status = 'in_stock';
		await expect(
			harness.service.replaceProvisionalSerial(unitId, 'REAL-SN-1'),
		).rejects.toBeInstanceOf(InventoryRuleViolationError);
	});

	test('refuses a serial already used by another unit', async () => {
		harness.units.push(
			makeUnit({
				id: '01920000-0000-7000-8000-0000000000bb',
				serialNumber: 'TAKEN',
			}),
		);
		await expect(
			harness.service.replaceProvisionalSerial(unitId, 'TAKEN'),
		).rejects.toBeInstanceOf(SerialNumberTakenError);
	});

	test('throws not-found for an absent unit', async () => {
		await expect(
			harness.service.replaceProvisionalSerial(
				'01920000-0000-7000-8000-00000000ffff',
				'REAL-SN-1',
			),
		).rejects.toBeInstanceOf(UnitNotFoundError);
	});
});

describe('ItemService — unit transitions', () => {
	test('moves a product in_stock → applied_warranty → in_stock', async () => {
		const { service, units, items } = makeService({
			items: [makeItem({ itemKind: 'product' })],
			units: [makeUnit()],
		});
		expect(items).toHaveLength(1);

		await service.transitionUnit(units[0]!.id, 'applied_warranty');
		expect(units[0]!.status).toBe('applied_warranty');

		await service.transitionUnit(units[0]!.id, 'in_stock');
		expect(units[0]!.status).toBe('in_stock');
	});

	test('sells a product', async () => {
		const { service, units } = makeService({
			items: [makeItem({ itemKind: 'product' })],
			units: [makeUnit()],
		});
		await service.transitionUnit(units[0]!.id, 'sold');
		expect(units[0]!.status).toBe('sold');
	});

	test('refuses an illegal edge (sold → in_stock)', async () => {
		const { service, units } = makeService({
			items: [makeItem({ itemKind: 'product' })],
			units: [makeUnit({ status: 'sold' })],
		});
		await expect(
			service.transitionUnit(units[0]!.id, 'in_stock'),
		).rejects.toBeInstanceOf(InventoryRuleViolationError);
	});
});

describe('ItemService — categories (ADR-0011)', () => {
	const base = {
		organizationId: 'org-a',
		name: 'Controller',
		itemKind: 'product',
		isSerialized: false,
		isStockTracked: true,
		minStockQty: '0.000',
		sellingPrice: 0,
		purchasePrice: 0,
		currencyCode: 'IDR',
		unitLabel: 'pcs',
	} as const;

	test('an active category is accepted; inactive or unknown ones are refused', async () => {
		const { service } = makeService();
		const created = await service.createItem({ ...base, sku: 'CAT-1', categoryId: ACTIVE_CATEGORY });
		expect(created.categoryId).toBe(ACTIVE_CATEGORY);
		await expect(
			service.createItem({ ...base, sku: 'CAT-2', categoryId: INACTIVE_CATEGORY }),
		).rejects.toBeInstanceOf(ItemCategoryUnavailableError);
		await expect(
			service.createItem({ ...base, sku: 'CAT-3', categoryId: '01920000-0000-7000-8000-00000000c0ff' }),
		).rejects.toBeInstanceOf(ItemCategoryUnavailableError);
	});

	test('an item keeps a category that became inactive, but cannot move into one', async () => {
		const keeper = makeItem({ categoryId: INACTIVE_CATEGORY });
		const mover = makeItem({ id: '01920000-0000-7000-8000-0000000000aa', sku: 'MOVE', categoryId: null });
		const { service } = makeService({ items: [keeper, mover] });
		const renamed = await service.updateItem(keeper.id, { name: 'Renamed', categoryId: INACTIVE_CATEGORY });
		expect(renamed.name).toBe('Renamed');
		await expect(
			service.updateItem(mover.id, { categoryId: INACTIVE_CATEGORY }),
		).rejects.toBeInstanceOf(ItemCategoryUnavailableError);
	});
});
