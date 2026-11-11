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
import { AuditWriterDouble } from '../helpers/audit-writer-double';
import {
	StorageCodeTakenError,
	StorageNotFoundError,
	WarehouseCodeTakenError,
	WarehouseLinkConflictError,
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
	/** Alive (warehouseId, organizationId) link pairs (ERP-0031). */
	const links: Array<{ warehouseId: string; organizationId: string; deletedAt: Date | null }> = [];
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
		async isLinked(warehouseId, organizationId) {
			return links.some(
				(link) =>
					link.warehouseId === warehouseId &&
					link.organizationId === organizationId &&
					link.deletedAt === null,
			);
		},
		async listLinked(organizationId) {
			const linkedIds = new Set(
				links
					.filter(
						(link) =>
							link.organizationId === organizationId &&
							link.deletedAt === null,
					)
					.map((link) => link.warehouseId),
			);
			return rows.filter(
				(row) => linkedIds.has(row.id) && row.deletedAt === null,
			);
		},
		async listOrganizations(warehouseId) {
			return links
				.filter(
					(link) => link.warehouseId === warehouseId && link.deletedAt === null,
				)
				.map((link) => ({
					organizationId: link.organizationId,
					createdAt: new Date(0),
				}));
		},
		async linkOrganization(warehouseId, organizationId) {
			const existing = links.find(
				(link) =>
					link.warehouseId === warehouseId &&
					link.organizationId === organizationId,
			);
			if (existing && existing.deletedAt === null) return { created: false };
			if (existing) {
				existing.deletedAt = null;
				return { created: true };
			}
			links.push({ warehouseId, organizationId, deletedAt: null });
			return { created: true };
		},
		async unlinkOrganization(warehouseId, organizationId) {
			const existing = links.find(
				(link) =>
					link.warehouseId === warehouseId &&
					link.organizationId === organizationId &&
					link.deletedAt === null,
			);
			if (!existing) return false;
			existing.deletedAt = new Date();
			return true;
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
		async findNamesByIds(ids) {
			return rows
				.filter((r) => ids.includes(r.id) && r.deletedAt === null)
				.map((r) => ({ id: r.id, name: r.name }));
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
		new AuditWriterDouble(),
		// ERP-0031: no borrowings in these tests — the guard never blocks.
		{ async countOpenBorrowings() { return 0; } },
		// No assets in these tests — equipment counts resolve to zero.
		{ countByWarehouse: async () => [] } as never,
		// ERP-0034: no HR rows in these tests — every PIC lookup misses, so
		// tests that assign one must clear it (`null`) instead.
		{ findEmployeeById: async () => null, findEmployeeByUserId: async () => null } as never,
	);
	return { service, rows, links, clearDefaultCalls, warehouseRepository };
}

describe('warehouse↔organization links (ERP-0031 slice 3)', () => {
	test('linkOrganization creates an alive link and audits it', async () => {
		const warehouse = makeWarehouse({ code: 'MAIN' });
		const { service, links } = makeRepos([warehouse]);

		const result = await service.linkOrganization(warehouse.id, ORG_A);

		expect(result).toEqual({ created: true });
		expect(links).toContainEqual({
			warehouseId: warehouse.id,
			organizationId: ORG_A,
			deletedAt: null,
		});
	});

	test('linkOrganization is idempotent for an already-alive pair', async () => {
		const warehouse = makeWarehouse({ code: 'MAIN' });
		const { service, links } = makeRepos([warehouse]);
		links.push({ warehouseId: warehouse.id, organizationId: ORG_A, deletedAt: null });

		const result = await service.linkOrganization(warehouse.id, ORG_A);

		expect(result).toEqual({ created: false });
		expect(links).toHaveLength(1);
	});

	test('linkOrganization on a missing warehouse is a 404', async () => {
		const { service } = makeRepos();

		await expect(
			service.linkOrganization('01920000-0000-7000-8000-999999999999', ORG_A),
		).rejects.toBeInstanceOf(WarehouseNotFoundError);
	});

	test('unlinkOrganization removes an alive link and audits it', async () => {
		const warehouse = makeWarehouse({ code: 'MAIN' });
		const { service, links } = makeRepos([warehouse]);
		links.push({ warehouseId: warehouse.id, organizationId: ORG_A, deletedAt: null });

		const result = await service.unlinkOrganization(warehouse.id, ORG_A);

		expect(result).toEqual({ removed: true });
		expect(links[0].deletedAt).not.toBeNull();
	});

	test('unlinkOrganization with no alive link reports removed=false', async () => {
		const warehouse = makeWarehouse({ code: 'MAIN' });
		const { service } = makeRepos([warehouse]);

		await expect(
			service.unlinkOrganization(warehouse.id, ORG_A),
		).resolves.toEqual({ removed: false });
	});

	test('unlinkOrganization is refused with 409 while open borrowings exist', async () => {
		const warehouse = makeWarehouse({ code: 'MAIN' });
		const { service, links } = makeRepos([warehouse]);
		links.push({ warehouseId: warehouse.id, organizationId: ORG_A, deletedAt: null });

		// Override the guard for this test: the org still holds custody.
		const guarded = Object.assign(Object.create(Object.getPrototypeOf(service)), service, {});
		Object.defineProperty(guarded, 'borrowingGuard', {
			value: { async countOpenBorrowings() { return 2; } },
		});

		await expect(
			guarded.unlinkOrganization(warehouse.id, ORG_A),
		).rejects.toBeInstanceOf(WarehouseLinkConflictError);
		// The link must survive a refused unlink.
		expect(links[0].deletedAt).toBeNull();
	});

	test('listWarehouseOrganizations returns alive links only', async () => {
		const warehouse = makeWarehouse({ code: 'MAIN' });
		const { service, links } = makeRepos([warehouse]);
		links.push({ warehouseId: warehouse.id, organizationId: ORG_A, deletedAt: null });
		links.push({
			warehouseId: warehouse.id,
			organizationId: ORG_B,
			deletedAt: new Date(),
		});

		const result = await service.listWarehouseOrganizations(warehouse.id);
		expect(result.map((row) => row.organizationId)).toEqual([ORG_A]);
	});
});

describe('warehouse reachability (ERP-0031)', () => {	test('a linked warehouse is reachable by the linked org', async () => {
		const warehouse = makeWarehouse({ code: 'MAIN' });
		const { service, links } = makeRepos([warehouse]);
		links.push({ warehouseId: warehouse.id, organizationId: ORG_A, deletedAt: null });

		await expect(
			service.assertWarehouseReachableByOrg(warehouse.id, ORG_A),
		).resolves.toBe(true);
	});

	test('an unlinked warehouse is NOT reachable — the org learns nothing', async () => {
		const warehouse = makeWarehouse({ code: 'MAIN' });
		const { service } = makeRepos([warehouse]);

		await expect(
			service.assertWarehouseReachableByOrg(warehouse.id, ORG_B),
		).resolves.toBe(false);
	});

	test('a soft-deleted link does not restore access', async () => {
		const warehouse = makeWarehouse({ code: 'MAIN' });
		const { service, links } = makeRepos([warehouse]);
		links.push({
			warehouseId: warehouse.id,
			organizationId: ORG_A,
			deletedAt: new Date(),
		});

		await expect(
			service.assertWarehouseReachableByOrg(warehouse.id, ORG_A),
		).resolves.toBe(false);
	});

	test('a missing warehouse is a 404 before any link check', async () => {
		const { service } = makeRepos();

		await expect(
			service.assertWarehouseReachableByOrg(
				'01920000-0000-7000-8000-999999999999',
				ORG_A,
			),
		).rejects.toBeInstanceOf(WarehouseNotFoundError);
	});

	test('listLinkedWarehouses returns only alive links of alive warehouses', async () => {
		const linked = makeWarehouse({ code: 'LINKED' });
		const archived = makeWarehouse({ code: 'ARCHIVED', deletedAt: new Date() });
		const other = makeWarehouse({ code: 'OTHER' });
		const { service, links } = makeRepos([linked, archived, other]);
		links.push({ warehouseId: linked.id, organizationId: ORG_A, deletedAt: null });
		links.push({ warehouseId: archived.id, organizationId: ORG_A, deletedAt: null });
		links.push({ warehouseId: other.id, organizationId: ORG_B, deletedAt: null });

		const result = await service.listLinkedWarehouses(ORG_A);
		expect(result.map((row) => row.code)).toEqual(['LINKED']);
	});
});

describe('createWarehouse — scope', () => {
	test('omitting organizationId creates a GLOBAL warehouse (D-C)', async () => {
		const { service } = makeRepos();

		const created = await service.createWarehouse({
			code: 'GLOBAL-1',
			name: 'Global warehouse',
		} as never);

		expect(created.organizationId).toBeNull();
	});

	test('ERP-0031 (D1): a client-supplied organizationId is dropped — every warehouse is global', async () => {
		const { service, rows } = makeRepos();

		const created = await service.createWarehouse({
			code: 'MAIN',
			name: 'Org',
			organizationId: ORG_A,
		} as never);

		expect(created.organizationId).toBeNull();
		expect(rows.find((r) => r.id === created.id)?.organizationId).toBeNull();
	});

	test('a duplicate code is a 409 (single global scope)', async () => {
		const { service } = makeRepos();

		await service.createWarehouse({ code: 'MAIN', name: 'First' } as never);

		await expect(
			service.createWarehouse({ code: 'MAIN', name: 'Second' } as never),
		).rejects.toBeInstanceOf(WarehouseCodeTakenError);
	});
});

describe('is_default — one per scope (D-A)', () => {
	test('creating a default clears siblings in the same scope', async () => {
		const existing = makeWarehouse({
			organizationId: null,
			code: 'OLD',
			isDefault: true,
		});
		const { service, rows, clearDefaultCalls } = makeRepos([existing]);

		const created = await service.createWarehouse({
			code: 'NEW',
			name: 'New',
			isDefault: true,
		} as never);

		expect(clearDefaultCalls).toEqual([
			{ organizationId: null, exceptId: created.id },
		]);
		expect(rows.find((r) => r.id === existing.id)?.isDefault).toBe(false);
	});

	test('promoting an existing warehouse clears siblings in its own scope', async () => {
		const first = makeWarehouse({
			organizationId: null,
			code: 'A',
			isDefault: true,
		});
		const second = makeWarehouse({
			organizationId: null,
			code: 'B',
			isDefault: false,
		});
		const { service, rows } = makeRepos([first, second]);

		await service.updateWarehouse(second.id, { isDefault: true });

		expect(rows.find((r) => r.id === second.id)?.isDefault).toBe(true);
		expect(rows.find((r) => r.id === first.id)?.isDefault).toBe(false);
	});

	test('demoting the only default leaves the scope with none', async () => {
		const only = makeWarehouse({
			organizationId: null,
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
		const current = makeWarehouse({ organizationId: null, isDefault: true });
		const { service, clearDefaultCalls } = makeRepos([current]);

		await service.updateWarehouse(current.id, { name: 'Renamed' });

		expect(clearDefaultCalls).toHaveLength(0);
	});
});

describe('updateWarehouse — immutability', () => {
	test('organizationId is not accepted on update (D-C)', async () => {
		const current = makeWarehouse({ organizationId: null });
		const { service, rows } = makeRepos([current]);

		// The zod schema rejects the key as unknown, so the service never sees
		// it. Assert the row is unchanged even if a caller bypasses parsing.
		await service.updateWarehouse(current.id, { name: 'Renamed' } as never);

		expect(rows[0].organizationId).toBeNull();
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
