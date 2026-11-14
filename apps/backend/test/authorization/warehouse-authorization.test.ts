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
/** A second warehouse the PIC is *not* assigned to (ADR-0017 404 case). */
const OTHER_WAREHOUSE_ID = '01920000-0000-7000-8000-0000000000dd';

/**
 * Live person-in-charge grants, keyed by user id (ADR-0017).
 *
 * @remarks
 * Stands in for `inventory.warehouse_managers`: the guard only asks "which
 * warehouse ids does this user manage", so the fake is a set. A user absent
 * from the map holds no live grant — the same answer the repository gives when
 * every row is soft-deleted.
 */
const picGrants = new Map<string, string[]>();

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
	// Admin-only surface added with ADR-0017 (person-in-charge assignment).
	{ method: 'GET', path: `/warehouses/${WAREHOUSE_ID}/managers` },
	{ method: 'GET', path: '/warehouses/manager-candidates' },
	{
		method: 'POST',
		path: `/warehouses/${WAREHOUSE_ID}/managers`,
		body: { userId: 'user-warehouse' },
	},
	{
		method: 'DELETE',
		path: `/warehouses/${WAREHOUSE_ID}/managers/user-warehouse`,
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
		async findAlive(ids) {
			if (ids && !ids.includes(seed.id)) return [];
			return [seed];
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
		WAREHOUSE_MANAGER_SERVICE_TOKEN,
	} = await import('../../src/app/inventory/constants/di');
	const { WAREHOUSE_PIC_RESOLVER_TOKEN } = await import(
		'../../src/authorization/warehouse-pic-resolver'
	);
	const { CODE_NUMBER_SERVICE_TOKEN } = await import(
		'../../src/app/code-number/constants/di'
	);
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
	container.register(CODE_NUMBER_SERVICE_TOKEN, {
		useValue: { next: async () => 'WH-00001' } as never,
	});
	container.register(WAREHOUSE_SERVICE_TOKEN, { useClass: WarehouseService });

	// ADR-0017: the guard reads this port (never Drizzle). Live grants come
	// from `picGrants`; an empty/absent entry is "no live assignment".
	container.register(WAREHOUSE_PIC_RESOLVER_TOKEN, {
		useValue: {
			async listWarehouseIdsForUser(userId: string) {
				return picGrants.get(userId) ?? [];
			},
		},
	});
	// Assignment routes stay admin-only; the service is faked here because the
	// authorization wall is what this file proves, not the assignment CRUD.
	container.register(WAREHOUSE_MANAGER_SERVICE_TOKEN, {
		useValue: {
			async listMine(userId: string, isAppAdmin: boolean) {
				const ids = isAppAdmin ? [WAREHOUSE_ID] : (picGrants.get(userId) ?? []);
				return ids.map((id) => ({ ...seed, id, storages: [] }));
			},
			async listManagers(warehouseId: string) {
				return (picGrants.get('member') ?? [])
					.filter((id) => id === warehouseId)
					.map(() => ({
						userId: 'member',
						name: 'Fixture Member',
						email: 'member@test.local',
						assignedBy: null,
						assignedAt: new Date(0),
					}));
			},
			async searchCandidates() {
				return [];
			},
			async assign(warehouseId: string, userId: string) {
				return { warehouseId, userId } as never;
			},
			async unassign() {
				return { removed: true };
			},
		} as never,
	});

	app = new Elysia().use(sessionGuard()).use(WarehouseController.plugin());
});

beforeEach(() => {
	picGrants.clear();
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

describe('warehouse routes — person in charge (ADR-0017)', () => {
	const PIC = 'member';

	test('a PIC of this warehouse can read it', async () => {
		picGrants.set(fixture.users[PIC].id, [WAREHOUSE_ID]);
		const response = await app.handle(
			jsonRequest('GET', `/warehouses/${WAREHOUSE_ID}`, PIC),
		);
		expect(response.status).toBe(200);
	});

	test('a PIC of this warehouse can update it', async () => {
		picGrants.set(fixture.users[PIC].id, [WAREHOUSE_ID]);
		const response = await app.handle(
			jsonRequest('PATCH', `/warehouses/${WAREHOUSE_ID}`, PIC, {
				name: 'Renamed by PIC',
			}),
		);
		expect(response.status).toBe(200);
	});

	test('a PIC of this warehouse can manage its storages', async () => {
		picGrants.set(fixture.users[PIC].id, [WAREHOUSE_ID]);
		const read = await app.handle(
			jsonRequest('GET', `/warehouses/${WAREHOUSE_ID}/storages`, PIC),
		);
		expect(read.status).toBe(200);

		const created = await app.handle(
			jsonRequest('POST', `/warehouses/${WAREHOUSE_ID}/storages`, PIC, {
				code: 'A2',
			}),
		);
		expect(created.status).toBe(201);
	});

	test('a PIC of another warehouse gets 404, not 403 (existence is not leaked)', async () => {
		picGrants.set(fixture.users[PIC].id, [OTHER_WAREHOUSE_ID]);
		const read = await app.handle(
			jsonRequest('GET', `/warehouses/${WAREHOUSE_ID}`, PIC),
		);
		expect(read.status).toBe(404);

		const update = await app.handle(
			jsonRequest('PATCH', `/warehouses/${WAREHOUSE_ID}`, PIC, {
				name: 'Nope',
			}),
		);
		expect(update.status).toBe(404);
	});

	test('a user with no live grant gets 403, not 404', async () => {
		// Empty grant list = every assignment row is soft-deleted (or none ever
		// existed). The guard cannot tell the warehouse apart from one that does
		// not exist, so it must refuse without confirming anything.
		const response = await app.handle(
			jsonRequest('GET', `/warehouses/${WAREHOUSE_ID}`, PIC),
		);
		expect(response.status).toBe(403);
	});

	test('a soft-deleted grant grants nothing', async () => {
		// The resolver only reports live rows; clearing the map is the same
		// answer the repository gives after `unassign`.
		picGrants.set(fixture.users[PIC].id, [WAREHOUSE_ID]);
		picGrants.delete(fixture.users[PIC].id);
		const response = await app.handle(
			jsonRequest('GET', `/warehouses/${WAREHOUSE_ID}`, PIC),
		);
		expect(response.status).toBe(403);
	});

	test('a PIC cannot create a warehouse', async () => {
		picGrants.set(fixture.users[PIC].id, [WAREHOUSE_ID]);
		const response = await app.handle(
			jsonRequest('POST', '/warehouses', PIC, {
				code: 'NEW',
				name: 'New warehouse',
			}),
		);
		expect(response.status).toBe(403);
	});

	test('a PIC cannot assign another person in charge', async () => {
		picGrants.set(fixture.users[PIC].id, [WAREHOUSE_ID]);
		const response = await app.handle(
			jsonRequest('POST', `/warehouses/${WAREHOUSE_ID}/managers`, PIC, {
				userId: 'user-sales',
			}),
		);
		expect(response.status).toBe(403);
	});
});

describe('GET /warehouses/mine (ADR-0017)', () => {
	const PIC = 'member';

	test('without a session returns 401', async () => {
		const response = await app.handle(jsonRequest('GET', '/warehouses/mine'));
		expect(response.status).toBe(401);
	});

	test('a PIC sees only the warehouses they manage', async () => {
		picGrants.set(fixture.users[PIC].id, [WAREHOUSE_ID]);
		const response = await app.handle(
			jsonRequest('GET', '/warehouses/mine', PIC),
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			data: Array<{ id: string; storages: unknown[] }>;
		};
		expect(body.data.map((row) => row.id)).toEqual([WAREHOUSE_ID]);
		expect(body.data[0]).toHaveProperty('storages');
	});

	test('a user with no grant gets an empty list, not 403', async () => {
		// "Which warehouses may I see" has a valid answer for every session:
		// none. 403 would make the sidebar unable to distinguish "no access"
		// from "not signed in".
		const response = await app.handle(
			jsonRequest('GET', '/warehouses/mine', PIC),
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { data: unknown[] };
		expect(body.data).toEqual([]);
	});

	test('an application admin sees every live warehouse', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/warehouses/mine', 'globalAdmin'),
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { data: Array<{ id: string }> };
		expect(body.data.map((row) => row.id)).toEqual([WAREHOUSE_ID]);
	});
});
