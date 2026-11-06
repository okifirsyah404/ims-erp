/**
 * Delivery notes (ADR-0011 step 5a): prepared against confirmed / in-progress
 * orders, never more than is open, serials per unit and in stock; shipping
 * posts `issue` movements for stock-tracked lines only, keeps the cost on the
 * line, sells the serial units and moves the order to in progress; only a
 * prepared note is cancelled, giving its quantities back.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	TDeliveryNoteItemSelect,
	TDeliveryNoteSelect,
	TSalesOrderItemSelect,
	TSalesOrderSelect,
} from '@drizzle/schemas/sales.schema';
import { quantityToMilli } from '@ims-erp/common';
import { createDeliveryNoteSchema } from '../../src/app/sales/contracts/delivery-note.contract';
import type { TDeliveryNoteRow } from '../../src/app/sales/contracts/delivery-note.repository.interface';
import {
	DeliveryNoteBinError,
	DeliveryNoteLineError,
	DeliveryNoteOrderNotDeliverableError,
	DeliveryNoteStateError,
} from '../../src/app/sales/errors/delivery-note.errors';
import { DeliveryNoteService } from '../../src/app/sales/services/delivery-note.service';

const SO = '0190a1b2-0000-7000-8000-00000000f001';
const LINE_A = '0190a1b2-0000-7000-8000-00000000f0a1';
const LINE_S = '0190a1b2-0000-7000-8000-00000000f0a2';
const LINE_J = '0190a1b2-0000-7000-8000-00000000f0a3';
const WAREHOUSE = '0190a1b2-0000-7000-8000-00000000e001';

let order: TSalesOrderSelect;
let soItems: TSalesOrderItemSelect[];
let notes: (TDeliveryNoteRow & { items: TDeliveryNoteItemSelect[] })[];
let movements: { itemId: string; quantity: string; movementType: string; referenceType?: string | null }[];
let sold: { itemId: string; serials: readonly string[]; customerId: string | null }[];
let inStock: string[];
let inProgress: number;
let service: DeliveryNoteService;

const allocate = (lines: { salesOrderItemId: string; quantity: string }[], release: boolean) => {
	for (const [index, line] of lines.entries()) {
		const item = soItems.find((row) => row.id === line.salesOrderItemId);
		if (!item) return { ok: false as const, reason: 'notDeliverable' as const, line: index + 1 };
		const total = quantityToMilli(item.quantityDelivered) + (release ? -1n : 1n) * quantityToMilli(line.quantity);
		if (total > quantityToMilli(item.quantity)) return { ok: false as const, reason: 'overDelivered' as const, line: index + 1 };
		item.quantityDelivered = (Number(total) / 1000).toFixed(3);
	}
	return { ok: true as const };
};

beforeEach(() => {
	order = {
		id: SO,
		code: 'SO/IMS/XI/26/001',
		status: 'confirmed',
		title: 'Akses kontrol gedung A',
		attention: 'Pak Budi',
		customerId: 'cust-1',
		customerSnapshot: { code: 'C1', name: 'PT Contoh', type: 'company', email: 'a@b.id', phone: '021', whatsapp: null, taxId: null, addressLine: 'Jl. Satu', postalCode: '15143' },
	} as TSalesOrderSelect;
	soItems = [
		{ id: LINE_A, itemId: 'item-a', sku: 'CBL', name: 'Kabel', unit: 'm', quantity: '100.000', quantityDelivered: '0.000', unitPrice: 15_000 },
		{ id: LINE_S, itemId: 'item-s', sku: 'QR50', name: 'QR50', unit: 'pcs', quantity: '2.000', quantityDelivered: '0.000', unitPrice: 250_000_000 },
		{ id: LINE_J, itemId: null, sku: null, name: 'Jasa instalasi', unit: 'lot', quantity: '1.000', quantityDelivered: '0.000', unitPrice: 500_000_000 },
	] as TSalesOrderItemSelect[];
	notes = [];
	movements = [];
	sold = [];
	inStock = ['SN1', 'SN2', 'SN3'];
	inProgress = 0;
	const findNote = (id: string) => notes.find((row) => row.id === id) ?? null;
	service = new DeliveryNoteService(
		{
			paginate: async () => ({ meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] }),
			findById: async (id: string) => findNote(id),
			findItems: async (id: string) => findNote(id)?.items ?? [],
			hasLiveNotes: async () => false,
			shippedValues: async () => [],
			async create(header, items) {
				const note = {
					...header,
					id: crypto.randomUUID(),
					status: 'prepared',
					salesOrderCode: order.code,
					customerId: order.customerId,
					customerName: 'PT Contoh',
				} as TDeliveryNoteRow;
				const rows = items.map((item) => ({ ...item, id: crypto.randomUUID(), unitCost: null, stockMovementId: null }) as TDeliveryNoteItemSelect);
				notes.push({ ...note, items: rows });
				return { note: note as TDeliveryNoteSelect, items: rows };
			},
			async markShipped(id: string) {
				const note = findNote(id);
				if (!note || note.status !== 'prepared') return null;
				note.status = 'shipped';
				return note;
			},
			async setLineIssue(lineId: string, data: { stockMovementId: string; unitCost: number }) {
				const line = notes.flatMap((note) => note.items).find((row) => row.id === lineId)!;
				Object.assign(line, data);
			},
			async markDelivered(id: string, data: { receiverName: string; receivedAt: Date }) {
				const note = findNote(id);
				if (!note || note.status !== 'shipped') return null;
				Object.assign(note, { status: 'delivered', ...data });
				return note;
			},
			async cancel(id: string) {
				const note = findNote(id);
				if (!note || note.status !== 'prepared') return null;
				note.status = 'cancelled';
				return note;
			},
		},
		{
			findById: async () => order,
			findItems: async () => soItems,
			paginate: async () => ({ meta: { page: 1, limit: 50, total: 1, totalPages: 1 }, data: [order] }),
			allocateDelivery: async (_id, lines, options) => allocate(lines, !!options.release),
			async markInProgress() {
				inProgress += 1;
				order.status = 'in_progress';
			},
		},
		{
			resolveScope: async () => ({ warehouse: {} as never, scopeOrganizationId: null }),
			async postMovement(input) {
				movements.push(input);
				return { movement: { id: `mv-${movements.length}`, unitCost: 7_000 }, balance: {}, scopeOrganizationId: null } as never;
			},
		},
		{
			getItem: async (id: string) => ({ id, isSerialized: id === 'item-s', isStockTracked: true }) as never,
			inStockSerials: async () => inStock,
			async sellUnits(itemId: string, serials: readonly string[], data: { customerId: string | null }) {
				sold.push({ itemId, serials, customerId: data.customerId });
				return serials.filter((serial) => !inStock.includes(serial));
			},
		},
		{ next: async () => '0001/SJ/IMS/XI/26' },
		{ run: async (work) => work({} as never) },
		{
			paginate: async () => ({ meta: { page: 1, limit: 100, total: 1, totalPages: 1 }, data: [{ id: WAREHOUSE, code: 'WH1', name: 'Gudang' }] }) as never,
			getWarehouse: async () => ({ id: WAREHOUSE, code: 'WH1', name: 'Gudang', storages: [] }) as never,
		},
	);
});

const body = (lines: unknown[], extra: Record<string, unknown> = {}) =>
	createDeliveryNoteSchema.parse({ salesOrderId: SO, warehouseId: WAREHOUSE, lines, ...extra });

describe('delivery notes', () => {
	test('prepared: numbered, recipient from the order, quantities allocated', async () => {
		const note = await service.create('wh', body([{ salesOrderItemId: LINE_A, quantity: 40 }, { salesOrderItemId: LINE_J, quantity: 1 }]));
		expect(note).toMatchObject({
			code: '0001/SJ/IMS/XI/26',
			status: 'prepared',
			projectName: 'Akses kontrol gedung A',
			recipientName: 'PT Contoh',
			recipientAddress: 'Jl. Satu 15143',
			recipientPic: 'Pak Budi',
			recipientContact: '021 / a@b.id',
		});
		expect(note.items[0]).toMatchObject({ quantity: '40', unitPrice: 15_000 });
		expect(soItems[0]!.quantityDelivered).toBe('40.000');
		expect(movements).toHaveLength(0);
	});

	test('never more than is open; serials one per unit and in stock; only active orders', async () => {
		await expect(service.create('wh', body([{ salesOrderItemId: LINE_A, quantity: 100.001 }]))).rejects.toBeInstanceOf(DeliveryNoteLineError);
		await expect(service.create('wh', body([{ salesOrderItemId: LINE_S, quantity: 2, serialNumbers: ['SN1'] }]))).rejects.toBeInstanceOf(
			DeliveryNoteLineError,
		);
		await expect(
			service.create('wh', body([{ salesOrderItemId: LINE_S, quantity: 2, serialNumbers: ['SN1', 'SN9'] }])),
		).rejects.toMatchObject({ key: 'sales.deliveryLine.notInStock' });
		await expect(
			service.create('wh', body([{ salesOrderItemId: LINE_A, quantity: 1 }], { binId: crypto.randomUUID() })),
		).rejects.toBeInstanceOf(DeliveryNoteBinError);
		order.status = 'cancelled';
		await expect(service.create('wh', body([{ salesOrderItemId: LINE_A, quantity: 1 }]))).rejects.toBeInstanceOf(
			DeliveryNoteOrderNotDeliverableError,
		);
	});

	test('shipping issues stock-tracked lines at cost, sells serials, order in progress', async () => {
		const note = await service.create(
			'wh',
			body([
				{ salesOrderItemId: LINE_A, quantity: 10 },
				{ salesOrderItemId: LINE_S, quantity: 2, serialNumbers: ['SN1', 'SN2'] },
				{ salesOrderItemId: LINE_J, quantity: 1 },
			]),
		);
		const shipped = await service.ship({ userId: 'wh', organizationId: 'org' }, note.id);
		expect(shipped.status).toBe('shipped');
		expect(movements).toEqual([
			expect.objectContaining({ itemId: 'item-a', movementType: 'issue', quantity: '10', referenceType: 'delivery_note' }),
			expect.objectContaining({ itemId: 'item-s', movementType: 'issue', quantity: '2' }),
		]);
		expect(shipped.items.map((item) => item.unitCost)).toEqual([7_000, 7_000, null]);
		expect(sold).toEqual([{ itemId: 'item-s', serials: ['SN1', 'SN2'], customerId: 'cust-1' }]);
		expect(inProgress).toBe(1);
		await expect(service.ship({ userId: 'wh', organizationId: 'org' }, note.id)).rejects.toBeInstanceOf(DeliveryNoteStateError);
		await expect(service.cancel('wh', note.id, 'x')).rejects.toBeInstanceOf(DeliveryNoteStateError);
		const delivered = await service.deliver(note.id, { receiverName: 'Pak Budi', receivedAt: null });
		expect(delivered).toMatchObject({ status: 'delivered', receiverName: 'Pak Budi' });
	});

	test('a serial sold elsewhere since the note was prepared fails the shipment', async () => {
		const note = await service.create('wh', body([{ salesOrderItemId: LINE_S, quantity: 2, serialNumbers: ['SN1', 'SN2'] }]));
		inStock = ['SN1'];
		await expect(service.ship({ userId: 'wh', organizationId: 'org' }, note.id)).rejects.toMatchObject({
			key: 'sales.deliveryLine.notInStock',
		});
	});

	test('cancelling a prepared note gives its quantities back', async () => {
		const note = await service.create('wh', body([{ salesOrderItemId: LINE_A, quantity: 60 }]));
		expect(soItems[0]!.quantityDelivered).toBe('60.000');
		await service.cancel('wh', note.id, 'salah gudang');
		expect(soItems[0]!.quantityDelivered).toBe('0.000');
		await expect(service.deliver(note.id, { receiverName: 'x', receivedAt: null })).rejects.toBeInstanceOf(DeliveryNoteStateError);
	});

	test('deliverable orders show what is open and which lines are serialized', async () => {
		soItems[0]!.quantityDelivered = '100.000';
		const [first] = await service.deliverableOrders();
		expect(first!.items.find((item) => item.id === LINE_A)).toMatchObject({ openQuantity: '0.000' });
		expect(first!.items.find((item) => item.id === LINE_S)).toMatchObject({ isSerialized: true, openQuantity: '2.000' });
		expect(first!.items.find((item) => item.id === LINE_J)).toMatchObject({ isStockTracked: false });
		expect(first!.customerAddress).toBe('Jl. Satu 15143');
	});
});
