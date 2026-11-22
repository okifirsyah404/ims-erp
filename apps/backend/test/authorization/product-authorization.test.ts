/**
 * Product authorization integration tests.
 *
 * Exercises the REAL Elysia pipeline for the product routes (`erpGuard` macro +
 * `ProductController` + `ProductService`, plus the listing/category controllers)
 * through `app.handle()`, with Better Auth mocked at its seam and the product
 * module's repositories stubbed at theirs.
 *
 * ADR-0026 moved the product master out of `inventory`, so this suite owns the
 * product half of what used to be `inventory-authorization.test.ts`:
 * - `product:*` is the gate on every product route;
 * - tenant scope comes from the session, never from the body;
 * - the public catalog path is not shadowed by the admin `/products/:id` route;
 * - stock/items/borrowings stay in `inventory-authorization.test.ts`.
 */
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { AuditWriterDouble } from '../helpers/audit-writer-double';
import {
	fixture,
	installAuthMock,
	installPermissionResolverMock,
	resetFixture,
} from './test-app';
import type { IProductRepository } from '../../src/app/product/contracts/product.repository.interface';
import type {
	TProductCategorySelect,
	TProductSelect,
} from '@drizzle/schemas/product.schema';

let app: Elysia<any, any, any, any, any, any>;

const baseHeaders = (session?: string, org?: string): Headers => {
	const headers = new Headers({ 'content-type': 'application/json' });
	if (session) headers.set('x-test-session', session);
	if (org) headers.set('x-organization-id', org);
	return headers;
};

const jsonRequest = (
	method: string,
	path: string,
	session?: string,
	body?: unknown,
	org?: string,
): Request =>
	new Request(`http://localhost${path}`, {
		method,
		headers: baseHeaders(session, org),
		body: body === undefined ? undefined : JSON.stringify(body),
	});

/** Minimal product row so the list endpoint has something to return. */
function seedRow(organizationId: string): TProductSelect {
	return {
		id: '01920000-0000-7000-8000-000000000001',
		organizationId,
		code: 'PRD-00001',
		sku: 'CTRL-01',
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
		serialNumber: null,
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
	};
}

beforeAll(async () => {
	installAuthMock();
	installPermissionResolverMock();

	const rows = [seedRow(fixture.orgA)];

	const productRepository: IProductRepository = {
		ranges: async () => ({ maxSellingPrice: 0, maxStock: 0 }),
		async paginate(request) {
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
		async findActiveByIds(ids) {
			return rows.filter((row) => ids.includes(row.id) && row.isActive);
		},
		async findBySku(organizationId, sku) {
			return (
				rows.find(
					(row) => row.organizationId === organizationId && row.sku === sku,
				) ?? null
			);
		},
		async create(data, code) {
			const row = seedRow(data.organizationId ?? fixture.orgA);
			row.code = code;
			rows.push(row);
			return row;
		},
		async update(id, data) {
			const row = rows.find((candidate) => candidate.id === id);
			if (!row) return null;
			Object.assign(row, data);
			return row;
		},
		async archive(id) {
			const row = rows.find((candidate) => candidate.id === id);
			if (!row) return null;
			row.deletedAt = new Date();
			return row;
		},
		async findNamesByIds(ids) {
			return rows
				.filter((row) => ids.includes(row.id))
				.map((row) => ({
					id: row.id,
					name: row.name,
					sku: row.sku,
					unitLabel: row.unitLabel,
					imageObjectKey: row.imageObjectKey,
				}));
		},
		async findByIds(ids) {
			return rows.filter((row) => ids.includes(row.id));
		},
		async productKinds(ids) {
			return rows
				.filter((row) => ids.includes(row.id))
				.map((row) => ({ id: row.id, productKind: row.productKind }));
		},
		async searchByNameOrSku() {
			return [];
		},
		async listListed() {
			return rows.filter((row) => row.slug !== null);
		},
		async listPublished() {
			return rows.filter((row) => row.slug !== null && row.isPublished);
		},
		async findBySlug(slug) {
			return rows.find((row) => row.slug === slug) ?? null;
		},
		async findPublishedBySlug(slug) {
			return (
				rows.find(
					(row) => row.slug === slug && row.isPublished && row.isActive,
				) ?? null
			);
		},
		async countUnits() {
			return 0;
		},
	};

	// Import after mocks are installed (bun mock.module is hoist-sensitive).
	const {
		PRODUCT_REPOSITORY_TOKEN,
		PRODUCT_CATEGORY_REPOSITORY_TOKEN,
		PRODUCT_SERVICE_TOKEN,
		PRODUCT_IMAGE_SERVICE_TOKEN,
		PRODUCT_LISTING_SERVICE_TOKEN,
		PRODUCT_CATEGORY_SERVICE_TOKEN,
		PRODUCT_NUMBERING_SERVICE_TOKEN,
		PRODUCT_SERIAL_COUNTS_TOKEN,
		EXPORTED_PRODUCT_SERVICE_TOKEN,
	} = await import('../../src/app/product/constants/di');
	const { ProductService } = await import(
		'../../src/app/product/services/product.service'
	);
	const { ExportedProductService } = await import(
		'../../src/app/product/services/exported-product.service'
	);
	const { ProductListingService } = await import(
		'../../src/app/product/services/product-listing.service'
	);
	const { ProductCategoryService } = await import(
		'../../src/app/product/services/product-category.service'
	);	const { ProductController } = await import(
		'../../src/app/product/controllers/product.controller'
	);
	const { ProductListingController } = await import(
		'../../src/app/product/controllers/product-listing.controller'
	);
	const { ProductCategoryController } = await import(
		'../../src/app/product/controllers/product-category.controller'
	);
	const { PublicCatalogController } = await import(
		'../../src/app/product/controllers/public-catalog.controller'
	);
	const { erpGuard } = await import('../../src/authorization/elysia-auth');

	// One in-memory category store, shared by the export facade and the category
	// service: no category is involved in this suite, but the facade is what
	// `ProductService` asks before writing a SKU or a category.
	const categoryRows: TProductCategorySelect[] = [];
	const categoryRepository = {
		async list() {
			return categoryRows;
		},
		async findById(id: string) {
			return categoryRows.find((row) => row.id === id) ?? null;
		},
		async findBySlug(slug: string) {
			return categoryRows.find((row) => row.slug === slug) ?? null;
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
		async countLiveProducts() {
			return 0;
		},
	};

	// ADR-0026: the serial count is an `inventory` fact, carried by a port so
	// the product/inventory facades do not close a constructor cycle. The
	// module owns no units in this suite.
	const serialCounts = { countSerials: async () => 0 };
	const exported = new ExportedProductService(
		productRepository,
		categoryRepository,
		serialCounts,
	);

	container.register(PRODUCT_REPOSITORY_TOKEN, { useValue: productRepository });
	container.registerInstance(PRODUCT_CATEGORY_REPOSITORY_TOKEN, categoryRepository as never);
	container.registerInstance(PRODUCT_SERIAL_COUNTS_TOKEN, serialCounts);
	container.registerInstance(EXPORTED_PRODUCT_SERVICE_TOKEN, exported as never);
	container.registerInstance(PRODUCT_NUMBERING_SERVICE_TOKEN, {
		next: async (
			_codeType: string,
			_tx?: unknown,
			_date?: Date,
		): Promise<string> => 'PRD-00001',
	} as never);
	// Photos are not part of the authorization suite.
	container.registerInstance(PRODUCT_IMAGE_SERVICE_TOKEN, {
		withImageUrl: (row: object) => ({ ...row, imageUrl: null }),
		urlFor: () => null,
	} as never);
	container.registerInstance(
		PRODUCT_SERVICE_TOKEN,
		new ProductService(
			productRepository,
			exported,
			new AuditWriterDouble(),
			{ next: async () => 'PRD-00001' },
		) as never,
	);
	container.registerInstance(
		PRODUCT_CATEGORY_SERVICE_TOKEN,
		new ProductCategoryService(categoryRepository, exported) as never,
	);
	container.registerInstance(
		PRODUCT_LISTING_SERVICE_TOKEN,
		new ProductListingService(
			productRepository,
			categoryRepository,
			{ availableByProducts: async () => [] },
			{ urlFor: () => null },
			{ listApplications: async () => [] },
		) as never,
	);

	app = new Elysia()
		.use(erpGuard())
		// Mount order mirrors `productModule()`: the static public catalog path
		// must never be shadowed by `/products/:id`.
		.use(PublicCatalogController.plugin())
		.use(ProductController.plugin())
		.use(ProductListingController.plugin())
		.use(ProductCategoryController.plugin());
});

beforeEach(() => {
	resetFixture();
});

describe('product routes — authentication', () => {
	test('GET /products without a session returns 401', async () => {
		const response = await app.handle(jsonRequest('GET', '/products'));
		expect(response.status).toBe(401);
	});

	test('POST /products without a session returns 401', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/products', undefined, {
				organizationId: fixture.orgA,
				sku: 'X',
				name: 'X',
				productKind: 'product',
			}),
		);
		expect(response.status).toBe(401);
	});
});

describe('product routes — organization scope', () => {
	test('a global admin without membership is refused (403, not bypass)', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/products', 'globalAdmin'),
		);
		expect(response.status).toBe(403);
	});

	test('an owner can read products', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/products', 'owner', undefined, fixture.orgA),
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { data: unknown[] };
		expect(body.data).toHaveLength(1);
	});

	test('an owner can create a product and it is pinned to their organization', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/products',
				'owner',
				{
					organizationId: fixture.orgA,
					sku: 'NEW-01',
					name: 'New controller',
					productKind: 'product',
					isSerialized: true,
					isStockTracked: true,
				},
				fixture.orgA,
			),
		);
		expect(response.status).toBe(201);
		const body = (await response.json()) as {
			data: { organizationId: string | null };
		};
		expect(body.data.organizationId).toBe(fixture.orgA);
	});

	test('a member cannot create a product (403)', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/products',
				'member',
				{
					organizationId: fixture.orgA,
					sku: 'M-01',
					name: 'Blocked',
					productKind: 'product',
				},
				fixture.orgA,
			),
		);
		expect(response.status).toBe(403);
	});
});

describe('product routes — validation', () => {
	test('rejects an unknown product kind with 400', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/products',
				'owner',
				{
					organizationId: fixture.orgA,
					sku: 'BAD',
					name: 'Bad kind',
					productKind: 'spaceship',
				},
				fixture.orgA,
			),
		);
		expect(response.status).toBe(400);
	});

	test('rejects an invalid uuid path param with 400', async () => {
		const response = await app.handle(
			jsonRequest(
				'GET',
				'/products/not-a-uuid',
				'owner',
				undefined,
				fixture.orgA,
			),
		);
		expect(response.status).toBe(400);
	});
});

describe('product routes — catalog surfaces', () => {
	test('the public catalog path is not shadowed by /products/:id', async () => {
		// `GET /products/public/v1/catalog/categories` must never be parsed as a
		// product id: the static prefix wins over the `:id` parameter, so the
		// request reaches the API-key guard instead of failing uuid parsing.
		const withSession = await app.handle(
			jsonRequest(
				'GET',
				'/products/public/v1/catalog/categories',
				'owner',
				undefined,
				fixture.orgA,
			),
		);
		expect(withSession.status).toBe(401);

		const anonymous = await app.handle(
			jsonRequest('GET', '/products/public/v1/catalog/categories'),
		);
		expect(anonymous.status).toBe(401);
	});

	test('the admin listing surface is gated on catalog:*', async () => {
		// `finance` holds no `catalog:*` grant: the wall refuses before the
		// handler runs.
		const response = await app.handle(
			jsonRequest('GET', '/product-listings', 'finance', undefined, fixture.orgA),
		);
		expect(response.status).toBe(403);
	});

	test('product categories ride the product permissions', async () => {
		const read = await app.handle(
			jsonRequest('GET', '/product-categories', 'owner', undefined, fixture.orgA),
		);
		expect(read.status).toBe(200);

		const denied = await app.handle(
			jsonRequest('GET', '/product-categories', 'member', undefined, fixture.orgA),
		);
		expect(denied.status).toBe(403);
	});
});
