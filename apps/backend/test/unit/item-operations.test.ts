/**
 * Item operations unit tests (ADR-0024 P3 step 2c): custody status derivation
 * and movements, maintenance and condition checks, the disposal workflow, tool
 * sets, item documents and the depreciation hook finance calls.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	TDisposalInsert,
	TDisposalSelect,
	TItemSelect,
	TToolSetItemSelect,
	TToolSetSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import {
	ItemNotFoundError,
	ItemRuleViolationError,
	ItemTransitionError,
} from '../../src/app/inventory/errors/item.errors';
import { DisposalService } from '../../src/app/inventory/services/disposal.service';
import { ItemCustodyService } from '../../src/app/inventory/services/item-custody.service';
import { ItemDocumentService } from '../../src/app/inventory/services/item-document.service';
import { ItemService } from '../../src/app/inventory/services/item.service';
import { MaintenanceService } from '../../src/app/inventory/services/maintenance.service';
import { ToolSetService } from '../../src/app/inventory/services/tool-set.service';

const ORG = 'org-1';
const WH = '0190a1b2-0000-7000-8000-0000000000w1';
const WH2 = '0190a1b2-0000-7000-8000-0000000000w2';
const actor = { userId: 'user-1' };
const audit = { record: async () => {} } as never;
const transactions = { run: <T>(work: (tx: TTx) => Promise<T>) => work({} as TTx) };

let seq = 0;
const id = () => `id-${++seq}`;

function items() {
	const rows = new Map<string, TItemSelect>();
	const add = (patch: Partial<TItemSelect> = {}): TItemSelect => {
		const row = {
			id: id(),
			organizationId: ORG,
			code: `AST-${rows.size + 1}`,
			status: 'ready',
			condition: 'good',
			warehouseId: WH,
			storageId: null,
			locationDescription: null,
			bookValue: 1_000_000,
			accumulatedDepreciation: 0,
			currencyCode: 'IDR',
			deletedAt: null,
			...patch,
		} as TItemSelect;
		rows.set(row.id, row);
		return row;
	};
	const repo = {
		findById: async (itemId: string) => {
			const row = rows.get(itemId);
			return row && !row.deletedAt ? row : null;
		},
		update: async (itemId: string, data: Partial<TItemSelect>) => {
			const row = rows.get(itemId);
			return row ? Object.assign(row, data) : null;
		},
		archive: async (itemId: string) => {
			const row = rows.get(itemId);
			return row ? Object.assign(row, { deletedAt: new Date() }) : null;
		},
	};
	return { rows, add, repo };
}

const numbering = (() => {
	let n = 0;
	return { next: async (type: string) => `${type}-${++n}` };
})();

describe('ItemCustodyService', () => {
	let w: ReturnType<typeof items>;
	let movements: { movementType: string; code: string; itemId: string; targetWarehouseId?: string | null; notes?: string | null }[];
	let openBorrowed: Set<string>;
	let openMaintenance: Set<string>;
	let service: ItemCustodyService;

	beforeEach(() => {
		w = items();
		movements = [];
		openBorrowed = new Set();
		openMaintenance = new Set();
		service = new ItemCustodyService(
			w.repo as never,
			{
				create: async (data: never) => {
					const row = { id: id(), ...(data as object) } as (typeof movements)[number] & { id: string };
					movements.push(row);
					return row as never;
				},
				paginateByItem: async () => ({ meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] }),
			},
			{ findOpenForItem: async (itemId: string) => (openBorrowed.has(itemId) ? { issuedAt: new Date() } : null) },
			{ hasOpenForItem: async (itemId: string) => openMaintenance.has(itemId) } as never,
			numbering,
			audit,
			{
				assertWarehouseReachableByOrg: async (warehouseId: string) => warehouseId !== 'unreachable',
				assertStorageInWarehouse: async () => {},
			},
			transactions,
		);
	});

	test('status follows custody: borrowed, maintenance, ready; inactive and lost are sticky', async () => {
		const a = w.add();
		openBorrowed.add(a.id);
		expect((await service.reconcileStatus(a.id))?.status).toBe('borrowed');
		openBorrowed.clear();
		openMaintenance.add(a.id);
		expect((await service.reconcileStatus(a.id))?.status).toBe('maintenance');
		openMaintenance.clear();
		expect((await service.reconcileStatus(a.id))?.status).toBe('ready');
		const parked = w.add({ status: 'inactive' });
		openBorrowed.add(parked.id);
		expect((await service.reconcileStatus(parked.id))?.status).toBe('inactive');
		const lost = w.add({ status: 'lost' });
		expect((await service.reconcileStatus(lost.id))?.status).toBe('lost');
	});

	test('borrow_out clears the location, borrow_return restores it and keeps the condition in the note', async () => {
		const a = w.add();
		await service.borrowOut(a.id, ORG, { warehouseId: WH, storageId: null, referenceId: 'b-1' }, actor, {} as TTx);
		expect(w.rows.get(a.id)).toMatchObject({ warehouseId: null, storageId: null });
		await service.borrowReturn(a.id, ORG, { warehouseId: WH2, storageId: null, condition: 'damaged', referenceId: 'b-1' }, actor, {} as TTx);
		expect(w.rows.get(a.id)).toMatchObject({ warehouseId: WH2 });
		expect(movements.map((m) => m.movementType)).toEqual(['borrow_out', 'borrow_return']);
		expect(movements[1]).toMatchObject({ targetWarehouseId: WH2 });
		expect(movements[1]!.notes).toContain('condition: damaged');
		expect(new Set(movements.map((m) => m.code)).size).toBe(2);
	});

	test('place and transfer need a ready unit and a reachable warehouse', async () => {
		const ready = w.add({ warehouseId: null });
		const placed = await service.place(ready.id, ORG, { warehouseId: WH });
		expect(placed.movementType).toBe('receipt');
		expect(w.rows.get(ready.id)?.warehouseId).toBe(WH);

		const moved = await service.transfer(ready.id, ORG, { toWarehouseId: WH2 });
		expect(moved).toMatchObject({ movementType: 'transfer_out', targetWarehouseId: WH2 });

		const busy = w.add({ status: 'borrowed' });
		await expect(service.place(busy.id, ORG, { warehouseId: WH })).rejects.toBeInstanceOf(ItemRuleViolationError);
		await expect(service.transfer(ready.id, ORG, { toWarehouseId: 'unreachable' })).rejects.toThrow();
		const foreign = w.add({ organizationId: 'other' });
		await expect(service.place(foreign.id, ORG, { warehouseId: WH })).rejects.toBeInstanceOf(ItemNotFoundError);
	});

	test('only project_site is a manual movement type', async () => {
		const a = w.add();
		await expect(service.move(a.id, ORG, { movementType: 'transfer_out' })).rejects.toBeInstanceOf(ItemRuleViolationError);
		const m = await service.move(a.id, ORG, { movementType: 'project_site', toLocation: 'Site A' });
		expect(m.movementType).toBe('project_site');
		expect(w.rows.get(a.id)?.locationDescription).toBe('Site A');
	});
});

describe('MaintenanceService', () => {
	test('a maintenance gets a code, reconciles the status, and a condition check updates the condition', async () => {
		const w = items();
		const a = w.add();
		const created: { code: string; status: string }[] = [];
		const reconciled: string[] = [];
		const service = new MaintenanceService(
			w.repo as never,
			{
				create: async (data: never) => {
					created.push(data);
					return { id: id(), ...(data as object) } as never;
				},
				paginateByItem: async () => ({ meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] }),
				hasOpenForItem: async () => true,
			},
			{ create: async (data: never) => ({ id: id(), ...(data as object) }) as never, paginateByItem: async () => ({ meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] }) },
			{ reconcileStatus: async (itemId: string) => { reconciled.push(itemId); return null; } },
			numbering,
			audit,
			transactions,
		);
		const record = await service.logMaintenance(a.id, ORG, {
			maintenanceType: 'corrective',
			cost: 150_000,
			currencyCode: 'IDR',
			status: 'in_progress',
		});
		expect(record.code).toMatch(/^maintenance-/);
		expect(reconciled).toEqual([a.id]);
		await service.recordCondition(a.id, ORG, { checkDate: '2026-11-19', condition: 'poor' }, actor);
		expect(w.rows.get(a.id)?.condition).toBe('poor');
		await expect(service.logMaintenance('missing', ORG, { maintenanceType: 'preventive', cost: 0, currencyCode: 'IDR', status: 'scheduled' })).rejects.toBeInstanceOf(ItemNotFoundError);
	});
});

describe('DisposalService', () => {
	let w: ReturnType<typeof items>;
	let rows: TDisposalSelect[];
	let service: DisposalService;

	beforeEach(() => {
		w = items();
		rows = [];
		service = new DisposalService(
			w.repo as never,
			{
				create: async (data: TDisposalInsert) => {
					const row = { id: id(), deletedAt: null, executedAt: null, bookValueAtDisposal: 0, gainLoss: 0, ...data } as TDisposalSelect;
					rows.push(row);
					return row;
				},
				findById: async (disposalId: string) => rows.find((r) => r.id === disposalId) ?? null,
				paginate: async () => ({ meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] }),
				update: async (disposalId: string, data: Partial<TDisposalSelect>) => {
					const row = rows.find((r) => r.id === disposalId);
					return row ? Object.assign(row, data) : null;
				},
				claimForExecution: async (disposalId: string, snapshot: { bookValueAtDisposal: number; gainLoss: number }) => {
					const row = rows.find((r) => r.id === disposalId && r.status === 'approved' && !r.executedAt);
					return row ? Object.assign(row, { status: 'executed', executedAt: new Date(), ...snapshot }) : null;
				},
			},
			numbering,
			audit,
			transactions,
		);
	});

	test('draft -> approved -> executed flips the unit to disposed, zero book value, archived; snapshot taken at execution', async () => {
		const a = w.add({ bookValue: 800_000 });
		const draft = await service.requestDisposal(a.id, ORG, { disposalMethod: 'sale', proceedsAmount: 1_000_000 }, actor);
		expect(draft.status).toBe('draft');
		// depreciation posts between request and execution
		w.rows.get(a.id)!.bookValue = 600_000;
		await service.approveDisposal(draft.id, ORG, actor);
		const executed = await service.executeDisposal(draft.id, ORG, actor);
		expect(executed).toMatchObject({ status: 'executed', bookValueAtDisposal: 600_000, gainLoss: 400_000 });
		expect(w.rows.get(a.id)).toMatchObject({ status: 'disposed', bookValue: 0 });
		expect(w.rows.get(a.id)?.deletedAt).not.toBeNull();
	});

	test('illegal edges are refused: execute before approval, double execute, cancel after execute, disposed unit', async () => {
		const a = w.add();
		const draft = await service.requestDisposal(a.id, ORG, { disposalMethod: 'scrap', proceedsAmount: 0 }, actor);
		await expect(service.executeDisposal(draft.id, ORG, actor)).rejects.toBeInstanceOf(ItemTransitionError);
		await service.approveDisposal(draft.id, ORG, actor);
		await service.executeDisposal(draft.id, ORG, actor);
		await expect(service.executeDisposal(draft.id, ORG, actor)).rejects.toBeInstanceOf(ItemTransitionError);
		await expect(service.cancelDisposal(draft.id, ORG, actor)).rejects.toBeInstanceOf(ItemTransitionError);
		const gone = w.add({ status: 'disposed' });
		await expect(service.requestDisposal(gone.id, ORG, { disposalMethod: 'scrap', proceedsAmount: 0 }, actor)).rejects.toBeInstanceOf(ItemTransitionError);
	});

	test('a disposal of another tenant answers not found', async () => {
		const a = w.add();
		const draft = await service.requestDisposal(a.id, ORG, { disposalMethod: 'scrap', proceedsAmount: 0 }, actor);
		await expect(service.getDisposal(draft.id, 'other-org')).rejects.toBeInstanceOf(ItemNotFoundError);
	});
});

describe('ToolSetService', () => {
	test('a set holds only units of the tenant and is archived only when empty', async () => {
		const w = items();
		const unit = w.add();
		const foreign = w.add({ organizationId: 'other' });
		const sets: TToolSetSelect[] = [];
		const members: TToolSetItemSelect[] = [];
		const service = new ToolSetService(
			{
				findById: async (setId: string) => sets.find((s) => s.id === setId) ?? null,
				create: async (data: never) => {
					const row = { id: id(), ...(data as object) } as TToolSetSelect;
					sets.push(row);
					return row;
				},
				paginate: async () => ({ meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] }),
				update: async (setId: string, data: Partial<TToolSetSelect>) => {
					const row = sets.find((s) => s.id === setId);
					return row ? Object.assign(row, data) : null;
				},
				setStatus: async () => null,
				archive: async () => null,
			},
			{
				listByToolSet: async (setId: string) => members.filter((m) => m.toolSetId === setId),
				listItemIds: async () => [],
				add: async (data: never) => {
					const row = { id: id(), ...(data as object) } as TToolSetItemSelect;
					members.push(row);
					return row;
				},
				remove: async (_setId: string, rowId: string) => {
					const index = members.findIndex((m) => m.id === rowId);
					if (index >= 0) members.splice(index, 1);
					return index >= 0;
				},
			},
			w.repo as never,
			numbering,
			audit,
			transactions,
		);
		const set = await service.create(ORG, { name: 'Kit A' }, actor);
		expect(set).toMatchObject({ status: 'available', code: expect.stringMatching(/^tool_set-/) });
		await expect(service.addItem(set.id, ORG, { itemId: foreign.id, quantity: 1 })).rejects.toBeInstanceOf(ItemNotFoundError);
		const row = await service.addItem(set.id, ORG, { itemId: unit.id, quantity: 1 });
		await expect(service.archive(set.id, ORG)).rejects.toBeInstanceOf(ItemRuleViolationError);
		await service.removeItem(set.id, row.id, ORG);
		await expect(service.archive(set.id, ORG)).resolves.toBeUndefined();
		await expect(service.get(set.id, 'other-org')).rejects.toBeInstanceOf(ItemNotFoundError);
	});
});

describe('ItemDocumentService', () => {
	test('stores the file under a fresh key and lists it with a signed link, never the object key', async () => {
		const w = items();
		const a = w.add();
		const stored: string[] = [];
		const rows: never[] = [];
		const service = new ItemDocumentService(
			w.repo as never,
			{
				create: async (data: never) => {
					const row = { id: id(), deletedAt: null, ...(data as object) } as never;
					rows.push(row);
					return row;
				},
				listByItem: async () => rows,
				listByProduct: async () => [],
			},
			{
				put: async (key: string) => void stored.push(key),
				presignGet: (key: string) => `https://files.test/${key}`,
			},
			audit,
		);
		const view = await service.upload(a.id, ORG, new File(['pdf'], 'manual.pdf', { type: 'application/pdf' }), 'manual', actor);
		expect(stored).toHaveLength(1);
		expect(stored[0]).toMatch(new RegExp(`^inventory/items/${a.id}/[0-9a-f-]{36}\\.pdf$`));
		expect(view.url).toBe(`https://files.test/${stored[0]}`);
		expect(view).not.toHaveProperty('objectKey');
		await expect(service.upload(a.id, ORG, new File([], 'empty.pdf'), 'manual')).rejects.toBeInstanceOf(ItemRuleViolationError);
		await expect(service.upload(a.id, 'other-org', new File(['x'], 'a.pdf'), 'manual')).rejects.toBeInstanceOf(ItemNotFoundError);
	});
});

describe('ItemService.applyDepreciation (finance hook)', () => {
	test('reduces the book value, adds to the accumulated depreciation, refuses overshoot and negatives', async () => {
		const w = items();
		const a = w.add({ bookValue: 1_000_000, accumulatedDepreciation: 200_000 });
		const service = Object.create(ItemService.prototype) as ItemService;
		Object.assign(service, { itemRepository: w.repo });
		const updated = await service.applyDepreciation(a.id, ORG, 300_000);
		expect(updated).toMatchObject({ bookValue: 700_000, accumulatedDepreciation: 500_000 });
		await expect(service.applyDepreciation(a.id, ORG, 700_001)).rejects.toBeInstanceOf(ItemRuleViolationError);
		await expect(service.applyDepreciation(a.id, ORG, -1)).rejects.toBeInstanceOf(ItemRuleViolationError);
		await expect(service.applyDepreciation(a.id, 'other-org', 1)).rejects.toBeInstanceOf(ItemNotFoundError);
	});
});
