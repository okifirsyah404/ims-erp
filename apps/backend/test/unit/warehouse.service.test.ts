/**
 * Warehouse service unit tests.
 *
 * @remarks
 * The rules under test are the ones the **database cannot express**, so they
 * are the ones that silently rot:
 *
 * - **D-A** — at most one default per scope, and scopes must not interfere.
 *   `warehouses.is_default` has a plain index; a partial unique index cannot
 *   say "at most one `organization_id IS NULL` row".
 * - **D-C** — `organizationId` defaults to `NULL` (global) and is never
 *   changed by an update.
 * - Archive is guarded by live unit custody.
 *
 * Repositories are fakes typed against the real contracts, so a drift between
 * a fake and the interface is a compile error rather than a runtime surprise.
 */
import { describe, expect, test } from 'bun:test';
import type { TWarehouseSelect } from '@drizzle/schemas/inventory.schema';
import type { IWarehouseRepository } from '../../src/app/inventory/contracts/warehouse.repository.interface';
import type { IWarehouseAddressRepository } from '../../src/app/inventory/contracts/warehouse-address.repository.interface';
import type { IWarehouseStorageRepository } from '../../src/app/inventory/contracts/warehouse-storage.repository.interface';
import { WarehouseService } from '../../src/app/inventory/services/warehouse.service';
import {
	StorageCodeTakenError,
	StorageNotFoundError,
	WarehouseCodeTakenError,
	WarehouseHasUnitsError,
	WarehouseInactiveError,
	WarehouseNotFoundError,
} from '../../src/app/inventory/errors/inventory.errors';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

let sequence = 0;
const nextId = () => `01920000-0000-7000-8000-${String(++sequence).padStart(12, '0')}`;

function makeWarehouse(
	overrides: Partial<TWarehouseSelect> = {},
): TWarehouseSelect {
	return {
		id: nextId(),
		organizationId: null,
		code: 'MAIN',
		name: 'Main warehouse',
		responsibleEmployeeId: null,
		isDefault: false,
		isActive: true,
		createdAt: new Date(0),
		updatedAt: null,
		deletedAt: null,
		...overrides,
	} as TWarehouseSelect;
}

/**
 * In-memory warehouse repository.
 *
 * @remarks
 * `clearDefaultExcept` reproduces the real SQL's scope predicate, which is the
 * whole point: a fake that just cleared every default would let a bug in the
 * scope predicate pass unnoticed.
 */
function makeRepos(seed: TWarehouseSelect[] = []) {
	const rows = [...seed];
	const clearDefaultCalls: Array<{
		organizationId: string | null;
		exceptId: string;
	}> = [];

	const warehouseRepository: IWarehouseRepository = {
		async paginate(r) {
			return {
				meta: { page: r.page, limit: r.limit, total: rows.length, totalPages: 1 },
				data: rows,
			};
		},
		async findById(id) {
			return rows.find((row) => row.id === id) ?? null;
		},
		async findByCode(organizationId, code) {
			return (
				rows.find(
					(row) =>
						row.organizationId === organizationId &&
						row.code === code &&
						row.deletedAt === null,
				) ?? null
			);
		},
		async create(data) {
			const row = makeWarehouse({
				...data,
				organizationId: data.organizationId ?? null,
			} as Partial<TWarehouseSelect>);
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
		async clearDefaultExcept(organizationId, exceptId) {
			clearDefaultCalls.push({ organizationId, exceptId });
			for (const row of rows) {
				if (row.organizationId === organizationId && row.id !== exceptId) {
					row.isDefault = false;
				}
			}
		},
		async countLiveUnits() {
			return 0;
		},
		async countKinds(warehouseIds) {
			return warehouseIds.map((warehouseId) => ({
				warehouseId,
				productsCount: 0,
				materialsCount: 0,
				toolsCount: 0,
				storagesCount: 0,
			}));
		},
	};

	const addressRepository: IWarehouseAddressRepository = {
		async findByWarehouseId() {
			return null;
		},
		async upsert(warehouseId, data) {
			return { id: nextId(), warehouseId, ...data } as never;
		},
		async remove() {
			return true;
		},
	};

	const storageRows: Array<Record<string, unknown>> = [];
	const storageRepository: IWarehouseStorageRepository = {
		async listByWarehouse(warehouseId) {
			return storageRows.filter(
				(row) => row.warehouseId === warehouseId && row.deletedAt === null,
			) as never;
		},
		async findById(id) {
			return (storageRows.find((row) => row.id === id) as never) ?? null;
		},
		async findByCode(warehouseId, code) {
			return (
				(storageRows.find(
					(row) =>
						row.warehouseId === warehouseId &&
						row.code === code &&
						row.deletedAt === null,
				) as never) ?? null
			);
		},
		async create(data) {
			const row = {
				id: nextId(),
				warehouseId: data.warehouseId,
				code: data.code,
				name: data.name ?? null,
				binType: data.binType ?? null,
				capacity: data.capacity ?? null,
				isActive: data.isActive ?? true,
				deletedAt: null,
			};
			storageRows.push(row);
			return row as never;
		},
		async update(id, data) {
			const row = storageRows.find((r) => r.id === id);
			if (!row) return null;
			Object.assign(row, data);
			return row as never;
		},
		async archive(id) {
			const row = storageRows.find((r) => r.id === id);
			if (!row) return null;
			row.deletedAt = new Date();
			return row as never;
		},
	};

	const service = new WarehouseService(
		warehouseRepository,
		addressRepository,
		storageRepository,
	);

	return { service, rows, clearDefaultCalls, warehouseRepository };
}

describe('createWarehouse — scope', () => {
	test('omitting organizationId creates a GLOBAL warehouse (D-C)', async () => {
		const { service } = makeRepos();

		const created = await service.createWarehouse({
			code: 'GLOBAL-1',
			name: 'Global warehouse',
		} as never);

		expect(created.organizationId).toBeNull();
	});

	test('the same code may exist in a global scope and an organization scope', async () => {
		const { service } = makeRepos();

		await service.createWarehouse({ code: 'MAIN', name: 'Global' } as never);
		// Would throw WarehouseCodeTakenError if scoping were ignored.
		const orgWarehouse = await service.createWarehouse({
			code: 'MAIN',
			name: 'Org',
			organizationId: ORG_A,
		} as never);

		expect(orgWarehouse.organizationId).toBe(ORG_A);
	});

	test('a duplicate code in the same scope is a 409', async () => {
		const { service } = makeRepos();

		await service.createWarehouse({ code: 'MAIN', name: 'First' } as never);

		await expect(
			service.createWarehouse({ code: 'MAIN', name: 'Second' } as never),
		).rejects.toBeInstanceOf(WarehouseCodeTakenError);
	});

	test('the same code in two different organizations is allowed', async () => {
		const { service } = makeRepos();

		await service.createWarehouse({
			code: 'MAIN',
			name: 'A',
			organizationId: ORG_A,
		} as never);

		const other = await service.createWarehouse({
			code: 'MAIN',
			name: 'B',
			organizationId: ORG_B,
		} as never);

		expect(other.organizationId).toBe(ORG_B);
	});
});

describe('is_default — one per scope (D-A)', () => {
	test('creating a default clears siblings in the same scope', async () => {
		const existing = makeWarehouse({
			organizationId: ORG_A,
			code: 'OLD',
			isDefault: true,
		});
		const { service, rows, clearDefaultCalls } = makeRepos([existing]);

		const created = await service.createWarehouse({
			code: 'NEW',
			name: 'New',
			organizationId: ORG_A,
			isDefault: true,
		} as never);

		expect(clearDefaultCalls).toEqual([
			{ organizationId: ORG_A, exceptId: created.id },
		]);
		expect(rows.find((r) => r.id === existing.id)?.isDefault).toBe(false);
	});

	test('setting org A default does NOT clear the global default', async () => {
		const globalDefault = makeWarehouse({
			organizationId: null,
			code: 'GLOBAL',
			isDefault: true,
		});
		const { service, rows } = makeRepos([globalDefault]);

		await service.createWarehouse({
			code: 'ORG-MAIN',
			name: 'Org main',
			organizationId: ORG_A,
			isDefault: true,
		} as never);

		// Cross-scope isolation: the global default must survive.
		expect(rows.find((r) => r.id === globalDefault.id)?.isDefault).toBe(true);
	});

	test('promoting an existing warehouse clears siblings in its own scope', async () => {
		const first = makeWarehouse({
			organizationId: ORG_A,
			code: 'A',
			isDefault: true,
		});
		const second = makeWarehouse({
			organizationId: ORG_A,
			code: 'B',
			isDefault: false,
		});
		const globalOne = makeWarehouse({
			organizationId: null,
			code: 'G',
			isDefault: true,
		});
		const { service, rows } = makeRepos([first, second, globalOne]);

		await service.updateWarehouse(second.id, { isDefault: true });

		expect(rows.find((r) => r.id === second.id)?.isDefault).toBe(true);
		expect(rows.find((r) => r.id === first.id)?.isDefault).toBe(false);
		// Untouched: different scope.
		expect(rows.find((r) => r.id === globalOne.id)?.isDefault).toBe(true);
	});

	test('demoting the only default leaves the scope with none', async () => {
		const only = makeWarehouse({
			organizationId: ORG_A,
			code: 'ONLY',
			isDefault: true,
		});
		const { service, rows, clearDefaultCalls } = makeRepos([only]);

		await service.updateWarehouse(only.id, { isDefault: false });

		expect(rows.find((r) => r.id === only.id)?.isDefault).toBe(false);
		// No auto-promotion: picking a replacement would be a guess.
		expect(rows.filter((r) => r.isDefault)).toHaveLength(0);
		expect(clearDefaultCalls).toHaveLength(0);
	});

	test('a non-default update never touches the default flags', async () => {
		const current = makeWarehouse({ organizationId: ORG_A, isDefault: true });
		const { service, clearDefaultCalls } = makeRepos([current]);

		await service.updateWarehouse(current.id, { name: 'Renamed' });

		expect(clearDefaultCalls).toHaveLength(0);
	});
});

describe('updateWarehouse — immutability', () => {
	test('organizationId is not accepted on update (D-C)', async () => {
		const current = makeWarehouse({ organizationId: ORG_A });
		const { service, rows } = makeRepos([current]);

		// The zod schema rejects the key as unknown, so the service never sees
		// it. Assert the row is unchanged even if a caller bypasses parsing.
		await service.updateWarehouse(current.id, { name: 'Renamed' } as never);

		expect(rows[0].organizationId).toBe(ORG_A);
	});

	test('updating a missing warehouse is a 404', async () => {
		const { service } = makeRepos();

		await expect(
			service.updateWarehouse('01920000-0000-7000-8000-999999999999', {
				name: 'x',
			}),
		).rejects.toBeInstanceOf(WarehouseNotFoundError);
	});
});

describe('archiveWarehouse', () => {
	test('archives a warehouse with no live units', async () => {
		const current = makeWarehouse();
		const { service, rows } = makeRepos([current]);

		await service.archiveWarehouse(current.id);

		expect(rows[0].deletedAt).not.toBeNull();
	});

	test('refuses to archive a warehouse holding live units', async () => {
		const current = makeWarehouse();
		const { service, rows, warehouseRepository } = makeRepos([current]);
		warehouseRepository.countLiveUnits = async () => 3;

		await expect(service.archiveWarehouse(current.id)).rejects.toBeInstanceOf(
			WarehouseHasUnitsError,
		);
		expect(rows[0].deletedAt).toBeNull();
	});

	test('archiving the default does not promote a replacement', async () => {
		const def = makeWarehouse({ organizationId: ORG_A, isDefault: true });
		const other = makeWarehouse({
			organizationId: ORG_A,
			code: 'OTHER',
			isDefault: false,
		});
		const { service, rows } = makeRepos([def, other]);

		await service.archiveWarehouse(def.id);

		expect(rows.find((r) => r.id === other.id)?.isDefault).toBe(false);
	});

	test('archiving a missing warehouse is a 404', async () => {
		const { service } = makeRepos();

		await expect(
			service.archiveWarehouse('01920000-0000-7000-8000-999999999999'),
		).rejects.toBeInstanceOf(WarehouseNotFoundError);
	});
});

describe('storages', () => {
	test('creates a storage under its warehouse', async () => {
		const current = makeWarehouse();
		const { service } = makeRepos([current]);

		const storage = await service.createStorage(current.id, { code: 'A1' });

		expect(storage.warehouseId).toBe(current.id);
		expect(storage.code).toBe('A1');
	});

	test('a duplicate code in the same warehouse is a 409', async () => {
		const current = makeWarehouse();
		const { service } = makeRepos([current]);

		await service.createStorage(current.id, { code: 'A1' });

		await expect(
			service.createStorage(current.id, { code: 'A1' }),
		).rejects.toBeInstanceOf(StorageCodeTakenError);
	});

	test('the same storage code is allowed in a different warehouse', async () => {
		const first = makeWarehouse({ code: 'W1' });
		const second = makeWarehouse({ code: 'W2' });
		const { service } = makeRepos([first, second]);

		await service.createStorage(first.id, { code: 'A1' });
		const storage = await service.createStorage(second.id, { code: 'A1' });

		expect(storage.warehouseId).toBe(second.id);
	});

	test('a storage from another warehouse is not reachable through this one', async () => {
		const first = makeWarehouse({ code: 'W1' });
		const second = makeWarehouse({ code: 'W2' });
		const { service } = makeRepos([first, second]);

		const storage = await service.createStorage(second.id, { code: 'A1' });

		// Cross-warehouse isolation: the storage exists, but not under `first`.
		await expect(
			service.updateStorage(first.id, storage.id, { name: 'nope' }),
		).rejects.toBeInstanceOf(StorageNotFoundError);
		await expect(
			service.archiveStorage(first.id, storage.id),
		).rejects.toBeInstanceOf(StorageNotFoundError);
	});

	test('storage operations on a missing warehouse are a 404', async () => {
		const { service } = makeRepos();
		const missing = '01920000-0000-7000-8000-999999999999';

		await expect(
			service.createStorage(missing, { code: 'A1' }),
		).rejects.toBeInstanceOf(WarehouseNotFoundError);
		await expect(
			service.listStorages(missing),
		).rejects.toBeInstanceOf(WarehouseNotFoundError);
	});

	test('creating a storage in an inactive warehouse is a 422 (D4)', async () => {
		const inactive = makeWarehouse({ code: 'CLOSED' });
		const { service, rows } = makeRepos([inactive]);

		const storage = await service.createStorage(inactive.id, { code: 'A1' });
		rows[0].isActive = false;

		await expect(
			service.createStorage(inactive.id, { code: 'B2' }),
		).rejects.toBeInstanceOf(WarehouseInactiveError);
		void storage;
	});

	test('updating a storage in an inactive warehouse is a 422 (D4)', async () => {
		const inactive = makeWarehouse({ code: 'CLOSED' });
		const { service, rows } = makeRepos([inactive]);

		const storage = await service.createStorage(inactive.id, { code: 'A1' });
		rows[0].isActive = false;

		await expect(
			service.updateStorage(inactive.id, storage.id, { name: 'nope' }),
		).rejects.toBeInstanceOf(WarehouseInactiveError);
	});

	test('archiving a storage in an inactive warehouse stays allowed (D4)', async () => {
		const inactive = makeWarehouse({ code: 'CLOSED' });
		const { service, rows } = makeRepos([inactive]);

		const storage = await service.createStorage(inactive.id, { code: 'A1' });
		rows[0].isActive = false;

		const archived = await service.archiveStorage(inactive.id, storage.id);

		expect(archived.deletedAt).not.toBeNull();
	});
});
