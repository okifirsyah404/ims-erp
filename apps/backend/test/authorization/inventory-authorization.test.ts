/**
 * Inventory authorization integration tests — stock, items, borrowing.
 *
 * Exercises the REAL Elysia pipeline for the inventory routes (erpGuard macro +
 * the inventory controllers + their services) through `app.handle()`, with
 * Better Auth and the repositories mocked at their seams.
 *
 * The point of this file is not the CRUD itself (covered by the service unit
 * tests) but the permission walls:
 * - `stock:*` / `stock_adjustment:*` gate the ledger and the adjustment chain;
 * - `asset:*` gates the item fleet and the custody flows;
 * - no organization role gained warehouse access (warehouses are
 *   application-admin-only, proved in `warehouse-authorization.test.ts`).
 *
 * ADR-0026 moved the product master and the warehouse estate to their own
 * modules, so the product/catalog authorization lives in
 * `product-authorization.test.ts` and this file keeps only what `inventory`
 * still owns: balances, movements, adjustments, items and borrowings.
 */
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { erpRoleGrants, erpStatements } from '@ims-erp/common';
import {
	fixture,
	installAuthMock,
	installPermissionResolverMock,
	resetFixture,
} from './test-app';

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

beforeAll(async () => {
	installAuthMock();
	installPermissionResolverMock();

	// Import after mocks are installed (bun mock.module is hoist-sensitive).
	const { BorrowingController } = await import(
		'../../src/app/inventory/controllers/borrowing.controller'
	);
	const { ItemController } = await import(
		'../../src/app/inventory/controllers/item.controller'
	);
	const { ItemOperationsController } = await import(
		'../../src/app/inventory/controllers/item-operations.controller'
	);
	const {
		ITEM_SERVICE_TOKEN,
		ITEM_IMAGE_SERVICE_TOKEN,
		ITEM_REPOSITORY_TOKEN,
		ITEM_CUSTODY_SERVICE_TOKEN,
		MAINTENANCE_SERVICE_TOKEN,
		DISPOSAL_SERVICE_TOKEN,
		TOOL_SET_SERVICE_TOKEN,
		ITEM_DOCUMENT_SERVICE_TOKEN,
		BORROWING_REQUEST_SERVICE_TOKEN,
		BORROWING_SERVICE_TOKEN,
	} = await import('../../src/app/inventory/constants/di');
	const { erpGuard } = await import('../../src/authorization/elysia-auth');

	// The controllers mount for their guards; every token they resolve is a
	// stub, so a handler that the permission wall lets through (the `owner`
	// read) does not need a database. Nothing else gets past its grant.
	container.registerInstance(ITEM_SERVICE_TOKEN, {
		async paginate() {
			return { meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] };
		},
		async listKinds() {
			return [];
		},
	} as never);
	container.registerInstance(ITEM_REPOSITORY_TOKEN, {} as never);
	// The photo service needs object storage; the wall under test is authorization.
	container.registerInstance(ITEM_IMAGE_SERVICE_TOKEN, {
		withImageUrl: (row: object) => ({ ...row, imageUrl: null }),
		withImages: async (row: object) => ({ ...row, imageUrl: null, images: [] }),
		list: async () => [],
		urlFor: () => null,
		async setImage() {
			return { imageUrl: null };
		},
	} as never);
	container.registerInstance(ITEM_CUSTODY_SERVICE_TOKEN, {} as never);
	container.registerInstance(MAINTENANCE_SERVICE_TOKEN, {} as never);
	container.registerInstance(DISPOSAL_SERVICE_TOKEN, {} as never);
	container.registerInstance(TOOL_SET_SERVICE_TOKEN, {} as never);
	container.registerInstance(ITEM_DOCUMENT_SERVICE_TOKEN, {} as never);
	container.registerInstance(BORROWING_REQUEST_SERVICE_TOKEN, {} as never);
	container.registerInstance(BORROWING_SERVICE_TOKEN, {} as never);

	// `erpGuard` + the inventory controllers only: the guards refuse before a
	// handler runs, so most routes never reach a service. (Stock and
	// adjustments have their own suite in `stock-authorization`, with
	// repository doubles, because their handlers do reach a service.)
	app = new Elysia()
		.use(erpGuard())
		.use(ItemController.plugin())
		.use(ItemOperationsController.plugin())
		.use(BorrowingController.plugin());
});

beforeEach(() => {
	resetFixture();
});

describe('inventory routes — authentication', () => {
	test('GET /items without a session returns 401', async () => {
		const response = await app.handle(jsonRequest('GET', '/inventory/items'));
		expect(response.status).toBe(401);
	});

	test('POST /items without a session returns 401', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/inventory/items', undefined, {
				organizationId: fixture.orgA,
				name: 'X',
			}),
		);
		expect(response.status).toBe(401);
	});

	test('GET /inventory/borrowings without a session returns 401', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/inventory/borrowings'),
		);
		expect(response.status).toBe(401);
	});
});

describe('inventory routes — organization scope', () => {
	test('a global admin without membership is refused (403, not bypass)', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/inventory/items', 'globalAdmin'),
		);
		expect(response.status).toBe(403);
	});

	test('an owner reaches the inventory item list', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/inventory/items', 'owner', undefined, fixture.orgA),
		);
		expect(response.status).toBe(200);
	});

	test('a member cannot create an item (403)', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/inventory/items',
				'member',
				{ organizationId: fixture.orgA, name: 'Blocked' },
				fixture.orgA,
			),
		);
		expect(response.status).toBe(403);
	});
});

describe('inventory routes — permission vocabulary', () => {
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

	test('the stock vocabulary keeps read, receive, issue and adjustment actions', () => {
		for (const action of ['read', 'receive', 'issue', 'transfer']) {
			expect(erpStatements.stock).toContain(action as never);
		}
		for (const action of ['read', 'create', 'submit', 'approve', 'post']) {
			expect(erpStatements.stock_adjustment).toContain(action as never);
		}
	});
});
