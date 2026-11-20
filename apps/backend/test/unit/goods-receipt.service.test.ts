/**
 * Goods receipts (ADR-0011 step 4b): only sent / partly received POs, never
 * more than is open, serials per unit, one unit of work posting the receipt,
 * the PO progress, the stock movements at ex-VAT cost and the serial units.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	TGoodsReceiptItemSelect,
	TGoodsReceiptSelect,
	TPurchaseOrderItemSelect,
	TPurchaseOrderSelect,
} from '@drizzle/schemas/procurement.schema';
import { quantityToMilli } from '@utils/money.util';
import { createGoodsReceiptSchema } from '../../src/app/procurement/contracts/goods-receipt.contract';
import { GoodsReceiptBinError, GoodsReceiptLineError, GoodsReceiptOrderNotReceivableError } from '../../src/app/procurement/errors/procurement.errors';
import { GoodsReceiptService } from '../../src/app/procurement/services/goods-receipt.service';

const PO = '0190a1b2-0000-7000-8000-00000000d001';
const LINE_A = '0190a1b2-0000-7000-8000-00000000d0a1';
const LINE_S = '0190a1b2-0000-7000-8000-00000000d0a2';
const WAREHOUSE = '0190a1b2-0000-7000-8000-00000000e001';

let order: TPurchaseOrderSelect;
let poItems: TPurchaseOrderItemSelect[];
let receipts: (TGoodsReceiptSelect & { items: TGoodsReceiptItemSelect[] })[];
let movements: { unitCost?: number | null; quantity: string; referenceType?: string | null }[];
let units: { serialNumber?: string; purchaseOrderLineId?: string | null; movementId?: string | null }[];
let committed: boolean;
/** Registry calls made by the service (ERP-0044). */
let registered: { code: string; sourceId: string }[];
let service: GoodsReceiptService;

beforeEach(() => {
	order = { id: PO, code: 'PO/IMS-HIT/HW/1126/001', status: 'sent', vatMode: 'included', vatRateBps: 1100, supplierSnapshot: { name: 'PT HIT' } } as TPurchaseOrderSelect;
	poItems = [
		{ id: LINE_A, productId: 'item-a', sku: 'CBL', name: 'Kabel', unit: 'm', quantity: '100.000', quantityReceived: '0.000', unitPrice: 11_100 },
		{ id: LINE_S, productId: 'item-s', sku: 'QR50', name: 'QR50', unit: 'pcs', quantity: '2.000', quantityReceived: '0.000', unitPrice: 190_000_000 },
	] as TPurchaseOrderItemSelect[];
	receipts = [];
	movements = [];
	units = [];
	committed = false;
	registered = [];
	service = new GoodsReceiptService(
		{
			async paginate() {
				return { meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] };
			},
			async findById(id: string) {
				const found = receipts.find((row) => row.id === id);
				return found ? ({ ...found, purchaseOrderCode: order.code, supplierName: 'PT HIT' } as never) : null;
			},
			async findItems(id: string) {
				return receipts.find((row) => row.id === id)?.items ?? [];
			},
			async create(header, items) {
				const receipt = { ...header, id: crypto.randomUUID(), status: 'posted' } as TGoodsReceiptSelect;
				const rows = items.map((item) => ({ ...item, id: crypto.randomUUID() }) as TGoodsReceiptItemSelect);
				receipts.push({ ...receipt, items: rows });
				return { receipt, items: rows };
			},
			async setMovement() {},
		},
		{
			findById: async () => order,
			findItems: async () => poItems,
			paginate: async () => ({ meta: { page: 1, limit: 50, total: 1, totalPages: 1 }, data: [order] }),
			async receive(_id: string, lines: { purchaseOrderItemId: string; quantity: string }[]) {
				for (const line of lines) {
					const item = poItems.find((row) => row.id === line.purchaseOrderItemId)!;
					const total = quantityToMilli(item.quantityReceived) + quantityToMilli(line.quantity);
					if (total > quantityToMilli(item.quantity)) return { ok: false as const, reason: 'overReceived' as const, line: 1 };
					item.quantityReceived = (Number(total) / 1000).toFixed(3);
				}
				const done = poItems.every((item) => quantityToMilli(item.quantityReceived) >= quantityToMilli(item.quantity));
				order.status = done ? 'received' : 'partially_received';
				return { ok: true as const, order };
			},
		},
		{
			resolveScope: async () => ({ warehouse: {} as never, scopeOrganizationId: null }),
			async postMovement(input) {
				movements.push(input);
				return { movement: { id: `mv-${movements.length}` }, balance: {}, scopeOrganizationId: null } as never;
			},
		},
		{
			getProduct: async (id: string) => ({ id, isSerialized: id === 'item-s', organizationId: null }) as never,
		},
		{
			/** ADR-0026: unit registration stayed in `inventory`. */
			async registerUnit(_itemId: string, data: (typeof units)[number]) {
				units.push(data);
				return {} as never;
			},
		},
		{ next: async () => '0001/BPB/IMS/XI/26' },
		{
			async run(work) {
				const result = await work({} as never);
				committed = true;
				return result;
			},
		},
		{
			paginate: async () => ({ meta: { page: 1, limit: 100, total: 1, totalPages: 1 }, data: [{ id: WAREHOUSE, code: 'WH1', name: 'Gudang' }] }) as never,
			getWarehouse: async () => ({ id: WAREHOUSE, code: 'WH1', name: 'Gudang', storages: [] }) as never,
		},
		{
			// ERP-0044: registry side effect is asserted through `registered`.
			register: async (input) => {
				registered.push(input);
				return {} as never;
			},
		},
	);
});

const body = (lines: unknown[]) => createGoodsReceiptSchema.parse({ purchaseOrderId: PO, warehouseId: WAREHOUSE, lines });

describe('goods receipts', () => {
	test('partial receipt: stock at ex-VAT cost, PO partly received, one transaction', async () => {
		const receipt = await service.create({ userId: 'wh', organizationId: 'org' }, body([{ purchaseOrderItemId: LINE_A, quantity: '40.5' }]));
		expect(receipt.code).toBe('0001/BPB/IMS/XI/26');
		expect(receipt.items[0]).toMatchObject({ quantity: '40.5', unitCost: 10_000 });
		expect(movements).toEqual([expect.objectContaining({ movementType: 'receipt', quantity: '40.5', unitCost: 10_000, referenceType: 'goods_receipt' })]);
		expect(order.status).toBe('partially_received');
		expect(committed).toBe(true);
		// ERP-0044: the BPB is registered with its own code.
		expect(registered).toEqual([
			expect.objectContaining({
				code: '0001/BPB/IMS/XI/26',
				documentType: 'goods_receipt',
				sourceType: 'goods_receipt',
				sourceId: receipt.id,
			}),
		]);
	});

	test('serialized items need one unique serial per unit and become in-stock units', async () => {
		await expect(
			service.create({ userId: 'wh', organizationId: 'org' }, body([{ purchaseOrderItemId: LINE_S, quantity: 2, serialNumbers: ['SN1'] }])),
		).rejects.toBeInstanceOf(GoodsReceiptLineError);
		await expect(
			service.create({ userId: 'wh', organizationId: 'org' }, body([{ purchaseOrderItemId: LINE_S, quantity: 2, serialNumbers: ['SN1', 'SN1'] }])),
		).rejects.toBeInstanceOf(GoodsReceiptLineError);
		await service.create(
			{ userId: 'wh', organizationId: 'org' },
			body([
				{ purchaseOrderItemId: LINE_S, quantity: 2, serialNumbers: ['SN1', 'SN2'] },
				{ purchaseOrderItemId: LINE_A, quantity: 100 },
			]),
		);
		expect(units).toEqual([
			expect.objectContaining({ serialNumber: 'SN1', status: 'in_stock', purchaseOrderLineId: LINE_S, movementId: 'mv-1' }),
			expect.objectContaining({ serialNumber: 'SN2', movementId: 'mv-1' }),
		]);
		expect(order.status).toBe('received');
	});

	test('never more than is open; only sent or partly received POs', async () => {
		await expect(
			service.create({ userId: 'wh', organizationId: 'org' }, body([{ purchaseOrderItemId: LINE_A, quantity: 100.001 }])),
		).rejects.toBeInstanceOf(GoodsReceiptLineError);
		await expect(
			service.create({ userId: 'wh', organizationId: 'org' }, body([{ purchaseOrderItemId: crypto.randomUUID(), quantity: 1 }])),
		).rejects.toBeInstanceOf(GoodsReceiptLineError);
		order.status = 'approved';
		await expect(
			service.create({ userId: 'wh', organizationId: 'org' }, body([{ purchaseOrderItemId: LINE_A, quantity: 1 }])),
		).rejects.toBeInstanceOf(GoodsReceiptOrderNotReceivableError);
		expect(movements).toHaveLength(0);
	});

	test('a storage of another warehouse is refused; the detail names the warehouse', async () => {
		await expect(
			service.create(
				{ userId: 'wh', organizationId: 'org' },
				createGoodsReceiptSchema.parse({ purchaseOrderId: PO, warehouseId: WAREHOUSE, binId: crypto.randomUUID(), lines: [{ purchaseOrderItemId: LINE_A, quantity: 1 }] }),
			),
		).rejects.toBeInstanceOf(GoodsReceiptBinError);
		const receipt = await service.create({ userId: 'wh', organizationId: 'org' }, body([{ purchaseOrderItemId: LINE_A, quantity: 1 }]));
		expect(receipt.warehouse).toEqual({ code: 'WH1', name: 'Gudang' });
		expect(await service.receivingWarehouses()).toEqual([{ id: WAREHOUSE, code: 'WH1', name: 'Gudang', storages: [] }]);
	});

	test('receivable orders show what is still open per line', async () => {
		poItems[0]!.quantityReceived = '60.000';
		const [first] = await service.receivableOrders();
		expect(first!.items.find((item) => item.id === LINE_A)).toMatchObject({ openQuantity: '40.000', isSerialized: false });
		expect(first!.items.find((item) => item.id === LINE_S)).toMatchObject({ isSerialized: true });
	});
});
