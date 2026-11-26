/**
 * Purchase returns (ERP-0068): a return comes from one goods receipt, never
 * takes more than is left on the receipt line after live returns, names the
 * receipt's own in-stock serials, is approved by someone else and numbered
 * then, and on shipping posts `return_out`, returns the serial units and
 * takes the quantity off the PO - or nothing at all.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	PurchaseReturnStatus,
	TGoodsReceiptItemSelect,
	TPurchaseReturnItemSelect,
	TPurchaseReturnSelect,
} from '@drizzle/schemas/procurement.schema';
import { quantityToMilli } from '@utils/money.util';
import { purchaseReturnBodySchema } from '../../src/app/procurement/contracts/purchase-return.contract';
import type { IPurchaseReturnRepository, TReturnedOnLine } from '../../src/app/procurement/contracts/purchase-return.repository.interface';
import {
	PurchaseReturnLineError,
	PurchaseReturnReceiptError,
	PurchaseReturnSelfApprovalError,
	PurchaseReturnStateError,
} from '../../src/app/procurement/errors/procurement.errors';
import { PurchaseReturnService } from '../../src/app/procurement/services/purchase-return.service';

const CREATOR = 'user-purchasing';
const APPROVER = 'user-ops';
const WAREHOUSE = '0190a1b2-0000-7000-8000-0000000000f1';
const RECEIPT = '0190a1b2-0000-7000-8000-0000000000e1';
const ORDER = '0190a1b2-0000-7000-8000-0000000000d1';
const CABLE_LINE = '0190a1b2-0000-7000-8000-0000000000c1';
const READER_LINE = '0190a1b2-0000-7000-8000-0000000000c2';
const CABLE = '0190a1b2-0000-7000-8000-0000000000b1';
const READER = '0190a1b2-0000-7000-8000-0000000000b2';

const receiptLine = (id: string, productId: string, quantity: string, unitCost: number, serials: string[] | null) =>
	({
		id,
		goodsReceiptId: RECEIPT,
		purchaseOrderItemId: `${id}-po`,
		productId,
		sku: productId === CABLE ? 'CBL' : 'RDR',
		name: productId === CABLE ? 'Cable' : 'Reader',
		unit: 'pcs',
		quantity,
		unitCost,
		serialNumbers: serials,
		// The receipt posted a movement for a stock line; a non-stock line has none.
		movementId: `mv-${id}`,
	}) as TGoodsReceiptItemSelect;

class FakeReturns implements IPurchaseReturnRepository {
	rows: (TPurchaseReturnSelect & { items: TPurchaseReturnItemSelect[] })[] = [];
	async paginate() {
		return { meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] };
	}
	async findById(id: string) {
		const row = this.rows.find((r) => r.id === id);
		return row ? { ...row, goodsReceiptCode: '0001/BPB/IMS/XI/26', purchaseOrderCode: 'PO/1', supplierName: 'PT HIT' } : null;
	}
	async findItems(id: string) {
		return this.rows.find((r) => r.id === id)?.items ?? [];
	}
	async create(header: Parameters<IPurchaseReturnRepository['create']>[0], items: Parameters<IPurchaseReturnRepository['create']>[1]) {
		const id = crypto.randomUUID();
		const row = {
			...header,
			id,
			code: null,
			status: 'draft',
			rejectionReason: null,
			items: items.map((item, index) => ({ ...item, id: `${id}-${index}`, purchaseReturnId: id, movementId: null, sortOrder: index })),
		} as unknown as TPurchaseReturnSelect & { items: TPurchaseReturnItemSelect[] };
		this.rows.push(row);
		return row;
	}
	async replaceDraft() {
		return null;
	}
	async transition(id: string, from: readonly PurchaseReturnStatus[], to: PurchaseReturnStatus, patch: object) {
		const row = this.rows.find((r) => r.id === id);
		if (!row || !from.includes(row.status)) return null;
		return Object.assign(row, patch, { status: to });
	}
	async returnedOnLines(ids: string[], statuses: readonly PurchaseReturnStatus[], exclude?: string) {
		const map = new Map<string, TReturnedOnLine>();
		for (const row of this.rows) {
			if (!statuses.includes(row.status) || row.id === exclude) continue;
			for (const item of row.items) {
				if (!ids.includes(item.goodsReceiptItemId)) continue;
				const current = map.get(item.goodsReceiptItemId) ?? { quantityMilli: 0n, serialNumbers: [] };
				current.quantityMilli += quantityToMilli(item.quantity);
				current.serialNumbers.push(...(item.serialNumbers ?? []));
				map.set(item.goodsReceiptItemId, current);
			}
		}
		return map;
	}
	async claimForShip(id: string) {
		const row = this.rows.find((r) => r.id === id);
		return row && row.status === 'approved' ? row : null;
	}
	async setMovement(productId: string, movementId: string) {
		for (const row of this.rows) for (const item of row.items) if (item.id === productId) item.movementId = movementId;
	}
}

let returns: FakeReturns;
let orderStatus: string;
let inStock: string[];
let movements: { movementType: string; quantity: string; warehouseId: string; productId: string }[];
let unreceived: { purchaseOrderItemId: string; quantity: string }[];
let returnedUnits: string[];
let documents: string[];
let events: string[];
let service: PurchaseReturnService;
let receiptWarehouse: string | null;
let orderSupplier: string | null;
let receiptLines: TGoodsReceiptItemSelect[];

beforeEach(() => {
	receiptWarehouse = WAREHOUSE;
	orderSupplier = 'supplier-1';
	returns = new FakeReturns();
	orderStatus = 'received';
	inStock = ['SN-1', 'SN-2', 'SN-3'];
	movements = [];
	unreceived = [];
	returnedUnits = [];
	documents = [];
	events = [];
	receiptLines = [receiptLine(CABLE_LINE, CABLE, '10.000', 5_000_00, null), receiptLine(READER_LINE, READER, '3.000', 1_200_000_00, ['SN-1', 'SN-2', 'SN-3'])];
	service = new PurchaseReturnService(
		returns,
		{
			async paginate() {
				return { meta: { page: 1, limit: 30, total: 0, totalPages: 0 }, data: [] };
			},
			async findById(id: string) {
				return id === RECEIPT
					? ({ id: RECEIPT, code: '0001/BPB/IMS/XI/26', purchaseOrderId: ORDER, warehouseId: receiptWarehouse, binId: null } as never)
					: null;
			},
			async findItems() {
				return receiptLines;
			},
		},
		{
			async findById() {
				return { id: ORDER, status: orderStatus, supplierCompanyId: orderSupplier } as never;
			},
			async unreceive(_orderId: string, input: { purchaseOrderItemId: string; quantity: string }[]) {
				if (orderStatus !== 'received' && orderStatus !== 'partially_received') return { ok: false as const, reason: 'notReturnable' as const };
				unreceived.push(...input);
				return { ok: true as const, order: {} as never };
			},
		},
		{
			async postMovement(input: { movementType: string; quantity: string; warehouseId: string; productId: string }) {
				movements.push({ movementType: input.movementType, quantity: input.quantity, warehouseId: input.warehouseId, productId: input.productId });
				return { movement: { id: crypto.randomUUID() } } as never;
			},
		},
		{
			async getProduct(id: string) {
				return { id, isSerialized: id === READER } as never;
			},
		},
		{
			/** ADR-0026: the units stayed in `inventory`, so returns go through it. */
			async supplierReturnableSerials() {
				return inStock;
			},
			async returnUnits(_itemId: string, serials: readonly string[]) {
				const ok = serials.filter((serial) => inStock.includes(serial));
				returnedUnits.push(...ok);
				return serials.filter((serial) => !ok.includes(serial));
			},
		},
		{
			async getWarehouse() {
				return { code: 'WH-MAIN', name: 'Main', storages: [] } as never;
			},
		},
		{ next: async () => '0001/RTB/IMS/XI/26' },
		{ run: async (work: (tx: never) => Promise<unknown>) => work({} as never) } as never,
		{
			register: async (input: { documentType: string }) => {
				documents.push(`register:${input.documentType}`);
				return {} as never;
			},
			voidBySource: async (_module: string, type: string) => {
				documents.push(`void:${type}`);
			},
		} as never,
		{
			publish: async (topic: string, _aggregate: unknown, data: { change: string }) => {
				events.push(`${topic}:${data.change}`);
				return null;
			},
		} as never,
	);
});

const body = (lines: { goodsReceiptItemId: string; quantity: string; serialNumbers?: string[] }[]) =>
	purchaseReturnBodySchema.parse({ goodsReceiptId: RECEIPT, reason: 'Defective', lines });

async function approved(lines: Parameters<typeof body>[0]) {
	const created = await service.create(CREATOR, body(lines));
	await service.submit(CREATOR, created.id);
	return service.decide(APPROVER, created.id, { decision: 'approve' });
}

describe('creating a purchase return', () => {
	test('copies the receipt cost, warehouse and PO line', async () => {
		const created = await service.create(CREATOR, body([{ goodsReceiptItemId: CABLE_LINE, quantity: '2' }]));
		expect(created.status).toBe('draft');
		expect(created.warehouseId).toBe(WAREHOUSE);
		expect(created.totalAmount).toBe(10_000_00);
		const [item] = await returns.findItems(created.id);
		expect(item?.purchaseOrderItemId).toBe(`${CABLE_LINE}-po`);
		expect(item?.unitCost).toBe(5_000_00);
	});

	test('refuses more than the receipt line, counting live returns', async () => {
		await service.create(CREATOR, body([{ goodsReceiptItemId: CABLE_LINE, quantity: '8' }]));
		await expect(service.create(CREATOR, body([{ goodsReceiptItemId: CABLE_LINE, quantity: '3' }]))).rejects.toBeInstanceOf(
			PurchaseReturnLineError,
		);
		const third = await service.create(CREATOR, body([{ goodsReceiptItemId: CABLE_LINE, quantity: '2' }]));
		expect(third.status).toBe('draft');
	});

	test('refuses a receipt without a warehouse and an order without a supplier (ADR-0014)', async () => {
		receiptWarehouse = null;
		await expect(service.create(CREATOR, body([{ goodsReceiptItemId: CABLE_LINE, quantity: '1' }]))).rejects.toMatchObject({
			key: 'procurement.warehouseRequired',
		});
		receiptWarehouse = WAREHOUSE;
		orderSupplier = null;
		await expect(service.create(CREATOR, body([{ goodsReceiptItemId: CABLE_LINE, quantity: '1' }]))).rejects.toMatchObject({
			key: 'procurement.supplierUnavailable',
		});
	});

	test('a cancelled return frees its quantity again', async () => {
		const first = await service.create(CREATOR, body([{ goodsReceiptItemId: CABLE_LINE, quantity: '10' }]));
		await service.cancel(CREATOR, first.id, 'Wrong line');
		const again = await service.create(CREATOR, body([{ goodsReceiptItemId: CABLE_LINE, quantity: '10' }]));
		expect(again.status).toBe('draft');
	});

	test('refuses unknown and repeated lines', async () => {
		await expect(
			service.create(CREATOR, body([{ goodsReceiptItemId: '0190a1b2-0000-7000-8000-0000000000ff', quantity: '1' }])),
		).rejects.toMatchObject({ key: 'procurement.returnLine.unknown' });
		await expect(
			service.create(CREATOR, body([
				{ goodsReceiptItemId: CABLE_LINE, quantity: '1' },
				{ goodsReceiptItemId: CABLE_LINE, quantity: '1' },
			])),
		).rejects.toMatchObject({ key: 'procurement.returnLine.duplicate' });
	});

	test('a serialized line names in-stock serials of this receipt, one per unit', async () => {
		await expect(
			service.create(CREATOR, body([{ goodsReceiptItemId: READER_LINE, quantity: '1', serialNumbers: ['SN-9'] }])),
		).rejects.toMatchObject({ key: 'procurement.returnLine.serials' });
		await expect(
			service.create(CREATOR, body([{ goodsReceiptItemId: READER_LINE, quantity: '2', serialNumbers: ['SN-1'] }])),
		).rejects.toMatchObject({ key: 'procurement.returnLine.serials' });
		inStock = ['SN-2', 'SN-3'];
		await expect(
			service.create(CREATOR, body([{ goodsReceiptItemId: READER_LINE, quantity: '1', serialNumbers: ['SN-1'] }])),
		).rejects.toMatchObject({ key: 'procurement.returnLine.serials' });
		const ok = await service.create(CREATOR, body([{ goodsReceiptItemId: READER_LINE, quantity: '1', serialNumbers: ['SN-2'] }]));
		await expect(
			service.create(CREATOR, body([{ goodsReceiptItemId: READER_LINE, quantity: '1', serialNumbers: ['SN-2'] }])),
		).rejects.toMatchObject({ key: 'procurement.returnLine.serials' });
		expect(ok.status).toBe('draft');
	});

	test('only from a receipt of a received or partly received PO', async () => {
		orderStatus = 'sent';
		await expect(service.create(CREATOR, body([{ goodsReceiptItemId: CABLE_LINE, quantity: '1' }]))).rejects.toBeInstanceOf(
			PurchaseReturnReceiptError,
		);
	});
});

describe('approving a purchase return', () => {
	test('never by its creator', async () => {
		const created = await service.create(CREATOR, body([{ goodsReceiptItemId: CABLE_LINE, quantity: '1' }]));
		await service.submit(CREATOR, created.id);
		await expect(service.decide(CREATOR, created.id, { decision: 'approve' })).rejects.toBeInstanceOf(PurchaseReturnSelfApprovalError);
	});

	test('numbers it and records the document; rejection goes back to draft', async () => {
		const created = await service.create(CREATOR, body([{ goodsReceiptItemId: CABLE_LINE, quantity: '1' }]));
		await service.submit(CREATOR, created.id);
		const rejected = await service.decide(APPROVER, created.id, { decision: 'reject', reason: 'Wrong qty' });
		expect(rejected.status).toBe('draft');
		expect(rejected.rejectionReason).toBe('Wrong qty');
		await service.submit(CREATOR, created.id);
		const ok = await service.decide(APPROVER, created.id, { decision: 'approve' });
		expect(ok.status).toBe('approved');
		expect(ok.code).toBe('0001/RTB/IMS/XI/26');
		expect(documents).toEqual(['register:purchase_return']);
	});
});

describe('shipping a purchase return', () => {
	test('posts return_out, returns the serial units and takes the quantity off the PO', async () => {
		const row = await approved([
			{ goodsReceiptItemId: CABLE_LINE, quantity: '2' },
			{ goodsReceiptItemId: READER_LINE, quantity: '1', serialNumbers: ['SN-3'] },
		]);
		const shipped = await service.ship({ userId: 'user-warehouse', organizationId: 'org-1' }, row.id);
		expect(shipped.status).toBe('shipped');
		expect(movements).toEqual([
			{ movementType: 'return_out', quantity: '2', warehouseId: WAREHOUSE, productId: CABLE },
			{ movementType: 'return_out', quantity: '1', warehouseId: WAREHOUSE, productId: READER },
		]);
		expect(returnedUnits).toEqual(['SN-3']);
		expect(unreceived).toEqual([
			{ purchaseOrderItemId: `${CABLE_LINE}-po`, quantity: '2' },
			{ purchaseOrderItemId: `${READER_LINE}-po`, quantity: '1' },
		]);
		expect((await returns.findItems(row.id)).every((item) => item.movementId)).toBe(true);
		expect(events).toEqual([
			'purchase_return.updated:submitted',
			'purchase_return.updated:approved',
			'purchase_return.updated:shipped',
		]);
	});

	test('a line whose receipt posted no movement (non-stock) moves no stock back', async () => {
		receiptLines[0] = { ...receiptLines[0]!, movementId: null };
		const row = await approved([{ goodsReceiptItemId: CABLE_LINE, quantity: '2' }]);
		const shipped = await service.ship({ userId: 'user-warehouse', organizationId: 'org-1' }, row.id);
		expect(shipped.status).toBe('shipped');
		expect(movements).toEqual([]);
		expect(unreceived).toEqual([{ purchaseOrderItemId: `${CABLE_LINE}-po`, quantity: '2' }]);
	});

	test('fails when a serial left stock after approval', async () => {
		const row = await approved([{ goodsReceiptItemId: READER_LINE, quantity: '1', serialNumbers: ['SN-1'] }]);
		inStock = ['SN-2'];
		await expect(service.ship({ userId: 'user-warehouse', organizationId: 'org-1' }, row.id)).rejects.toMatchObject({
			key: 'procurement.returnLine.notInStock',
		});
	});

	test('only an approved return ships, and a shipped one cannot be cancelled', async () => {
		const draft = await service.create(CREATOR, body([{ goodsReceiptItemId: CABLE_LINE, quantity: '1' }]));
		await expect(service.ship({ userId: 'w', organizationId: 'org-1' }, draft.id)).rejects.toBeInstanceOf(PurchaseReturnStateError);
		const row = await approved([{ goodsReceiptItemId: CABLE_LINE, quantity: '1' }]);
		await service.ship({ userId: 'w', organizationId: 'org-1' }, row.id);
		await expect(service.ship({ userId: 'w', organizationId: 'org-1' }, row.id)).rejects.toBeInstanceOf(PurchaseReturnStateError);
		await expect(service.cancel(CREATOR, row.id, 'late')).rejects.toMatchObject({ key: 'procurement.returnState.notCancellable' });
	});

	test('cancelling an approved return voids its document', async () => {
		const row = await approved([{ goodsReceiptItemId: CABLE_LINE, quantity: '1' }]);
		const cancelled = await service.cancel(CREATOR, row.id, 'Supplier repairs on site');
		expect(cancelled.status).toBe('cancelled');
		expect(documents).toEqual(['register:purchase_return', 'void:purchase_return']);
	});
});
