/**
 * Person-in-charge service unit tests (ADR-0017).
 *
 * @remarks
 * The three rules the table cannot express are the ones under test:
 *
 * - the target user must exist (`user_id` has no FK across modules);
 * - a duplicate live assignment is a 409, not a silent no-op;
 * - unassign is idempotent and only audited when a row actually changed.
 *
 * Fakes are typed against the real contracts so drift is a compile error.
 */
import { describe, expect, test } from 'bun:test';
import type {
	TWarehouseManagerSelect,
	TWarehouseSelect,
} from '@drizzle/schemas/inventory.schema';
import type { IWarehouseManagerRepository } from '../../src/app/inventory/contracts/warehouse-manager.repository.interface';
import type { IWarehouseRepository } from '../../src/app/inventory/contracts/warehouse.repository.interface';
import type { IWarehouseStorageRepository } from '../../src/app/inventory/contracts/warehouse-storage.repository.interface';
import { WarehouseManagerService } from '../../src/app/inventory/services/warehouse-manager.service';
import {
	WarehouseManagerExistsError,
	WarehouseManagerUserNotFoundError,
	WarehouseNotFoundError,
} from '../../src/app/inventory/errors/inventory.errors';
import { AuditWriterDouble } from '../helpers/audit-writer-double';

const WAREHOUSE = {
	id: '01920000-0000-7000-8000-0000000000aa',
	organizationId: null,
	code: 'MAIN',
	name: 'Main warehouse',
	responsibleEmployeeId: null,
	isDefault: false,
	isActive: true,
	createdAt: new Date(0),
	updatedAt: null,
	deletedAt: null,
} as TWarehouseSelect;

const USER_ID = 'user-pic';

function makeService(options: {
	/** Live grants, `warehouseId:userId` keys. */
	grants?: Set<string>;
	/** Users the identity facade answers for. */
	users?: string[];
	/** Warehouses that exist. */
	warehouses?: TWarehouseSelect[];
}) {
	const grants = options.grants ?? new Set<string>();
	const warehouses = options.warehouses ?? [WAREHOUSE];
	const users = new Set(options.users ?? [USER_ID]);
	const audit = new AuditWriterDouble();

	const managerRepository: IWarehouseManagerRepository = {
		async listWarehouseIdsForUser(userId) {
			return [...grants]
				.filter((key) => key.endsWith(`:${userId}`))
				.map((key) => key.split(':')[0]!);
		},
		async findActive(warehouseId, userId) {
			return grants.has(`${warehouseId}:${userId}`)
				? ({ warehouseId, userId } as TWarehouseManagerSelect)
				: null;
		},
		async listByWarehouse(warehouseId) {
			return [...grants]
				.filter((key) => key.startsWith(`${warehouseId}:`))
				.map(
					(key) =>
						({
							warehouseId,
							userId: key.split(':')[1]!,
							assignedBy: null,
							createdAt: new Date(0),
						}) as TWarehouseManagerSelect,
				);
		},
		async assign(input) {
			grants.add(`${input.warehouseId}:${input.userId}`);
			return { ...input, id: 'assignment' } as never;
		},
		async unassign(warehouseId, userId) {
			return grants.delete(`${warehouseId}:${userId}`);
		},
	};

	const warehouseRepository = {
		async findById(id: string) {
			return warehouses.find((row) => row.id === id) ?? null;
		},
		async findAlive(ids?: readonly string[]) {
			return ids ? warehouses.filter((row) => ids.includes(row.id)) : warehouses;
		},
	} as IWarehouseRepository;

	const storageRepository = {
		async listByWarehouse() {
			return [];
		},
	} as unknown as IWarehouseStorageRepository;

	const service = new WarehouseManagerService(
		managerRepository,
		warehouseRepository,
		storageRepository,
		{
			async getUser(id: string) {
				return users.has(id) ? ({ id, name: id, email: `${id}@test.local` } as never) : null;
			},
			async paginateUsers(request: { search?: string; limit: number }) {
				const rows = [...users]
					.filter((id) => !request.search || id.includes(request.search))
					.slice(0, request.limit)
					.map((id) => ({ id, name: id, email: `${id}@test.local` }));
				return {
					data: rows,
					meta: { page: 1, limit: request.limit, total: rows.length, totalPages: 1 },
				} as never;
			},
		},
		audit,
	);

	return { service, grants, audit };
}

describe('WarehouseManagerService.assign', () => {
	test('grants access and audits the assignment', async () => {
		const { service, grants, audit } = makeService({});
		await service.assign(WAREHOUSE.id, USER_ID, {
			userId: 'admin-1',
			ip: null,
			userAgent: null,
		});
		expect(grants.has(`${WAREHOUSE.id}:${USER_ID}`)).toBe(true);
		expect(audit.forAction('warehouse.manager_assigned')).toHaveLength(1);
	});

	test('rejects an archived/unknown warehouse with 404', async () => {
		const { service } = makeService({ warehouses: [] });
		await expect(
			service.assign(WAREHOUSE.id, USER_ID),
		).rejects.toBeInstanceOf(WarehouseNotFoundError);
	});

	test('rejects a user that does not exist (logical reference)', async () => {
		const { service } = makeService({ users: [] });
		await expect(
			service.assign(WAREHOUSE.id, USER_ID),
		).rejects.toBeInstanceOf(WarehouseManagerUserNotFoundError);
	});

	test('a duplicate live assignment is a 409, not a no-op', async () => {
		const { service } = makeService({
			grants: new Set([`${WAREHOUSE.id}:${USER_ID}`]),
		});
		await expect(
			service.assign(WAREHOUSE.id, USER_ID),
		).rejects.toBeInstanceOf(WarehouseManagerExistsError);
	});
});

describe('WarehouseManagerService.unassign', () => {
	test('removes the live grant and audits it', async () => {
		const { service, grants, audit } = makeService({
			grants: new Set([`${WAREHOUSE.id}:${USER_ID}`]),
		});
		const result = await service.unassign(WAREHOUSE.id, USER_ID);
		expect(result).toEqual({ removed: true });
		expect(grants.size).toBe(0);
		expect(audit.forAction('warehouse.manager_removed')).toHaveLength(1);
	});

	test('is idempotent: no row means removed:false and no audit noise', async () => {
		const { service, audit } = makeService({});
		const result = await service.unassign(WAREHOUSE.id, USER_ID);
		expect(result).toEqual({ removed: false });
		expect(audit.forAction('warehouse.manager_removed')).toHaveLength(0);
	});
});

describe('WarehouseManagerService.listMine', () => {
	test('a PIC gets only the warehouses they manage, with bins', async () => {
		const { service } = makeService({
			grants: new Set([`${WAREHOUSE.id}:${USER_ID}`]),
		});
		const rows = await service.listMine(USER_ID, false);
		expect(rows.map((row) => row.id)).toEqual([WAREHOUSE.id]);
		expect(rows[0]).toHaveProperty('storages');
	});

	test('an application admin gets every live warehouse', async () => {
		const { service } = makeService({});
		const rows = await service.listMine(USER_ID, true);
		expect(rows.map((row) => row.id)).toEqual([WAREHOUSE.id]);
	});

	test('no grant yields an empty list, not an error', async () => {
		const { service } = makeService({});
		expect(await service.listMine(USER_ID, false)).toEqual([]);
	});
});

describe('WarehouseManagerService.listManagers', () => {
	test('decorates live grants with the account name and email', async () => {
		const { service } = makeService({
			grants: new Set([`${WAREHOUSE.id}:${USER_ID}`]),
		});
		const rows = await service.listManagers(WAREHOUSE.id);
		expect(rows).toEqual([
			{
				userId: USER_ID,
				name: USER_ID,
				email: `${USER_ID}@test.local`,
				assignedBy: null,
				assignedAt: new Date(0),
			},
		]);
	});

	test('keeps a grant whose account is gone, with null name/email', async () => {
		const { service } = makeService({
			grants: new Set([`${WAREHOUSE.id}:${USER_ID}`]),
			users: [],
		});
		const rows = await service.listManagers(WAREHOUSE.id);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ userId: USER_ID, name: null, email: null });
	});

	test('rejects an unknown warehouse with 404', async () => {
		const { service } = makeService({ warehouses: [] });
		await expect(service.listManagers(WAREHOUSE.id)).rejects.toBeInstanceOf(
			WarehouseNotFoundError,
		);
	});
});

describe('WarehouseManagerService.searchCandidates', () => {
	test('filters by term and maps to id/name/email', async () => {
		const { service } = makeService({ users: ['user-anna', 'user-budi'] });
		const rows = await service.searchCandidates('anna');
		expect(rows).toEqual([
			{ id: 'user-anna', name: 'user-anna', email: 'user-anna@test.local' },
		]);
	});
});
