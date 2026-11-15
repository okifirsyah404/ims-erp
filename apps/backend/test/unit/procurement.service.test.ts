/**
 * Procurement (ADR-0011 step 4a): supplier bank details follow
 * supplier:read_bank; purchase orders snapshot supplier and items, compute
 * VAT modes exactly, are numbered on approval with supplier and category,
 * are never approved by their creator, and cannot be cancelled once goods
 * arrived.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	PurchaseOrderStatus,
	SupplierStatus,
	TPurchaseOrderItemSelect,
	TPurchaseOrderSelect,
	TSupplierSelect,
} from '@drizzle/schemas/procurement.schema';
import type {
	IPurchaseOrderRepository,
	ISupplierRepository,
} from '../../src/app/procurement/contracts/procurement.repository.interface';
import { purchaseOrderBodySchema } from '../../src/app/procurement/contracts/purchase-order.contract';
import { createSupplierSchema, updateSupplierSchema } from '../../src/app/procurement/contracts/supplier.contract';
import {
	PurchaseOrderItemUnavailableError,
	PurchaseOrderSelfApprovalError,
	PurchaseOrderStateError,
	PurchaseOrderSupplierUnavailableError,
	SupplierCodeTakenError,
} from '../../src/app/procurement/errors/procurement.errors';
import { PurchaseOrderService } from '../../src/app/procurement/services/purchase-order.service';
import { SupplierService } from '../../src/app/procurement/services/supplier.service';
import { computePoTotals } from '../../src/app/procurement/utils/po-totals';

const ITEM = '0190a1b2-0000-7000-8000-0000000000a1';

class FakeSuppliers implements ISupplierRepository {
	rows: TSupplierSelect[] = [];
	async paginate() {
		return { meta: { page: 1, limit: 20, total: this.rows.length, totalPages: 1 }, data: this.rows };
	}
	async findById(id: string) {
		return this.rows.find((row) => row.id === id) ?? null;
	}
	async findByCode(code: string) {
		return this.rows.find((row) => row.code === code) ?? null;
	}
	async create(data: Parameters<ISupplierRepository['create']>[0]) {
		const row = { bankName: null, bankAccountNumber: null, bankAccountHolder: null, ...data, id: crypto.randomUUID(), status: 'active' } as TSupplierSelect;
		this.rows.push(row);
		return row;
	}
	async update(id: string, patch: object) {
		const row = await this.findById(id);
		return row ? Object.assign(row, patch) : null;
	}
	async transitionStatus(id: string, from: SupplierStatus, to: SupplierStatus) {
		const row = await this.findById(id);
		return row && row.status === from ? Object.assign(row, { status: to }) : null;
	}
}

class FakeOrders implements IPurchaseOrderRepository {
	rows: TPurchaseOrderSelect[] = [];
	items = new Map<string, TPurchaseOrderItemSelect[]>();
	received = new Set<string>();
	async paginate() {
		return { meta: { page: 1, limit: 20, total: this.rows.length, totalPages: 1 }, data: this.rows };
	}
	async findById(id: string) {
		return this.rows.find((row) => row.id === id) ?? null;
	}
	async findItems(id: string) {
		return this.items.get(id) ?? [];
	}
	async create(header: Parameters<IPurchaseOrderRepository['create']>[0], items: Parameters<IPurchaseOrderRepository['create']>[1]) {
		const row = { ...header, id: crypto.randomUUID(), code: null, status: 'draft' } as TPurchaseOrderSelect;
		this.rows.push(row);
		this.items.set(row.id, items as TPurchaseOrderItemSelect[]);
		return row;
	}
	async replaceDraft(id: string, header: object, items: unknown[]) {
		const row = await this.findById(id);
		if (!row || row.status !== 'draft') return null;
		this.items.set(id, items as TPurchaseOrderItemSelect[]);
		return Object.assign(row, header);
	}
	async transition(id: string, from: readonly PurchaseOrderStatus[], to: PurchaseOrderStatus, patch: object) {
		const row = await this.findById(id);
		if (!row || !from.includes(row.status)) return null;
		return Object.assign(row, patch, { status: to });
	}
	async receive() {
		return { ok: false as const, reason: 'notReceivable' as const };
	}
	async unreceive() {
		return { ok: false as const, reason: 'notReturnable' as const };
	}
	async hasReceipts(id: string) {
		return this.received.has(id);
	}
}

const supplierInput = (extra: Record<string, unknown> = {}) =>
	createSupplierSchema.parse({
		code: 'hit',
		supplierType: 'company',
		name: 'PT HIT International',
		picName: 'Ria Nainggolan',
		picTitle: 'Marketing',
		paymentTermNote: 'DP 50%, pelunasan sebelum kirim',
		bankName: 'BCA',
		bankAccountNumber: '123',
		bankAccountHolder: 'PT HIT',
		...extra,
	});

let supplierRepo: FakeSuppliers;
let suppliers: SupplierService;
let orderRepo: FakeOrders;
let orders: PurchaseOrderService;
let numbered: unknown[];
/** Registry calls made by the service (ERP-0044). */
let registered: { code: string; sourceId: string; documentType: string }[];
let voided: string[];

beforeEach(() => {
	supplierRepo = new FakeSuppliers();
	suppliers = new SupplierService(supplierRepo, { getVillage: async () => null });
	orderRepo = new FakeOrders();
	numbered = [];
	registered = [];
	voided = [];
	orders = new PurchaseOrderService(
		orderRepo,
		suppliers,
		{
			getActiveItems: async (ids: string[]) =>
				ids.includes(ITEM)
					? ([{ id: ITEM, sku: 'QR50', name: 'QR50 Mifare', specification: 'Color: Black', unitLabel: 'pcs', purchasePrice: 190_000_000 }] as never)
					: [],
		},
		{
			next: async (_type: string, options?: unknown) => {
				numbered.push(options);
				return 'PO/IMS-HIT/HW/1026/001';
			},
		},
		{
			// ERP-0044: registry side effects are asserted through `registered` / `voided`.
			register: async (input) => {
				registered.push(input);
				return {} as never;
			},
			voidBySource: async (module, sourceType, sourceId) => {
				voided.push(`${module}/${sourceType}/${sourceId}`);
				return 1;
			},
		},
	);
});

describe('suppliers', () => {
	test('codes are upper-case letters and digits, unique', async () => {
		expect(() => supplierInput({ code: 'HI-T' })).toThrow();
		const created = await suppliers.create(supplierInput(), 'purchasing', true);
		expect(created.code).toBe('HIT');
		await expect(suppliers.create(supplierInput(), 'purchasing', true)).rejects.toBeInstanceOf(SupplierCodeTakenError);
	});

	test('bank details are hidden from, and not taken from, callers without read_bank', async () => {
		const created = await suppliers.create(supplierInput(), 'purchasing', true);
		const hidden = await suppliers.get(created.id, false);
		expect(hidden).toMatchObject({ bankName: null, bankAccountNumber: null, bankVisible: false });
		await suppliers.update(created.id, updateSupplierSchema.parse({ bankAccountNumber: '999', phone: '021' }), false);
		expect((await suppliers.get(created.id, true)).bankAccountNumber).toBe('123');
		const blind = await suppliers.create(supplierInput({ code: 'ABC' }), 'warehouse', false);
		expect((await suppliers.get(blind.id, true)).bankName).toBeNull();
	});
});

describe('purchase order totals', () => {
	test('VAT none / added / included, half-up', () => {
		expect(computePoTotals([132_300_000_00], 'none', 0)).toMatchObject({ taxTotal: 0, grandTotal: 132_300_000_00 });
		expect(computePoTotals([100_00], 'added', 1100)).toMatchObject({ taxBase: 100_00, taxTotal: 11_00, grandTotal: 111_00 });
		expect(computePoTotals([111_00], 'included', 1100)).toMatchObject({ taxBase: 100_00, taxTotal: 11_00, grandTotal: 111_00 });
	});
});

describe('purchase orders', () => {
	const body = (supplierId: string, extra: Record<string, unknown> = {}) =>
		purchaseOrderBodySchema.parse({
			supplierId,
			category: 'hardware',
			subject: 'Pembelian Hardware',
			orderDate: '2026-10-28',
			vatMode: 'included',
			lines: [{ itemId: ITEM, quantity: 33 }],
			...extra,
		});

	test('snapshots supplier and item, prices default to the purchase price, payment line from the supplier', async () => {
		const supplier = await suppliers.create(supplierInput(), 'purchasing', true);
		const order = await orders.create('purchasing', body(supplier.id));
		expect(order).toMatchObject({ status: 'draft', code: null, subtotal: 6_270_000_000, grandTotal: 6_270_000_000, vatRateBps: 1100 });
		expect(order.supplierSnapshot).toMatchObject({ code: 'HIT', picName: 'Ria Nainggolan', picTitle: 'Marketing' });
		expect(order.paymentTerms).toBe('DP 50%, pelunasan sebelum kirim');
		const [line] = await orderRepo.findItems(order.id);
		expect(line).toMatchObject({ sku: 'QR50', unitPrice: 190_000_000, lineTotal: 6_270_000_000 });
	});

	test('an inactive supplier or an unknown item is refused', async () => {
		const supplier = await suppliers.create(supplierInput(), 'purchasing', true);
		await expect(orders.create('purchasing', body(supplier.id, { lines: [{ itemId: crypto.randomUUID(), quantity: 1 }] }))).rejects.toBeInstanceOf(
			PurchaseOrderItemUnavailableError,
		);
		await suppliers.setActive(supplier.id, false, true);
		await expect(orders.create('purchasing', body(supplier.id))).rejects.toBeInstanceOf(PurchaseOrderSupplierUnavailableError);
	});

	test('submit, reject back to draft, approve with number — never by the creator', async () => {
		const supplier = await suppliers.create(supplierInput(), 'purchasing', true);
		const order = await orders.create('purchasing', body(supplier.id));
		await orders.submit('purchasing', order.id);
		await expect(orders.update(order.id, body(supplier.id))).rejects.toBeInstanceOf(PurchaseOrderStateError);
		await expect(orders.decide('purchasing', order.id, { decision: 'approve' })).rejects.toBeInstanceOf(PurchaseOrderSelfApprovalError);
		const rejected = await orders.decide('owner', order.id, { decision: 'reject', reason: 'Harga terlalu tinggi' });
		expect(rejected).toMatchObject({ status: 'draft', rejectionReason: 'Harga terlalu tinggi' });
		await orders.submit('purchasing', order.id);
		const approved = await orders.decide('owner', order.id, { decision: 'approve' });
		expect(approved).toMatchObject({ status: 'approved', code: 'PO/IMS-HIT/HW/1026/001', approvedBy: 'owner' });
		expect(numbered[0]).toMatchObject({ context: { supplier: 'HIT', category: 'HW' } });
		// ERP-0044: approval registers the PO with the code just allocated.
		expect(registered).toEqual([
			expect.objectContaining({ code: 'PO/IMS-HIT/HW/1026/001', documentType: 'purchase_order', sourceId: order.id }),
		]);
		expect((await orders.markSent('purchasing', order.id)).status).toBe('sent');
	});

	test('cancel needs nothing received', async () => {
		const supplier = await suppliers.create(supplierInput(), 'purchasing', true);
		const order = await orders.create('purchasing', body(supplier.id));
		orderRepo.received.add(order.id);
		await expect(orders.cancel('owner', order.id, 'x')).rejects.toBeInstanceOf(PurchaseOrderStateError);
		orderRepo.received.clear();
		expect((await orders.cancel('owner', order.id, 'Salah pemasok')).status).toBe('cancelled');
		// ERP-0044: a cancelled PO is voided in the registry.
		expect(voided).toEqual([`procurement/purchase_order/${order.id}`]);
		await expect(orders.cancel('owner', order.id, 'lagi')).rejects.toBeInstanceOf(PurchaseOrderStateError);
	});
});
