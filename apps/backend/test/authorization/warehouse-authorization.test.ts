/**
 * Warehouse authorization integration tests.
 *
 * Exercises the REAL Elysia pipeline for the warehouse routes (sessionGuard +
 * the `requireGlobalAdmin` policy + WarehouseController + WarehouseService)
 * through `app.handle()`, with Better Auth and the repositories mocked at their
 * seams.
 *
 * The point of this file is the authorization wall, not the CRUD:
 * - every organization role is refused on **every** warehouse route, reads
 *   included (403, not an empty list — plan §4);
 * - an organization role that happens to be named `admin` is still refused,
 *   because the gate reads the *platform* role;
 * - an application admin who belongs to no organization is allowed, which is
 *   the whole reason these routes ride `sessionGuard` instead of `erpGuard`.
 */
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { AuditWriterDouble } from '../helpers/audit-writer-double';
import { container } from 'tsyringe';
import type { TWarehouseSelect } from '@drizzle/schemas/inventory.schema';
import {
	fixture,
	installAuthMock,
	installPermissionResolverMock,
	resetFixture,
} from './test-app';
import type { IWarehouseRepository } from '../../src/app/inventory/contracts/warehouse.repository.interface';
import type { IWarehouseAddressRepository } from '../../src/app/inventory/contracts/warehouse-address.repository.interface';
import type { IWarehouseStorageRepository } from '../../src/app/inventory/contracts/warehouse-storage.repository.interface';

let app: Elysia<any, any, any, any, any, any>;

const WAREHOUSE_ID = '01920000-0000-7000-8000-0000000000aa';
const STORAGE_ID = '01920000-0000-7000-8000-0000000000bb';

const baseHeaders = (session?: string): Headers => {
	const headers = new Headers({ 'content-type': 'application/json' });
	if (session) headers.set('x-test-session', session);
	return headers;
};

const jsonRequest = (
	method: string,
	path: string,
	session?: string,
	body?: unknown,
): Request =>
	new Request(`http://localhost${path}`, {
		method,
		headers: baseHeaders(session),
		body: body === undefined ? undefined : JSON.stringify(body),
	});

/** Minimal warehouse row so the list/detail endpoints have something to return. */
function seedWarehouse(organizationId: string | null): TWarehouseSelect {
	return {
		id: WAREHOUSE_ID,
		organizationId,
		code: 'MAIN',
		name: 'Main warehouse',
		responsibleEmployeeId: null,
		isDefault: true,
		isActive: true,
		createdAt: new Date(0),
		updatedAt: null,
		deletedAt: null,
	} as TWarehouseSelect;
}

/**
 * Every warehouse route, with the method and body each one needs.
 *
 * @remarks
 * Authorized admins must succeed here too: a route missing from this table is
 * a route with no proof that it is both guarded and reachable.
 */
const ROUTES: ReadonlyArray<{
	method: string;
	path: string;
	body?: unknown;
}> = [
	{ method: 'GET', path: '/warehouses' },
	{ method: 'GET', path: `/warehouses/${WAREHOUSE_ID}` },
	{
		method: 'POST',
		path: '/warehouses',
		body: { code: 'NEW', name: 'New warehouse' },
	},
	{
		method: 'PATCH',
		path: `/warehouses/${WAREHOUSE_ID}`,
		body: { name: 'Renamed' },
	},
	{ method: 'DELETE', path: `/warehouses/${WAREHOUSE_ID}` },
	{ method: 'GET', path: `/warehouses/${WAREHOUSE_ID}/address` },
	{
		method: 'PUT',
		path: `/warehouses/${WAREHOUSE_ID}/address`,
		body: { street: 'Jl. Sudirman 1' },
	},
	{ method: 'DELETE', path: `/warehouses/${WAREHOUSE_ID}/address` },
	{ method: 'GET', path: `/warehouses/${WAREHOUSE_ID}/storages` },
	{
		method: 'POST',
		path: `/warehouses/${WAREHOUSE_ID}/storages`,
		body: { code: 'A1' },
	},
	{
		method: 'PATCH',
		path: `/warehouses/${WAREHOUSE_ID}/storages/${STORAGE_ID}`,
		body: { name: 'Shelf A1' },
	},
	{
		method: 'DELETE',
		path: `/warehouses/${WAREHOUSE_ID}/storages/${STORAGE_ID}`,
	},
];

/** Organization roles that must never reach a warehouse route. */
const FORBIDDEN_USERS = [
	'owner',
	'admin', // organization admin — NOT a platform admin
	'sales',
	'salesFinance',
	'technician',
	'member',
] as const;

beforeAll(async () => {
	installAuthMock();
	installPermissionResolverMock();

	const seed = seedWarehouse(fixture.orgA);

	const warehouseRepository: IWarehouseRepository = {
		async paginate(r) {
			return {
				meta: { page: r.page, limit: r.limit, total: 1, totalPages: 1 },
				data: [seed],
			};
		},
		async findById(id) {
			return id === seed.id ? seed : null;
		},
		// ERP-0031: linked only to the fixture's member org.
		async isLinked(warehouseId, organizationId) {
			return warehouseId === seed.id && organizationId === fixture.orgA;
		},
		async listLinked(organizationId) {
			return organizationId === fixture.orgA ? [seed] : [];
		},
		async listOrganizations(warehouseId) {
			return warehouseId === seed.id
				? [{ organizationId: fixture.orgA, createdAt: new Date(0) }]
				: [];
		},
		async linkOrganization(warehouseId, organizationId) {
			return { created: warehouseId !== seed.id || organizationId !== fixture.orgA };
		},
		async unlinkOrganization(warehouseId, organizationId) {
			return warehouseId === seed.id && organizationId === fixture.orgA;
		},
		async findByCode() {
			return null;
		},
		async create(data) {
			return { ...seed, ...data } as TWarehouseSelect;
		},
		async update(id, data) {
			return id === seed.id ? ({ ...seed, ...data } as TWarehouseSelect) : null;
		},
		async archive(id) {
			return id === seed.id ? seed : null;
		},
		async findNamesByIds(ids) {
			return ids.includes(seed.id) ? [{ id: seed.id, name: seed.name }] : [];
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

	const addressRepository: IWarehouseAddressRepository = {
		async findByWarehouseId() {
			return null;
		},
		async upsert(_warehouseId, data) {
			return {
				id: '01920000-0000-7000-8000-0000000000cc',
				warehouseId: WAREHOUSE_ID,
				label: null,
				rt: null,
				rw: null,
				postalCode: null,
				villageId: null,
				latitude: null,
				longitude: null,
				createdAt: new Date(0),
				updatedAt: null,
				deletedAt: null,
				...data,
			} as never;
		},
		async remove() {
			return true;
		},
	};

	const storageRepository: IWarehouseStorageRepository = {
		async listByWarehouse() {
			return [];
		},
		async findById(id) {
			if (id !== STORAGE_ID) return null;
			return {
				id: STORAGE_ID,
				warehouseId: WAREHOUSE_ID,
				code: 'A1',
				name: null,
				binType: null,
				capacity: null,
				isActive: true,
				createdAt: new Date(0),
				updatedAt: null,
				deletedAt: null,
			} as never;
		},
		async findByCode() {
			return null;
		},
		async create(data) {
			return { ...data, id: STORAGE_ID } as never;
		},
		async update(id, data) {
			return { ...data, id, warehouseId: WAREHOUSE_ID } as never;
		},
		async archive(id) {
			return { id } as never;
		},
	};

	// Import after mocks are installed (bun mock.module is hoist-sensitive).
	const {
		WAREHOUSE_REPOSITORY_TOKEN,
		WAREHOUSE_ADDRESS_REPOSITORY_TOKEN,
	WAREHOUSE_BORROWING_GUARD_TOKEN,
		WAREHOUSE_STORAGE_REPOSITORY_TOKEN,
		WAREHOUSE_SERVICE_TOKEN,
	} = await import('../../src/app/inventory/constants/di');
	const { WarehouseService } = await import(
		'../../src/app/inventory/services/warehouse.service'
	);
	const { InventoryAuditWriter } = await import(
		'../../src/app/inventory/services/inventory-audit.writer'
	);
	const { WarehouseController } = await import(
		'../../src/app/inventory/controllers/warehouse.controller'
	);
	const { sessionGuard } = await import('../../src/authorization/elysia-auth');
	const { EXPORTED_ASSET_SERVICE_TOKEN } = await import(
		'../../src/app/assets/constants/di'
	);
	const { EXPORTED_HR_SERVICE_TOKEN } = await import(
		'../../src/app/hr/constants/di'
	);

	container.register(WAREHOUSE_REPOSITORY_TOKEN, {
		useValue: warehouseRepository,
	});
	container.register(WAREHOUSE_ADDRESS_REPOSITORY_TOKEN, {
		useValue: addressRepository,
	});
	container.register(WAREHOUSE_STORAGE_REPOSITORY_TOKEN, {
		useValue: storageRepository,
	});
	container.register(InventoryAuditWriter, {
		useValue: new AuditWriterDouble(),
	});
	// ERP-0031: the unlink guard port — noop here (no borrowings under test).
	container.register(WAREHOUSE_BORROWING_GUARD_TOKEN, {
		useValue: { async countOpenBorrowings() { return 0; } },
	});
	// Equipment counts come from the assets module's export facade — noop here.
	container.register(EXPORTED_ASSET_SERVICE_TOKEN, {
		useValue: { async countByWarehouse() { return []; } } as never,
	});
	// Warehouse PIC validation goes through the HR module's export facade —
	// noop here (the authorization tests never submit a PIC employee id).
	container.register(EXPORTED_HR_SERVICE_TOKEN, {
		useValue: {
			async findEmployeeById() {
				return undefined;
			},
			async findEmployeeByUserId() {
				return undefined;
			},
		} as never,
	});
	container.register(WAREHOUSE_SERVICE_TOKEN, { useClass: WarehouseService });

	app = new Elysia().use(sessionGuard()).use(WarehouseController.plugin());
});

beforeEach(() => {
	resetFixture();
});

describe('warehouse routes — authentication', () => {
	test.each(ROUTES)(
		'$method $path without a session returns 401',
		async ({ method, path, body }) => {
			const response = await app.handle(jsonRequest(method, path, undefined, body));
			expect(response.status).toBe(401);
		},
	);
});

describe('warehouse routes — organization roles are refused', () => {
	for (const user of FORBIDDEN_USERS) {
		test.each(ROUTES)(
			`${user}: $method $path returns 403`,
			async ({ method, path, body }) => {
				const response = await app.handle(jsonRequest(method, path, user, body));
				expect(response.status).toBe(403);
			},
		);
	}

	test('an organization "admin" role is not a platform admin', async () => {
		// The fixture's `admin` holds the ORGANIZATION role `admin`. The gate
		// reads `session.user.role`, which is the platform role — so this must
		// still be refused.
		const response = await app.handle(jsonRequest('GET', '/warehouses', 'admin'));
		expect(response.status).toBe(403);
	});

	test('a member whose organization membership was revoked is still refused', async () => {
		// `getSession` still answers for this user; the mock's revocation only
		// affects `getFullOrganization`, which `sessionGuard` never calls. So
		// the session resolves and the refusal comes from the platform-role
		// check — 403, not 401. Either way the caller gets no data.
		const response = await app.handle(
			jsonRequest('GET', '/warehouses', 'revoked'),
		);
		expect(response.status).toBe(403);
	});
});

describe('warehouse routes — application admin is allowed', () => {
	test.each(ROUTES)(
		'globalAdmin: $method $path is not refused',
		async ({ method, path, body }) => {
			const response = await app.handle(
				jsonRequest(method, path, 'globalAdmin', body),
			);
			expect(response.status).toBeLessThan(400);
		},
	);

	/**
	 * Pins the success envelope for the DELETE routes.
	 *
	 * @remarks
	 * These previously returned `status(204, noContent())` — a genuinely empty
	 * body — while every other mutation returns `200` plus the standard
	 * envelope. The web-admin client calls `response.json()` unconditionally,
	 * so an empty body surfaced as `JSON.parse: unexpected end of data`. The
	 * looser `status < 400` assertion above passed on the 204, which is why the
	 * bug reached a client at all.
	 */
	test.each(ROUTES.filter((route) => route.method === 'DELETE'))(
		'globalAdmin: $method $path returns 200 with a JSON envelope',
		async ({ method, path }) => {
			const response = await app.handle(
				jsonRequest(method, path, 'globalAdmin'),
			);
			expect(response.status).toBe(200);
			const body = (await response.json()) as { data?: unknown };
			expect(body).toHaveProperty('data');
		},
	);

	test('a platform admin who belongs to no organization can list warehouses', async () => {
		// This is why these routes ride `sessionGuard`: no organization context
		// exists for this caller, yet global inventory must still be manageable.
		const response = await app.handle(
			jsonRequest('GET', '/warehouses', 'globalAdmin'),
		);
		expect(response.status).toBe(200);
	});

	test('a platform admin who is also an org owner is allowed', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/warehouses', 'globalAdminOwner'),
		);
		expect(response.status).toBe(200);
	});
});
