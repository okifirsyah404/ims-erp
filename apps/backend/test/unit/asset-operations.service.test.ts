/**
 * Asset operations service tests (Phase A-3).
 *
 * The rules worth testing are the ones no table can express:
 *
 * 1. **Custody guards (D12)** — blocked statuses, one open assignment,
 *    condition-in mandatory on return.
 * 2. **Return is an atomic claim** (the Phase I-4 lesson) — a failing
 *    transaction rolls the claim back; a second return is refused.
 * 3. **Depreciation (D14)** — idempotent per (asset, period), capped at
 *    book value, entry + asset valuation update in ONE transaction.
 * 4. **Disposal execution (D21)** — claim + asset flip + soft delete share
 *    one transaction; the disposal record persists as financial proof.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { container } from 'tsyringe';
import { createNumberingDouble } from '../helpers/numbering-double';
import { AuditWriterDouble } from '../helpers/audit-writer-double';
import type {
	TAssetDisposalSelect,
	TAssetSelect,
	TToolSetItemSelect,
	TToolSetSelect,
} from '@drizzle/schemas/asset.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { TTx } from '@drizzle/types';
import type {
	IAssetRepository,
} from '../../src/app/assets/contracts/asset.repository.interface';
import type {
	IAssetOperationsRepository,
} from '../../src/app/assets/contracts/asset-operations.repository.interface';
import type { WarehouseService } from '../../src/app/inventory/services/warehouse.service';
import {
	ASSET_OPERATIONS_REPOSITORY_TOKEN,
	ASSET_OPERATIONS_SERVICE_TOKEN,
	ASSET_REPOSITORY_TOKEN,
} from '../../src/app/assets/constants/di';
import { AssetOperationsService } from '../../src/app/assets/services/asset-operations.service';
import {
	AssetNotFoundError,
	AssetRuleViolationError,
	AssetTransitionError,
} from '../../src/app/assets/errors/asset.errors';
import { DOCUMENT_NUMBERING_SERVICE_TOKEN } from '../../src/app/organization/constants/di';

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const ASSET_ID = '01920000-0000-7000-8000-0000000000a1';
const WAREHOUSE = '01920000-0000-7000-8000-0000000000b1';
const STORAGE = '01920000-0000-7000-8000-0000000000b2';
const OTHER_WAREHOUSE = '01920000-0000-7000-8000-0000000000b3';
const USER = 'user-1';

const actor = { userId: USER, email: 'u@x.io' };

type AssetRow = TAssetSelect;
type DisposalRow = TAssetDisposalSelect;

/** Builds a fresh in-memory world for the operations service. */
function buildWorld() {
	const assets: AssetRow[] = [];
	const disposals: DisposalRow[] = [];
	const depreciations: Array<Record<string, unknown>> = [];
	const movements: Array<Record<string, unknown>> = [];
	const checks: Array<Record<string, unknown>> = [];
	const maintenances: Array<Record<string, unknown>> = [];
	const documents: Array<Record<string, unknown>> = [];
	const toolSets: Array<Record<string, unknown>> = [];
	const toolSetItems: Array<Record<string, unknown>> = [];
	/** Feeds for the custody reads; empty means "not borrowed, not serviced". */
	const openLines = new Map<string, { issuedAt: Date | null }>();
	const openMaintenances = new Set<string>();

	let idSeq = 0;
	const nextId = () => `id-${++idSeq}`;

	const makeAsset = (overrides: Partial<AssetRow> = {}): AssetRow =>
		({
			id: ASSET_ID,
			organizationId: ORG_A,
			code: 'AST-REG-000001',
			name: 'Laptop',
			assetType: 'it',
			status: 'ready',
			condition: 'good',
			acquisitionCost: 10_000_000,
			salvageValue: 0,
			accumulatedDepreciation: 0,
			bookValue: 10_000_000,
			currencyCode: 'IDR',
			depreciationMethod: 'straight_line',
			borrowedSince: null,
			deactivationReason: null,
			warehouseId: null,
			storageId: null,
			locationDescription: null,
			createdAt: new Date(),
			updatedAt: null,
			deletedAt: null,
			...overrides,
		}) as AssetRow;

	/** Snapshot/restore transaction emulation (real rollback semantics). */
	const database = {
		transaction: async (callback: (tx: 'TX') => unknown) => {
			const assetSnap = assets.map((row) => ({ ...row }));
			const disposalSnap = disposals.map((row) => ({ ...row }));
			const depSnap = [...depreciations];
			try {
				return await callback('TX' as never);
			} catch (error) {
				assets.splice(0, assets.length, ...assetSnap);
				disposals.splice(0, disposals.length, ...disposalSnap);
				depreciations.splice(0, depreciations.length, ...depSnap);
				throw error;
			}
		},
	} as never;

	const assetRepository: IAssetRepository = {
		async countByWarehouse() {
			return [];
		},
		async paginate() {
			return {
				meta: { page: 1, limit: 20, total: assets.length, totalPages: 1 },
				data: assets,
			} as TPaginationResult<AssetRow>;
		},
		async findById(id) {
			return assets.find((r) => r.id === id && r.deletedAt === null) ?? null;
		},
		async findByCode(_org, code) {
			return (
				assets.find(
					(r) => r.code === code && r.deletedAt === null,
				) ?? null
			);
		},
		async create(data) {
			const row = { ...makeAsset(), ...data } as AssetRow;
			assets.push(row);
			return row;
		},
		async update(id, data) {
			const row = assets.find((r) => r.id === id);
			if (!row || row.deletedAt !== null) return null;
			Object.assign(row, data);
			return row;
		},
		async archive(id) {
			const row = assets.find((r) => r.id === id);
			if (!row || row.deletedAt !== null) return null;
			row.deletedAt = new Date();
			return row;
		},
		async countReferences() {
			return { borrowings: 0, maintenances: 0 };
		},
		async listTypes() {
			return [];
		},
	};

	const operations: IAssetOperationsRepository = {
		async findOpenBorrowingLine(assetId) {
			return openLines.get(assetId) ?? null;
		},
		async hasOpenMaintenance(assetId) {
			return openMaintenances.has(assetId);
		},
		async createMovement(data) {
			const row = { id: nextId(), ...data };
			movements.push(row);
			return row as never;
		},
		async listMovements() {
			return {
				meta: { page: 1, limit: 20, total: movements.length, totalPages: 1 },
				data: movements,
			} as never;
		},
		async createConditionCheck(data) {
			const row = { id: nextId(), ...data };
			checks.push(row);
			return row as never;
		},
		async listConditionChecks() {
			return {
				meta: { page: 1, limit: 20, total: checks.length, totalPages: 1 },
				data: checks,
			} as never;
		},
		async createMaintenance(data) {
			const row = { id: nextId(), ...data };
			maintenances.push(row);
			return row as never;
		},
		async listMaintenances() {
			return {
				meta: {
					page: 1,
					limit: 20,
					total: maintenances.length,
					totalPages: 1,
				},
				data: maintenances,
			} as never;
		},
		async findDepreciationPeriod(assetId, year, month) {
			return (
				(depreciations.find(
					(r) =>
						r.assetId === assetId &&
						r.periodYear === year &&
						r.periodMonth === month,
				) as never) ?? null
			);
		},
		async createDepreciation(data) {
			const row = { id: nextId(), ...data };
			depreciations.push(row);
			return row as never;
		},
		async listDepreciations() {
			return {
				meta: {
					page: 1,
					limit: 20,
					total: depreciations.length,
					totalPages: 1,
				},
				data: depreciations,
			} as never;
		},
		async createDisposal(data) {
			const row = {
				id: nextId(),
				bookValueAtDisposal: 0,
				gainLoss: 0,
				approvedBy: null,
				approvedAt: null,
				executedAt: null,
				deletedAt: null,
				updatedAt: null,
				...data,
			} as DisposalRow;
			disposals.push(row);
			return row;
		},
		async findDisposalById(id) {
			return disposals.find((r) => r.id === id) ?? null;
		},
		async listDisposals() {
			return {
				meta: {
					page: 1,
					limit: 20,
					total: disposals.length,
					totalPages: 1,
				},
				data: disposals,
			};
		},
		async updateDisposal(id, data) {
			const row = disposals.find((r) => r.id === id);
			if (!row) return null;
			Object.assign(row, data);
			return row;
		},
		async claimForExecution(id, _tx: TTx) {
			const row = disposals.find(
				(r) =>
					r.id === id && r.status === 'approved' && r.executedAt === null,
			);
			if (!row) return null;
			row.status = 'executed';
			row.executedAt = new Date();
			return row;
		},
		async createDocument(data) {
			const row = { id: nextId(), ...data };
			documents.push(row);
			return row as never;
		},
		async listDocuments() {
			return documents as never;
		},
		async createToolSet(data) {
			const row = { id: nextId(), ...data };
			toolSets.push(row);
			return row as never;
		},
		async findToolSetById(id) {
			return (toolSets.find((r) => r.id === id) as never) ?? null;
		},
		async listToolSets() {
			return {
				meta: { page: 1, limit: 20, total: toolSets.length, totalPages: 1 },
				data: toolSets,
			} as never;
		},
		async updateToolSet(id, data) {
			const row = toolSets.find((r) => r.id === id) as never;
			if (!row) return null;
			Object.assign(row, data);
			return row;
		},
		async archiveToolSet(id) {
			const row = toolSets.find(
				(r) => r.id === id,
			) as TToolSetSelect | undefined;
			if (!row) return null;
			row.deletedAt = new Date();
			return row;
		},
		async listToolSetItems(toolSetId) {
			const rows = toolSetItems.filter(
				(r: Record<string, unknown>) =>
					r.toolSetId === toolSetId && r.deletedAt === undefined,
			);
			return rows as TToolSetItemSelect[];
		},
		async addToolSetItem(data) {
			const row = { id: nextId(), ...data };
			toolSetItems.push(row);
			return row as never;
		},
		async removeToolSetItem(toolSetId, itemId) {
			const row = toolSetItems.find(
				(r) => r.id === itemId && r.toolSetId === toolSetId,
			);
			if (!row) return false;
			row.deletedAt = new Date();
			return true;
		},
	};

	const audit = new AuditWriterDouble();
	const numbering = createNumberingDouble();
	const warehouses = {
		assertWarehouseReachableByOrg: async () => true,
		assertStorageInWarehouse: async () => undefined,
	} as unknown as WarehouseService;

	container.register(ASSET_REPOSITORY_TOKEN, { useValue: assetRepository });
	container.register(ASSET_OPERATIONS_REPOSITORY_TOKEN, {
		useValue: operations,
	});
	container.register(DOCUMENT_NUMBERING_SERVICE_TOKEN, {
		useValue: numbering,
	});
	container.register(ASSET_OPERATIONS_SERVICE_TOKEN, {
		useValue: new AssetOperationsService(
			assetRepository,
			operations,
			numbering,
			audit,
			warehouses,
			database,
		),
	});
	const service = container.resolve<AssetOperationsService>(
		ASSET_OPERATIONS_SERVICE_TOKEN,
	);

	return {
		service,
		audit,
		assets,
		disposals,
		depreciations,
		movements,
		checks,
		openLines,
		openMaintenances,
		makeAsset,
		database,
	};
}

let world: ReturnType<typeof buildWorld>;

beforeEach(() => {
	world = buildWorld();
});

describe('asset operations — custody & location (D7/D8)', () => {
	test('reconcile derives borrowed from an open borrowing line', async () => {
		world.assets.push(world.makeAsset({ status: 'ready' }));
		world.openLines.set(ASSET_ID, { issuedAt: new Date('2026-06-01') });
		await world.service.reconcileStatus(ASSET_ID);
		expect(world.assets[0].status).toBe('borrowed');
	});

	test('reconcile derives maintenance when nothing is out but service is open', async () => {
		world.assets.push(world.makeAsset({ status: 'borrowed' }));
		world.openMaintenances.add(ASSET_ID);
		await world.service.reconcileStatus(ASSET_ID);
		expect(world.assets[0].status).toBe('maintenance');
	});

	test('reconcile returns a parked or terminal asset unchanged', async () => {
		for (const status of ['inactive', 'disposed', 'lost']) {
			const fresh = buildWorld();
			fresh.assets.push(fresh.makeAsset({ status }));
			fresh.openLines.set(ASSET_ID, { issuedAt: new Date() });
			await fresh.service.reconcileStatus(ASSET_ID);
			expect(fresh.assets[0].status).toBe(status);
		}
	});

	test('syncCustody writes borrowed_since from the open line, then clears it', async () => {
		world.assets.push(world.makeAsset({ status: 'borrowed' }));
		const issuedAt = new Date('2026-06-01T08:00:00.000Z');
		world.openLines.set(ASSET_ID, { issuedAt });
		await world.service.syncCustody(ASSET_ID);
		expect(world.assets[0].borrowedSince).toEqual(issuedAt);

		world.openLines.delete(ASSET_ID);
		await world.service.syncCustody(ASSET_ID);
		expect(world.assets[0].borrowedSince).toBeNull();
	});

	test('place writes a receipt movement and sets the asset location', async () => {
		world.assets.push(world.makeAsset({ status: 'ready' }));
		await world.service.place(
			ASSET_ID,
			ORG_A,
			{ warehouseId: WAREHOUSE, storageId: STORAGE, locationDescription: 'Rack A' },
			actor,
		);
		expect(world.assets[0].warehouseId).toBe(WAREHOUSE);
		expect(world.assets[0].storageId).toBe(STORAGE);
		expect(world.assets[0].locationDescription).toBe('Rack A');
		expect(world.movements).toHaveLength(1);
		expect(world.movements[0].movementType).toBe('receipt');
		expect(world.movements[0].toWarehouseId).toBe(WAREHOUSE);
		expect(world.movements[0].toStorageId).toBe(STORAGE);
		expect(world.audit.forAction('asset.placed')).toHaveLength(1);
	});

	test('place is refused for an asset that is not ready', async () => {
		world.assets.push(world.makeAsset({ status: 'borrowed' }));
		await expect(
			world.service.place(ASSET_ID, ORG_A, { warehouseId: WAREHOUSE }, actor),
		).rejects.toThrow(AssetRuleViolationError);
		expect(world.movements).toHaveLength(0);
	});

	test('place in another organization is a 404, not a leak', async () => {
		world.assets.push(world.makeAsset({ status: 'ready' }));
		await expect(
			world.service.place(ASSET_ID, ORG_B, { warehouseId: WAREHOUSE }, actor),
		).rejects.toThrow(AssetNotFoundError);
	});

	test('transfer writes a transfer movement and clears the source', async () => {
		world.assets.push(
			world.makeAsset({
				status: 'ready',
				warehouseId: WAREHOUSE,
				storageId: STORAGE,
			}),
		);
		await world.service.transfer(
			ASSET_ID,
			ORG_A,
			{ toWarehouseId: OTHER_WAREHOUSE, toStorageId: null },
			actor,
		);
		expect(world.assets[0].warehouseId).toBe(OTHER_WAREHOUSE);
		expect(world.assets[0].storageId).toBeNull();
		expect(world.movements).toHaveLength(1);
		expect(world.movements[0].movementType).toBe('transfer');
		expect(world.movements[0].fromWarehouseId).toBe(WAREHOUSE);
		expect(world.movements[0].toWarehouseId).toBe(OTHER_WAREHOUSE);
		expect(world.audit.forAction('asset.transferred')).toHaveLength(1);
	});

	test('transfer is refused while the asset is out', async () => {
		world.assets.push(world.makeAsset({ status: 'borrowed' }));
		await expect(
			world.service.transfer(
				ASSET_ID,
				ORG_A,
				{ toWarehouseId: OTHER_WAREHOUSE },
				actor,
			),
		).rejects.toThrow(AssetRuleViolationError);
	});
});

describe('asset operations — depreciation (D14)', () => {
	test('an entry derives opening/closing and updates the asset in the same transaction', async () => {
		world.assets.push(world.makeAsset());
		const entry = await world.service.recordDepreciation(
			ASSET_ID,
			ORG_A,
			{ periodYear: 2026, periodMonth: 1, depreciationAmount: 1_000_000 },
			actor,
		);
		expect(entry.openingBookValue).toBe(10_000_000);
		expect(entry.closingBookValue).toBe(9_000_000);
		expect(world.assets[0].bookValue).toBe(9_000_000);
		expect(world.assets[0].accumulatedDepreciation).toBe(1_000_000);
	});

	test('a second entry for the same period is refused (idempotency probe)', async () => {
		world.assets.push(world.makeAsset());
		await world.service.recordDepreciation(
			ASSET_ID,
			ORG_A,
			{ periodYear: 2026, periodMonth: 1, depreciationAmount: 1_000_000 },
			actor,
		);
		await expect(
			world.service.recordDepreciation(
				ASSET_ID,
				ORG_A,
				{ periodYear: 2026, periodMonth: 1, depreciationAmount: 500 },
				actor,
			),
		).rejects.toThrow(AssetRuleViolationError);
		expect(world.depreciations).toHaveLength(1);
	});

	test('depreciation cannot exceed the remaining book value', async () => {
		world.assets.push(world.makeAsset({ bookValue: 500 }));
		await expect(
			world.service.recordDepreciation(
				ASSET_ID,
				ORG_A,
				{ periodYear: 2026, periodMonth: 2, depreciationAmount: 501 },
				actor,
			),
		).rejects.toThrow(AssetRuleViolationError);
		// The transaction rolled back: no entry, no valuation change.
		expect(world.depreciations).toHaveLength(0);
		expect(world.assets[0].bookValue).toBe(500);
	});

	test('invalid periods and negative amounts are refused', async () => {
		world.assets.push(world.makeAsset());
		await expect(
			world.service.recordDepreciation(
				ASSET_ID,
				ORG_A,
				{ periodYear: 2026, periodMonth: 13, depreciationAmount: 1 },
				actor,
			),
		).rejects.toThrow(AssetRuleViolationError);
		await expect(
			world.service.recordDepreciation(
				ASSET_ID,
				ORG_A,
				{ periodYear: 2026, periodMonth: 3, depreciationAmount: -1 },
				actor,
			),
		).rejects.toThrow(AssetRuleViolationError);
	});
});

describe('asset operations — disposal (D21)', () => {
	test('the full workflow: draft → approved → executed flips the asset to disposed and soft-deletes it', async () => {
		world.assets.push(world.makeAsset({ bookValue: 4_000_000 }));
		const disposal = await world.service.requestDisposal(
			ASSET_ID,
			ORG_A,
			{ disposalMethod: 'sale', proceedsAmount: 3_000_000 },
			actor,
		);
		expect(disposal.status).toBe('draft');
		expect(disposal.code).toMatch(/^DSP-DSL-\d{5}$/);

		await expect(
			world.service.executeDisposal(disposal.id, ORG_A, actor),
		).rejects.toThrow(AssetTransitionError);

		const approved = await world.service.approveDisposal(disposal.id, ORG_A, actor);
		expect(approved.status).toBe('approved');
		expect(approved.approvedBy).toBe(USER);

		const executed = await world.service.executeDisposal(disposal.id, ORG_A, actor);
		expect(executed.status).toBe('executed');
		expect(executed.executedAt).not.toBeNull();

		// The disposal record persists as financial proof; the asset is
		// flipped to disposed AND soft-deleted.
		expect(world.disposals).toHaveLength(1);
		const asset = world.assets[0];
		expect(asset.status).toBe('disposed');
		expect(asset.bookValue).toBe(0);
		expect(asset.deletedAt).not.toBeNull();
		expect(world.audit.forAction('asset.disposal_executed')).toHaveLength(1);
	});

	test('execution claim is atomic: a second execution is refused and rolls back', async () => {
		world.assets.push(world.makeAsset());
		const disposal = await world.service.requestDisposal(ASSET_ID, ORG_A, {}, actor);
		await world.service.approveDisposal(disposal.id, ORG_A, actor);
		await world.service.executeDisposal(disposal.id, ORG_A, actor);

		// Force the record back to approved to simulate a racing retry that
		// lost its claim; the conditional claim must refuse.
		const row = world.disposals[0] as unknown as {
			status: string;
			executedAt: Date | null;
		};
		row.status = 'approved';
		await expect(
			world.service.executeDisposal(disposal.id, ORG_A, actor),
		).rejects.toThrow(AssetRuleViolationError);
		// The claim refused the second execution. In this in-memory fake the
		// failed transaction rolls back to its snapshot (the 'approved' state
		// we staged), so nothing else changed — importantly the asset was not
		// archived a second time and no extra audit entry was written.
		expect(world.audit.forAction('asset.disposal_executed')).toHaveLength(1);
		expect(world.assets[0].deletedAt).not.toBeNull();
	});

	test('cancel of an executed disposal is refused', async () => {
		world.assets.push(world.makeAsset());
		const disposal = await world.service.requestDisposal(ASSET_ID, ORG_A, {}, actor);
		await world.service.approveDisposal(disposal.id, ORG_A, actor);
		await world.service.executeDisposal(disposal.id, ORG_A, actor);
		await expect(
			world.service.cancelDisposal(disposal.id, ORG_A, actor),
		).rejects.toThrow(AssetTransitionError);
	});
});

describe('asset operations — maintenance & condition', () => {
	test('a maintenance record mints an MNT code via ERP-0009', async () => {
		world.assets.push(world.makeAsset());
		const record = await world.service.logMaintenance(
			ASSET_ID,
			ORG_A,
			{ maintenanceType: 'corrective', cost: 250_000 },
			actor,
		);
		expect(record.code).toMatch(/^MNT-SVC-\d{5}$/);
		expect(record.maintenanceType).toBe('corrective');
		expect(world.audit.forAction('asset.serviced')).toHaveLength(1);
	});

	test('a condition check updates the asset condition in the same transaction', async () => {
		world.assets.push(world.makeAsset());
		await world.service.recordCondition(
			ASSET_ID,
			ORG_A,
			{ checkDate: '2026-01-15', condition: 'poor', findings: 'scratched' },
			actor,
		);
		expect(world.checks).toHaveLength(1);
		expect(world.assets[0].condition).toBe('poor');
	});

	test('an unknown condition is refused', async () => {
		world.assets.push(world.makeAsset());
		await expect(
			world.service.recordCondition(
				ASSET_ID,
				ORG_A,
				{ checkDate: '2026-01-15', condition: 'excellent' },
				actor,
			),
		).rejects.toThrow(AssetRuleViolationError);
	});
});
