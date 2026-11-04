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
	TAssetAssignmentSelect,
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
	TAssignmentListRequest,
} from '../../src/app/assets/contracts/asset-operations.repository.interface';
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
const USER = 'user-1';

const actor = { userId: USER, email: 'u@x.io' };

type AssetRow = TAssetSelect;
type AssignmentRow = TAssetAssignmentSelect;
type DisposalRow = TAssetDisposalSelect;

/** Builds a fresh in-memory world for the operations service. */
function buildWorld() {
	const assets: AssetRow[] = [];
	const assignments: AssignmentRow[] = [];
	const disposals: DisposalRow[] = [];
	const depreciations: Array<Record<string, unknown>> = [];
	const movements: Array<Record<string, unknown>> = [];
	const checks: Array<Record<string, unknown>> = [];
	const maintenances: Array<Record<string, unknown>> = [];
	const documents: Array<Record<string, unknown>> = [];
	const toolSets: Array<Record<string, unknown>> = [];
	const toolSetItems: Array<Record<string, unknown>> = [];

	let idSeq = 0;
	const nextId = () => `id-${++idSeq}`;

	const makeAsset = (overrides: Partial<AssetRow> = {}): AssetRow =>
		({
			id: ASSET_ID,
			organizationId: ORG_A,
			code: 'AST-REG-000001',
			name: 'Laptop',
			assetType: 'it',
			status: 'in_stock',
			condition: 'good',
			acquisitionCost: 10_000_000,
			salvageValue: 0,
			accumulatedDepreciation: 0,
			bookValue: 10_000_000,
			currencyCode: 'IDR',
			depreciationMethod: 'straight_line',
			assignedAt: null,
			deactivationReason: null,
			createdAt: new Date(),
			updatedAt: null,
			deletedAt: null,
			...overrides,
		}) as AssetRow;

	/** Snapshot/restore transaction emulation (real rollback semantics). */
	const database = {
		transaction: async (callback: (tx: 'TX') => unknown) => {
			const assetSnap = assets.map((row) => ({ ...row }));
			const assignmentSnap = assignments.map((row) => ({ ...row }));
			const disposalSnap = disposals.map((row) => ({ ...row }));
			const depSnap = [...depreciations];
			try {
				return await callback('TX' as never);
			} catch (error) {
				assets.splice(0, assets.length, ...assetSnap);
				assignments.splice(0, assignments.length, ...assignmentSnap);
				disposals.splice(0, disposals.length, ...disposalSnap);
				depreciations.splice(0, depreciations.length, ...depSnap);
				throw error;
			}
		},
	} as never;

	const assetRepository: IAssetRepository = {
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
			return { assignments: 0, maintenances: 0 };
		},
	};

	const operations: IAssetOperationsRepository = {
		async createAssignment(data) {
			const row = {
				id: nextId(),
				returnedAt: null,
				conditionOnReturn: null,
				deletedAt: null,
				updatedAt: null,
				...data,
			} as AssignmentRow;
			assignments.push(row);
			return row;
		},
		async listAssignments(request: TAssignmentListRequest) {
			const rows = assignments.filter(
				(r) =>
					r.assetId === request.assetId &&
					(!request.openOnly || r.returnedAt === null),
			);
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
		async findOpenAssignment(assetId) {
			return (
				assignments.find(
					(r) => r.assetId === assetId && r.returnedAt === null,
				) ?? null
			);
		},
		async claimForReturn(assignmentId, data, _tx: TTx) {
			const row = assignments.find(
				(r) => r.id === assignmentId && r.returnedAt === null,
			);
			if (!row) return null;
			Object.assign(row, data);
			return row;
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
		assignments,
		disposals,
		depreciations,
		movements,
		checks,
		makeAsset,
		database,
	};
}

let world: ReturnType<typeof buildWorld>;

beforeEach(() => {
	world = buildWorld();
});

describe('asset operations — custody (D12)', () => {
	test('a happy assignment flips the asset to in_use and writes a loan movement', async () => {
		world.assets.push(world.makeAsset());
		const assignment = await world.service.assign(
			ASSET_ID,
			ORG_A,
			{ assignedToUserId: USER, conditionOnAssign: 'good' },
			actor,
		);
		expect(assignment.returnedAt).toBeNull();
		expect(world.assets[0].status).toBe('in_use');
		expect(world.movements).toHaveLength(1);
		expect(world.movements[0].movementType).toBe('loan');
		expect(world.audit.forAction('asset.assigned')).toHaveLength(1);
	});

	test('assignment is blocked for in_use/inactive/disposed/lost assets', async () => {
		for (const status of ['in_use', 'inactive', 'disposed', 'lost']) {
			const fresh = buildWorld();
			fresh.assets.push(fresh.makeAsset({ status }));
			await expect(
				fresh.service.assign(
					ASSET_ID,
					ORG_A,
					{ assignedToUserId: USER },
					actor,
				),
			).rejects.toThrow(AssetRuleViolationError);
		}
	});

	test('a second assignment while one is open is refused', async () => {
		world.assets.push(world.makeAsset());
		await world.service.assign(ASSET_ID, ORG_A, { assignedToUserId: USER }, actor);
		await expect(
			world.service.assign(
				ASSET_ID,
				ORG_A,
				{ assignedToUserId: 'user-2' },
				actor,
			),
		).rejects.toThrow(AssetRuleViolationError);
	});

	test('assignment requires a holder', async () => {
		world.assets.push(world.makeAsset());
		await expect(
			world.service.assign(ASSET_ID, ORG_A, {}, actor),
		).rejects.toThrow(AssetRuleViolationError);
	});

	test('return writes condition-in, resets the asset to in_stock, writes a return movement', async () => {
		world.assets.push(world.makeAsset());
		await world.service.assign(ASSET_ID, ORG_A, { assignedToUserId: USER }, actor);
		const returned = await world.service.returnAsset(
			ASSET_ID,
			ORG_A,
			{ conditionOnReturn: 'damaged' },
			actor,
		);
		expect(returned.returnedAt).not.toBeNull();
		expect(returned.conditionOnReturn).toBe('damaged');
		expect(world.assets[0].status).toBe('in_stock');
		expect(world.assets[0].condition).toBe('damaged');
		expect(world.assets[0].assignedAt).toBeNull();
		expect(world.movements).toHaveLength(2);
		expect(world.movements[1].movementType).toBe('return');
	});

	test('return without an open assignment is a rule violation', async () => {
		world.assets.push(world.makeAsset());
		await expect(
			world.service.returnAsset(
				ASSET_ID,
				ORG_A,
				{ conditionOnReturn: 'good' },
				actor,
			),
		).rejects.toThrow(AssetRuleViolationError);
	});

	test('returning a non-in_use asset is a transition error', async () => {
		world.assets.push(world.makeAsset({ status: 'in_stock' }));
		await expect(
			world.service.returnAsset(
				ASSET_ID,
				ORG_A,
				{ conditionOnReturn: 'good' },
				actor,
			),
		).rejects.toThrow(AssetTransitionError);
	});

	test('another organization is a 404, not a leak', async () => {
		world.assets.push(world.makeAsset());
		await expect(
			world.service.assign(ASSET_ID, ORG_B, { assignedToUserId: USER }, actor),
		).rejects.toThrow(AssetNotFoundError);
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
