/**
 * Product master service tests (ADR-0026: the master lives in `product`).
 *
 * @remarks
 * The serial units moved to `inventory`'s `SerialUnitService`, so this file
 * covers what `ProductService` still owns: the shape rules, SKU uniqueness
 * (through the module's export facade), category assignment, code allocation
 * and the archive guard (`countUnits` through the facade).
 */
import { describe, expect, test } from 'bun:test';
import { ProductService } from '../../src/app/product/services/product.service';
import { ExportedProductService } from '../../src/app/product/services/exported-product.service';
import { AuditWriterDouble } from '../helpers/audit-writer-double';
import {
	ProductCategoryUnavailableError,
	ProductHasSerialsError,
	ProductNotFoundError,
	ProductSkuTakenError,
	ProductRuleViolationError,
} from '../../src/app/product/errors/product.errors';
import type {
	IProductRepository,
	TProductCreateData,
} from '../../src/app/product/contracts/product.repository.interface';
import type {
	TProductCategorySelect,
	TProductSelect,
} from '@drizzle/schemas/product.schema';

/** Minimal in-memory stand-in for the product repository. */

function makeItem(overrides: Partial<TProductSelect> = {}): TProductSelect {
	return {
		id: '01920000-0000-7000-8000-000000000001',
		organizationId: 'org-a',
		code: 'PRD-00001',
		sku: 'CTRL-01',
		serialNumber: null,
		name: 'Door controller',
		description: null,
		productKind: 'product',
		productCategoryId: null,
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
		imageObjectKey: null,
		slug: null,
		isPublished: false,
		publishedAt: null,
		listingSpecs: null,
		priceMode: 'list',
		priceCaption: null,
		outOfStockMode: 'request',
		leadTimeLabel: null,
		applications: [],
		popularity: 0,
		createdAt: new Date(0),
		updatedAt: null,
		deletedAt: null,
		...overrides,
	} as TProductSelect;
}

type Harness = {
	service: ProductService;
	items: TProductSelect[];
	/** Live serial units per product, as `inventory` would report them. */
	unitCounts: Map<string, number>;
};

/** Categories known to the fake category repository (ADR-0011). */
const ACTIVE_CATEGORY = '01920000-0000-7000-8000-00000000c001';
const INACTIVE_CATEGORY = '01920000-0000-7000-8000-00000000c002';

function makeCategory(id: string, isActive: boolean): TProductCategorySelect {
	return {
		id,
		slug: id,
		name: id,
		shortName: null,
		description: null,
		sortOrder: 0,
		isActive,
		createdAt: new Date(0),
		updatedAt: new Date(0),
		deletedAt: null,
	};
}

const categories = new Map<string, TProductCategorySelect>([
	[ACTIVE_CATEGORY, makeCategory(ACTIVE_CATEGORY, true)],
	[INACTIVE_CATEGORY, makeCategory(INACTIVE_CATEGORY, false)],
]);

/**
 * Builds a {@link ProductService} over simple in-memory arrays.
 *
 * @remarks
 * The service reads the shared checks (SKU free, category usable, unit count)
 * from its own module's export facade, so the harness wires the real facade
 * over the same fake repositories rather than stubbing the facade out: the
 * cross-module seam is part of what these tests exercise.
 */
function makeService(seed?: {
	items?: TProductSelect[];
	unitCounts?: Record<string, number>;
}): Harness {
	const items = [...(seed?.items ?? [])];
	const unitCounts = new Map(Object.entries(seed?.unitCounts ?? {}));

	const productRepository: IProductRepository = {
		ranges: async () => ({ maxSellingPrice: 0, maxStock: 0 }),
		paginate: async (request) => ({
			meta: {
				page: request.page,
				limit: request.limit,
				total: items.length,
				totalPages: 1,
			},
			data: items,
		}),
		findById: async (id) => items.find((item) => item.id === id) ?? null,
		findActiveByIds: async (ids) =>
			items.filter((item) => ids.includes(item.id) && item.isActive),
		findBySku: async (org, sku) =>
			items.find((item) => item.organizationId === org && item.sku === sku) ??
			null,
		create: async (data, code) => {
			const row = makeItem({ ...data, code, id: crypto.randomUUID() } as never);
			items.push(row);
			return row;
		},
		update: async (id, data) => {
			const row = items.find((item) => item.id === id);
			if (!row) return null;
			Object.assign(row, data);
			return row;
		},
		archive: async (id) => {
			const row = items.find((item) => item.id === id);
			if (!row) return null;
			row.deletedAt = new Date();
			return row;
		},
		findNamesByIds: async (ids) =>
			items
				.filter((item) => ids.includes(item.id) && item.deletedAt === null)
				.map((item) => ({
					id: item.id,
					name: item.name,
					sku: item.sku,
					unitLabel: item.unitLabel,
					imageObjectKey: item.imageObjectKey,
				})),
		findByIds: async (ids) => items.filter((item) => ids.includes(item.id)),
		productKinds: async (ids) =>
			items
				.filter((item) => ids.includes(item.id))
				.map((item) => ({ id: item.id, productKind: item.productKind })),
		searchByNameOrSku: async () => [],
		listListed: async () => [],
		listPublished: async () => [],
		findBySlug: async () => null,
		findPublishedBySlug: async () => null,
		countUnits: async (productId) => unitCounts.get(productId) ?? 0,
	};

	const categoryRepository = {
		list: async () => [...categories.values()],
		findById: async (id: string) => categories.get(id) ?? null,
		findBySlug: async (slug: string) =>
			[...categories.values()].find((row) => row.slug === slug) ?? null,
		create: async () => {
			throw new Error('not used here');
		},
		update: async () => null,
		archive: async () => null,
		countLiveProducts: async () => 0,
	};

	const exported = new ExportedProductService(productRepository, categoryRepository, {
		// `inventory` owns the unit rows; this suites only needs the count.
		countSerials: async (productId) => unitCounts.get(productId) ?? 0,
	});

	return {
		service: new ProductService(
			productRepository,
			exported,
			new AuditWriterDouble(),
			{ next: async (codeType) => `${codeType}-code` },
		),
		items,
		unitCounts,
	};
}

describe('ProductService — product shape rules', () => {
	test('creates a valid product', async () => {
		const { service, items } = makeService();
		const created = await service.createProduct({
			organizationId: 'org-a',
			sku: 'CTRL-01',
			name: 'Door controller',
			productKind: 'product',
			isSerialized: true,
			isStockTracked: true,
		} as TProductCreateData);

		expect(created.sku).toBe('CTRL-01');
		// ERP-0043: the code comes from the numbering authority, per kind.
		expect(created.code).toBe('item_product-code');
		expect(items).toHaveLength(1);
	});

	test('rejects a serialized product that is not stock-tracked', async () => {
		const { service } = makeService();
		await expect(
			service.createProduct({
				organizationId: 'org-a',
				sku: 'CTRL-02',
				name: 'Ghost controller',
				productKind: 'product',
				isSerialized: true,
				isStockTracked: false,
			} as TProductCreateData),
		).rejects.toBeInstanceOf(ProductRuleViolationError);
	});

	test('rejects a duplicate SKU in the same tenant', async () => {
		const { service } = makeService({ items: [makeItem()] });
		await expect(
			service.createProduct(makeItem() as unknown as TProductCreateData),
		).rejects.toBeInstanceOf(ProductSkuTakenError);
	});

	test('allows the same SKU in a different tenant', async () => {
		const { service } = makeService({ items: [makeItem()] });
		const created = await service.createProduct({
			organizationId: 'org-b',
			sku: 'CTRL-01',
			name: 'Door controller',
			productKind: 'product',
			isSerialized: true,
			isStockTracked: true,
		} as TProductCreateData);
		expect(created.organizationId).toBe('org-b');
	});

	test('allows the same SKU for a global product and an org product', async () => {
		// The partial-unique pair makes these distinct keys; `null` is not
		// "equal to" any organization string.
		const { service } = makeService({
			items: [makeItem({ organizationId: null })],
		});
		const created = await service.createProduct({
			organizationId: 'org-a',
			sku: 'CTRL-01',
			name: 'Door controller',
			productKind: 'product',
			isSerialized: true,
			isStockTracked: true,
		} as TProductCreateData);
		expect(created.organizationId).toBe('org-a');
	});

	test('rejects a second global product with the same SKU', async () => {
		const { service } = makeService({
			items: [makeItem({ organizationId: null })],
		});
		await expect(
			service.createProduct({
				organizationId: null,
				sku: 'CTRL-01',
				name: 'Door controller',
				productKind: 'product',
				isSerialized: true,
				isStockTracked: true,
			} as TProductCreateData),
		).rejects.toBeInstanceOf(ProductSkuTakenError);
	});
});

describe('ProductService — reads', () => {
	test('getProduct returns the row and throws not-found when absent', async () => {
		const { service, items } = makeService({ items: [makeItem()] });
		expect((await service.getProduct(items[0]!.id)).id).toBe(items[0]!.id);
		await expect(
			service.getProduct('01920000-0000-7000-8000-00000000ffff'),
		).rejects.toBeInstanceOf(ProductNotFoundError);
	});

	test('getActiveProducts skips archived and inactive rows and de-duplicates ids', async () => {
		const active = makeItem();
		const inactive = makeItem({
			id: '01920000-0000-7000-8000-000000000002',
			sku: 'OFF',
			isActive: false,
		});
		const { service } = makeService({ items: [active, inactive] });
		const rows = await service.getActiveProducts([active.id, active.id, inactive.id]);
		expect(rows.map((row) => row.id)).toEqual([active.id]);
	});
});

describe('ProductService — serialization flag', () => {
	test('refuses to flip isSerialized while the product has live units', async () => {
		const seeded = makeItem({ isSerialized: true });
		const { service } = makeService({ items: [seeded], unitCounts: { [seeded.id]: 3 } });
		await expect(
			service.updateProduct(seeded.id, { isSerialized: false }),
		).rejects.toBeInstanceOf(ProductRuleViolationError);
	});

	test('allows flipping isSerialized when there are no units', async () => {
		const seeded = makeItem({ isSerialized: true });
		const { service } = makeService({ items: [seeded] });
		const updated = await service.updateProduct(seeded.id, { isSerialized: false });
		expect(updated.isSerialized).toBe(false);
	});

	test('re-sending the same isSerialized with units present is not a change', async () => {
		const seeded = makeItem({ isSerialized: true });
		const { service } = makeService({ items: [seeded], unitCounts: { [seeded.id]: 3 } });
		const updated = await service.updateProduct(seeded.id, { isSerialized: true, name: 'Renamed' });
		expect(updated.name).toBe('Renamed');
	});
});

describe('ProductService — archive', () => {
	test('archives a product with no units', async () => {
		const { service, items } = makeService({ items: [makeItem()] });
		await service.archiveProduct(items[0]!.id);
		expect(items[0]!.deletedAt).not.toBeNull();
	});

	test('refuses to archive a product that still has live units', async () => {
		const seeded = makeItem();
		const { service, items } = makeService({
			items: [seeded],
			unitCounts: { [seeded.id]: 2 },
		});
		await expect(service.archiveProduct(items[0]!.id)).rejects.toBeInstanceOf(
			ProductHasSerialsError,
		);
	});

	test('throws not-found for an absent product', async () => {
		const { service } = makeService();
		await expect(
			service.archiveProduct('01920000-0000-7000-8000-00000000ffff'),
		).rejects.toBeInstanceOf(ProductNotFoundError);
	});
});

describe('ProductService — categories (ADR-0011)', () => {
	const base = {
		organizationId: 'org-a',
		name: 'Controller',
		productKind: 'product',
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
		const created = await service.createProduct({
			...base,
			sku: 'CAT-1',
			productCategoryId: ACTIVE_CATEGORY,
		});
		expect(created.productCategoryId).toBe(ACTIVE_CATEGORY);
		// The facade reports a missing category as ProductNotFoundError; the
		// service does not translate another module's vocabulary, so both a
		// missing and an inactive category surface as that 404.
		await expect(
			service.createProduct({
				...base,
				sku: 'CAT-2',
				productCategoryId: INACTIVE_CATEGORY,
			}),
		).rejects.toBeInstanceOf(ProductNotFoundError);
		await expect(
			service.createProduct({
				...base,
				sku: 'CAT-3',
				productCategoryId: '01920000-0000-7000-8000-00000000c0ff',
			}),
		).rejects.toBeInstanceOf(ProductNotFoundError);
	});

	test('a product keeps a category that became inactive, but cannot move into one', async () => {
		const keeper = makeItem({ productCategoryId: INACTIVE_CATEGORY });
		const mover = makeItem({
			id: '01920000-0000-7000-8000-0000000000aa',
			sku: 'MOVE',
			productCategoryId: null,
		});
		const { service } = makeService({ items: [keeper, mover] });
		const renamed = await service.updateProduct(keeper.id, {
			name: 'Renamed',
			productCategoryId: INACTIVE_CATEGORY,
		});
		expect(renamed.name).toBe('Renamed');
		await expect(
			service.updateProduct(mover.id, { productCategoryId: INACTIVE_CATEGORY }),
		).rejects.toBeInstanceOf(ProductNotFoundError);
	});

	test('an active category is assignable on update', async () => {
		const row = makeItem({ productCategoryId: null });
		const { service } = makeService({ items: [row] });
		const updated = await service.updateProduct(row.id, {
			productCategoryId: ACTIVE_CATEGORY,
		});
		expect(updated.productCategoryId).toBe(ACTIVE_CATEGORY);
	});

	test('ProductCategoryUnavailableError stays exported for presentational mapping', () => {
		// The error class is still part of the module's vocabulary (the i18n key
		// `product.categoryUnavailable` exists); nothing in the service throws it
		// any more because the facade owns the rule.
		expect(new ProductCategoryUnavailableError().status).toBe(422);
	});
});
