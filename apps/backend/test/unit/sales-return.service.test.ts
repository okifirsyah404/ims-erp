/**
 * Sales returns (ERP-0065): a return comes from one shipped delivery note,
 * only for stock lines, never takes more than is left on the delivery line
 * after live returns, names that line's serials, is approved by someone
 * else, and on receiving books `return_in` at the delivery cost, brings the
 * serial units back `in_stock` or `damaged` per line and releases the
 * order quantity — or nothing at all.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	SalesReturnStatus,
	TDeliveryNoteItemSelect,
	TSalesReturnItemSelect,
	TSalesReturnSelect,
} from '@drizzle/schemas/sales.schema';
import { quantityToMilli } from '@utils/money.util';
import { salesReturnBodySchema } from '../../src/app/sales/contracts/sales-return.contract';
import type { ISalesReturnRepository, TReturnedOnDeliveryLine } from '../../src/app/sales/contracts/sales-return.repository.interface';
import {
	SalesReturnDeliveryError,
	SalesReturnSelfApprovalError,
	SalesReturnStateError,
} from '../../src/app/sales/errors/sales-return.errors';
import { SalesReturnService } from '../../src/app/sales/services/sales-return.service';

const CREATOR = 'user-sales';
const APPROVER = 'user-manager';
const WAREHOUSE = '0190a1b2-0000-7000-8000-0000000000f1';
const BIN_DAMAGED = '0190a1b2-0000-7000-8000-0000000000f2';
const NOTE = '0190a1b2-0000-7000-8000-0000000000e1';
const ORDER = '0190a1b2-0000-7000-8000-0000000000d1';
const CABLE_LINE = '0190a1b2-0000-7000-8000-0000000000c1';
const READER_LINE = '0190a1b2-0000-7000-8000-0000000000c2';
const SERVICE_LINE = '0190a1b2-0000-7000-8000-0000000000c3';
const CABLE = '0190a1b2-0000-7000-8000-0000000000b1';
const READER = '0190a1b2-0000-7000-8000-0000000000b2';
const SERVICE = '0190a1b2-0000-7000-8000-0000000000b3';

const noteLine = (id: string, itemId: string, quantity: string, unitPrice: number, unitCost: number, serials: string[] | null) =>
	({
		id,
		deliveryNoteId: NOTE,
		salesOrderItemId: `${id}-so`,
		itemId,
		sku: 'SKU',
		name: itemId,
		unit: 'pcs',
		quantity,
		unitPrice,
		unitCost,
		serialNumbers: serials,
		remarks: null,
		stockMovementId: null,
	}) as unknown as TDeliveryNoteItemSelect;

class FakeReturns implements ISalesReturnRepository {
	rows: (TSalesReturnSelect & { items: TSalesReturnItemSelect[] })[] = [];
	async paginate() {
		return { meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] };
	}
	async findById(id: string) {
		const row = this.rows.find((r) => r.id === id);
		return row ? { ...row, deliveryNoteCode: '0001/SJ/IMS/XI/26', salesOrderCode: 'SO-1', customerName: 'PT Gym' } : null;
	}
	async findItems(id: string) {
		return this.rows.find((r) => r.id === id)?.items ?? [];
	}
	async create(header: Parameters<ISalesReturnRepository['create']>[0], items: Parameters<ISalesReturnRepository['create']>[1]) {
		const id = crypto.randomUUID();
		const row = {
			...header,
			id,
			code: null,
			status: 'draft',
			rejectionReason: null,
			items: items.map((item, index) => ({ ...item, id: `${id}-${index}`, salesReturnId: id, condition: null, binId: null, stockMovementId: null, sortOrder: index })),
		} as unknown as TSalesReturnSelect & { items: TSalesReturnItemSelect[] };
		this.rows.push(row);
		return row;
	}
	async replaceDraft() {
		return null;
	}
	async transition(id: string, from: readonly SalesReturnStatus[], to: SalesReturnStatus, patch: object) {
		const row = this.rows.find((r) => r.id === id);
		if (!row || !from.includes(row.status)) return null;
		return Object.assign(row, patch, { status: to });
	}
	async returnedOnLines(ids: string[], statuses: readonly SalesReturnStatus[], exclude?: string) {
		const map = new Map<string, TReturnedOnDeliveryLine>();
		for (const row of this.rows) {
			if (!statuses.includes(row.status) || row.id === exclude) continue;
			for (const item of row.items) {
				if (!ids.includes(item.deliveryNoteItemId)) continue;
				const current = map.get(item.deliveryNoteItemId) ?? { quantityMilli: 0n, serialNumbers: [] };
				current.quantityMilli += quantityToMilli(item.quantity);
				current.serialNumbers.push(...(item.serialNumbers ?? []));
				map.set(item.deliveryNoteItemId, current);
			}
		}
		return map;
	}
	async claimForReceive(id: string) {
		const row = this.rows.find((r) => r.id === id);
		return row && row.status === 'approved' ? row : null;
	}
	async setReceived(itemId: string, data: object) {
		for (const row of this.rows) for (const item of row.items) if (item.id === itemId) Object.assign(item, data);
	}
}

let returns: FakeReturns;
let noteStatus: string;
let sold: string[];
let movements: { movementType: string; quantity: string; unitCost: number | null | undefined; binId: string | null | undefined }[];
let released: { salesOrderItemId: string; quantity: string }[];
let reopened: number;
let units: { serial: string; status: string }[];
let events: string[];
let service: SalesReturnService;

beforeEach(() => {
	returns = new FakeReturns();
	noteStatus = 'shipped';
	sold = ['SN-1', 'SN-2'];
	movements = [];
	released = [];
	reopened = 0;
	units = [];
	events = [];
	const lines = [
		noteLine(CABLE_LINE, CABLE, '10.000', 7_500_00, 5_000_00, null),
		noteLine(READER_LINE, READER, '2.000', 2_000_000_00, 1_200_000_00, ['SN-1', 'SN-2']),
		noteLine(SERVICE_LINE, SERVICE, '1.000', 500_000_00, 0, null),
	];
	service = new SalesReturnService(
		returns,
		{
			async findById(id: string) {
				return id === NOTE
					? ({ id: NOTE, code: '0001/SJ/IMS/XI/26', status: noteStatus, salesOrderId: ORDER, customerId: 'customer-1', warehouseId: WAREHOUSE } as never)
					: null;
			},
			async findItems() {
				return lines;
			},
			async paginate() {
				return { meta: { page: 1, limit: 30, total: 0, totalPages: 0 }, data: [] };
			},
		},
		{
			async allocateDelivery(_order: string, input: { salesOrderItemId: string; quantity: string }[]) {
				released.push(...input);
				return { ok: true as const };
			},
			async reopenForReplacement() {
				reopened += 1;
			},
			async findById() {
				return null;
			},
		},
		{
			async postMovement(input: { movementType: string; quantity: string; unitCost?: number | null; binId?: string | null }) {
				movements.push({ movementType: input.movementType, quantity: input.quantity, unitCost: input.unitCost, binId: input.binId });
				return { movement: { id: crypto.randomUUID() } } as never;
			},
			async resolveScope() {
				return { scopeOrganizationId: null } as never;
			},
		},
		{
			async getItem(id: string) {
				return { id, isSerialized: id === READER, isStockTracked: id !== SERVICE } as never;
			},
			async receiveCustomerUnits(_itemId: string, serials: readonly string[], data: { status: string }) {
				const ok = serials.filter((serial) => sold.includes(serial));
				units.push(...ok.map((serial) => ({ serial, status: data.status })));
				return serials.filter((serial) => !ok.includes(serial));
			},
		},
		{
			async getWarehouse() {
				return { code: 'WH-MAIN', name: 'Main', storages: [{ id: BIN_DAMAGED, code: 'RUSAK', name: 'Barang rusak', isActive: true, deletedAt: null }] } as never;
			},
		},
		{ next: async () => '0001/RTJ/IMS/XI/26' },
		{ run: async (work: (tx: never) => Promise<unknown>) => work({} as never) } as never,
		{ register: async () => ({}) as never, voidBySource: async () => {} } as never,
		{
			publish: async (topic: string, _aggregate: unknown, data: { change: string }) => {
				events.push(`${topic}:${data.change}`);
				return null;
			},
		} as never,
	);
});

const body = (lines: { deliveryNoteItemId: string; quantity: string; serialNumbers?: string[] }[]) =>
	salesReturnBodySchema.parse({ deliveryNoteId: NOTE, reason: 'Rusak', lines });

async function approved(lines: Parameters<typeof body>[0]) {
	const created = await service.create(CREATOR, body(lines));
	await service.submit(CREATOR, created.id);
	return service.decide(APPROVER, created.id, { decision: 'approve' });
}

const actor = { userId: 'user-warehouse', organizationId: 'org-1' };

describe('creating a sales return', () => {
	test('copies price, delivery cost and warehouse; total at the order price', async () => {
		const created = await service.create(CREATOR, body([{ deliveryNoteItemId: CABLE_LINE, quantity: '2' }]));
		expect(created.warehouseId).toBe(WAREHOUSE);
		expect(created.totalAmount).toBe(15_000_00);
		const [item] = await returns.findItems(created.id);
		expect(item?.unitCost).toBe(5_000_00);
		expect(item?.salesOrderItemId).toBe(`${CABLE_LINE}-so`);
	});

	test('only from a shipped or delivered note', async () => {
		noteStatus = 'prepared';
		await expect(service.create(CREATOR, body([{ deliveryNoteItemId: CABLE_LINE, quantity: '1' }]))).rejects.toBeInstanceOf(
			SalesReturnDeliveryError,
		);
	});

	test('refuses non-stock lines, over-quantity counting live returns, and wrong serials', async () => {
		await expect(service.create(CREATOR, body([{ deliveryNoteItemId: SERVICE_LINE, quantity: '1' }]))).rejects.toMatchObject({
			key: 'sales.returnLine.notStock',
		});
		await service.create(CREATOR, body([{ deliveryNoteItemId: CABLE_LINE, quantity: '9' }]));
		await expect(service.create(CREATOR, body([{ deliveryNoteItemId: CABLE_LINE, quantity: '2' }]))).rejects.toMatchObject({
			key: 'sales.returnLine.over',
		});
		await expect(
			service.create(CREATOR, body([{ deliveryNoteItemId: READER_LINE, quantity: '1', serialNumbers: ['SN-9'] }])),
		).rejects.toMatchObject({ key: 'sales.returnLine.serials' });
		await service.create(CREATOR, body([{ deliveryNoteItemId: READER_LINE, quantity: '1', serialNumbers: ['SN-1'] }]));
		await expect(
			service.create(CREATOR, body([{ deliveryNoteItemId: READER_LINE, quantity: '1', serialNumbers: ['SN-1'] }])),
		).rejects.toMatchObject({ key: 'sales.returnLine.serials' });
	});
});

describe('approving and receiving', () => {
	test('never approved by its creator; numbered RTJ', async () => {
		const created = await service.create(CREATOR, body([{ deliveryNoteItemId: CABLE_LINE, quantity: '1' }]));
		await service.submit(CREATOR, created.id);
		await expect(service.decide(CREATOR, created.id, { decision: 'approve' })).rejects.toBeInstanceOf(SalesReturnSelfApprovalError);
		const ok = await service.decide(APPROVER, created.id, { decision: 'approve' });
		expect(ok.code).toBe('0001/RTJ/IMS/XI/26');
	});

	test('receiving books return_in at the delivery cost, units per condition, releases the order', async () => {
		const row = await approved([
			{ deliveryNoteItemId: CABLE_LINE, quantity: '3' },
			{ deliveryNoteItemId: READER_LINE, quantity: '2', serialNumbers: ['SN-1', 'SN-2'] },
		]);
		const [cable, reader] = await returns.findItems(row.id);
		const done = await service.receive(actor, row.id, {
			lines: [
				{ salesReturnItemId: cable!.id, condition: 'good' },
				{ salesReturnItemId: reader!.id, condition: 'damaged', binId: BIN_DAMAGED },
			],
		});
		expect(done.status).toBe('received');
		expect(movements).toEqual([
			{ movementType: 'return_in', quantity: '3', unitCost: 5_000_00, binId: null },
			{ movementType: 'return_in', quantity: '2', unitCost: 1_200_000_00, binId: BIN_DAMAGED },
		]);
		expect(units).toEqual([
			{ serial: 'SN-1', status: 'damaged' },
			{ serial: 'SN-2', status: 'damaged' },
		]);
		expect(released).toEqual([
			{ salesOrderItemId: `${CABLE_LINE}-so`, quantity: '3' },
			{ salesOrderItemId: `${READER_LINE}-so`, quantity: '2' },
		]);
		expect(reopened).toBe(1);
		expect((await returns.findItems(row.id)).map((item) => item.condition)).toEqual(['good', 'damaged']);
		expect(events).toEqual(['sales_return.updated:submitted', 'sales_return.updated:approved', 'sales_return.updated:received']);
	});

	test('every line needs a condition, and storages must be the warehouse’s', async () => {
		const row = await approved([
			{ deliveryNoteItemId: CABLE_LINE, quantity: '1' },
			{ deliveryNoteItemId: READER_LINE, quantity: '1', serialNumbers: ['SN-1'] },
		]);
		const [cable] = await returns.findItems(row.id);
		await expect(service.receive(actor, row.id, { lines: [{ salesReturnItemId: cable!.id, condition: 'good' }] })).rejects.toMatchObject({
			key: 'sales.returnReceive.lines',
		});
		const [, reader] = await returns.findItems(row.id);
		await expect(
			service.receive(actor, row.id, {
				lines: [
					{ salesReturnItemId: cable!.id, condition: 'good', binId: '0190a1b2-0000-7000-8000-0000000000aa' },
					{ salesReturnItemId: reader!.id, condition: 'good' },
				],
			}),
		).rejects.toMatchObject({ key: 'sales.returnReceive.bin' });
	});

	test('a serial no longer sold fails the whole receipt; only approved returns are received', async () => {
		const row = await approved([{ deliveryNoteItemId: READER_LINE, quantity: '1', serialNumbers: ['SN-2'] }]);
		const [reader] = await returns.findItems(row.id);
		sold = ['SN-1'];
		await expect(
			service.receive(actor, row.id, { lines: [{ salesReturnItemId: reader!.id, condition: 'good' }] }),
		).rejects.toMatchObject({ key: 'sales.returnLine.notSold' });
		const draft = await service.create(CREATOR, body([{ deliveryNoteItemId: CABLE_LINE, quantity: '1' }]));
		const [line] = await returns.findItems(draft.id);
		await expect(
			service.receive(actor, draft.id, { lines: [{ salesReturnItemId: line!.id, condition: 'good' }] }),
		).rejects.toBeInstanceOf(SalesReturnStateError);
	});

	test('a received return cannot be cancelled', async () => {
		const row = await approved([{ deliveryNoteItemId: CABLE_LINE, quantity: '1' }]);
		const [cable] = await returns.findItems(row.id);
		await service.receive(actor, row.id, { lines: [{ salesReturnItemId: cable!.id, condition: 'good' }] });
		await expect(service.cancel(CREATOR, row.id, 'late')).rejects.toMatchObject({ key: 'sales.returnState.notCancellable' });
	});
});
