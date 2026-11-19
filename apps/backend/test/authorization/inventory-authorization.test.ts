/**
 * Inventory authorization integration tests.
 *
 * Exercises the REAL Elysia pipeline for the item routes (erpGuard macro +
 * ProductController + ProductService) through `app.handle()`, with Better Auth and
 * the repositories mocked at their seams.
 *
 * The point of this file is not the CRUD itself (covered by the service
 * unit tests) but that `product:*` is the gate, that no organization role
 * gained warehouse access, and that a global admin without membership is
 * still refused on tenant data.
 */
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { AuditWriterDouble } from '../helpers/audit-writer-double';
import { erpRoleGrants, erpStatements } from '@ims-erp/common';
import {
	fixture,
	installAuthMock,
	installPermissionResolverMock,
	resetFixture,
} from './test-app';
import type { IProductRepository } from '../../src/app/inventory/contracts/product.repository.interface';
import type { IItemSerialRepository } from '../../src/app/inventory/contracts/item-serial.repository.interface';
import type { TProductSelect } from '@drizzle/schemas/inventory.schema';

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

/** Minimal item row so the list endpoint has something to return. */
function seedRow(organizationId: string): TProductSelect {
	return {
		id: '01920000-0000-7000-8000-000000000001',
		organizationId,
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
		minStockQty: '0.000',
		barcode: null,
		sellingPrice: 0,
		purchasePrice: 0,
		currencyCode: 'IDR',
		createdAt: new Date(0),
		updatedAt: null,
		deletedAt: null,
	} as TProductSelect;
}

beforeAll(async () => {
	installAuthMock();
	installPermissionResolverMock();

	const rows = [seedRow(fixture.orgA)];

	const itemRepository: IProductRepository = {
		async findActiveByIds() {
			return [];
		},
		async paginate(r) {
			return {
				meta: {
					page: r.page,
					limit: r.limit,
					total: rows.length,
					totalPages: 1,
				},
				data: rows,
			};
		},
		async findById(id) {
			return rows.find((row) => row.id === id) ?? null;
		},
		async findBySku(org, sku) {
			return (
				rows.find((row) => row.organizationId === org && row.sku === sku) ??
				null
			);
		},
		async create(data, code) {
			const row = seedRow(data.organizationId ?? fixture.orgA);
			row.code = code;
			rows.push(row);
			return row;
		},
		async update(id, data) {
			const row = rows.find((r) => r.id === id);
			if (!row) return null;
			Object.assign(row, data);
			return row;
		},
		async archive(id) {
			const row = rows.find((r) => r.id === id);
			if (!row) return null;
			row.deletedAt = new Date();
			return row;
		},
		async countUnits() {
			return 0;
		},
		async findNamesByIds() {
			return [];
		},
	};

	const serialUnitRepository: IItemSerialRepository = {
		async paginate(r) {
			return {
				meta: { page: r.page, limit: r.limit, total: 0, totalPages: 0 },
				data: [],
			};
		},
		async findById() {
			return null;
		},
		async findBySerial() {
			return null;
		},
		async create() {
			throw new Error('not used in this suite');
		},
		async replaceProvisionalSerial() {
			return null;
		},
		async updateStatus() {
			return null;
		},
		async listInStockSerials() {
			return [];
		},
		async sell() {
			return [];
		},
		async returnToSupplier() {
			return [];
		},
		async listSerialsInStatuses() {
			return [];
		},
		async receiveFromCustomer() {
			return [];
		},
	};

	// Import after mocks are installed (bun mock.module is hoist-sensitive).
	const {
		PRODUCT_CATEGORY_REPOSITORY_TOKEN,
		PRODUCT_REPOSITORY_TOKEN,
		ITEM_SERIAL_REPOSITORY_TOKEN,
		PRODUCT_SERVICE_TOKEN,
		PRODUCT_IMAGE_SERVICE_TOKEN,
	} = await import('../../src/app/inventory/constants/di');
	const { ProductService } = await import(
		'../../src/app/inventory/services/product.service'
	);
	const { InventoryAuditWriter } = await import(
		'../../src/app/inventory/services/inventory-audit.writer'
	);
	const { ProductController } = await import(
		'../../src/app/inventory/controllers/product.controller'
	);
	const { erpGuard } = await import('../../src/authorization/elysia-auth');

	container.register(PRODUCT_REPOSITORY_TOKEN, { useValue: itemRepository });
	container.register(ITEM_SERIAL_REPOSITORY_TOKEN, {
		useValue: serialUnitRepository,
	});
	// No category is involved in the authorization suite.
	container.register(PRODUCT_CATEGORY_REPOSITORY_TOKEN, {
		useValue: { findById: async () => null } as never,
	});
	container.register(InventoryAuditWriter, {
		useValue: new AuditWriterDouble(),
	});
	// ERP-0043: item codes come from the numbering authority.
	const { CODE_NUMBER_SERVICE_TOKEN } = await import(
		'../../src/app/code-number/constants/di'
	);
	container.register(CODE_NUMBER_SERVICE_TOKEN, {
		useValue: { next: async () => 'PRD-00001' } as never,
	});
	container.register(PRODUCT_SERVICE_TOKEN, { useClass: ProductService });
	// Photos are not part of the authorization suite.
	container.register(PRODUCT_IMAGE_SERVICE_TOKEN, { useValue: { withImageUrl: (item: object) => ({ ...item, imageUrl: null }) } as never });

	app = new Elysia().use(erpGuard()).use(ProductController.plugin());
});

beforeEach(() => {
	resetFixture();
});

describe('item routes — authentication', () => {
	test('GET /items without a session returns 401', async () => {
		const response = await app.handle(jsonRequest('GET', '/items'));
		expect(response.status).toBe(401);
	});

	test('POST /items without a session returns 401', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/items', undefined, {
				organizationId: fixture.orgA,
				sku: 'X',
				name: 'X',
				productKind: 'product',
			}),
		);
		expect(response.status).toBe(401);
	});
});

describe('item routes — organization scope', () => {
	test('a global admin without membership is refused (403, not bypass)', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/items', 'globalAdmin'),
		);
		expect(response.status).toBe(403);
	});

	test('an owner can read items', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/items', 'owner', undefined, fixture.orgA),
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.data).toHaveLength(1);
	});

	test('an owner can create an item and it is pinned to their organization', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/items',
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
		const body = await response.json();
		expect(body.data.organizationId).toBe(fixture.orgA);
	});

	test('a member cannot create an item (403)', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/items',
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

describe('item routes — validation', () => {
	test('rejects an unknown item kind with 400', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/items',
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
			jsonRequest('GET', '/items/not-a-uuid', 'owner', undefined, fixture.orgA),
		);
		expect(response.status).toBe(400);
	});
});

describe('warehouse access is application-admin-only', () => {
	test('no organization role holds any warehouse action', () => {
		for (const [role, grants] of Object.entries(erpRoleGrants)) {
			const warehouse = (grants as Record<string, readonly string[]>).warehouse;
			// `undefined` (never granted) or `[]` (explicitly emptied, as the
			// owner's blanket spread required) both mean "no access".
			expect({ role, actions: warehouse ?? [] }).toEqual({
				role,
				actions: [],
			});
		}
	});

	test('the warehouse statement still exists in the catalog', () => {
		// The vocabulary stays complete and typed even though no organization
		// role may hold it.
		for (const action of ['read', 'create', 'update', 'archive']) {
			expect(erpStatements.warehouse).toContain(action as never);
		}
	});

	test('the borrowing statement is granted to the request-issuing roles', () => {
		const roles = ['technician', 'sales', 'sales_manager', 'warehouse'] as const;
		for (const role of roles) {
			const grants = erpRoleGrants[role] as Record<string, readonly string[]>;
			expect(grants.asset_borrowing).toBeDefined();
			expect(grants.asset_borrowing).toContain('read');
		}
	});

	test('a technician may request but may not issue a borrowing', () => {
		const technician = erpRoleGrants.technician as Record<
			string,
			readonly string[]
		>;
		expect(technician.asset_borrowing).toContain('create');
		expect(technician.asset_borrowing).not.toContain('issue');
	});

	test('only management roles may mark a unit lost', () => {
		for (const role of ['owner', 'admin', 'operations_manager'] as const) {
			const grants = erpRoleGrants[role] as Record<string, readonly string[]>;
			expect(grants.asset_borrowing).toContain('mark_lost');
		}
		const technician = erpRoleGrants.technician as Record<
			string,
			readonly string[]
		>;
		expect(technician.asset_borrowing).not.toContain('mark_lost');
	});
});
