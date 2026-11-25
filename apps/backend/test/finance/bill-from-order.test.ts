/**
 * Supplier bills from a purchase order (ERP-0012): lines at the order price
 * and VAT, never more than received minus what live bills hold, and
 * recording clears GR/IR for stock lines (ERP-0136) and debits expense for the rest.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TSupplierBillItemSelect, TSupplierBillSelect } from '@drizzle/schemas/finance.schema';
import { quantityToMilli } from '@utils/money.util';
import { SupplierBillService } from '../../src/app/finance/services/supplier-bill.service';
import { PurchaseBillingService, type TBillableOrder } from '../../src/app/procurement/services/purchase-billing.service';

const ORDER = '0190a1b2-0000-7000-8000-0000000000d1';
const READER = '0190a1b2-0000-7000-8000-0000000000c1';
const INSTALL = '0190a1b2-0000-7000-8000-0000000000c2';
const ctx = { organizationId: 'org-1', actorUserId: 'finance-1' };

let order: TBillableOrder;
let bills: Map<string, TSupplierBillSelect>;
let items: TSupplierBillItemSelect[];
let posted: { role: string; debit: number; credit: number }[];
let events: { topic: string; data: Record<string, unknown>; dedupeKey?: string }[];
let openBills: TSupplierBillSelect[];
let service: SupplierBillService;
const pricing = new PurchaseBillingService({} as never, {} as never);

beforeEach(() => {
	order = {
		id: ORDER,
		code: 'PO/IMS-HIT/HW/1126/001',
		subject: 'Reader',
		status: 'received',
		supplierCompanyId: 'supplier-1',
		supplierName: 'PT HIT',
		vatMode: 'added',
		vatRateBps: 1100,
		lines: [
			{ id: READER, productId: 'item-reader', sku: 'RDR', name: 'Reader', unit: 'pcs', unitPrice: 1_000_000_00, quantityReceived: '3.000', isStock: true, receivedUnitCost: 1_000_000_00 },
			{ id: INSTALL, productId: 'item-install', sku: 'JS', name: 'Instalasi', unit: 'ls', unitPrice: 500_000_00, quantityReceived: '1.000', isStock: false, receivedUnitCost: 0 },
		],
	};
	bills = new Map();
	items = [];
	posted = [];
	events = [];
	openBills = [];
	const repo = {
		async billedQuantities(ids: string[]) {
			const map = new Map<string, bigint>();
			for (const item of items) {
				const bill = bills.get(item.supplierBillId);
				if (!bill || bill.status === 'void' || !ids.includes(item.purchaseOrderItemId!)) continue;
				map.set(item.purchaseOrderItemId!, (map.get(item.purchaseOrderItemId!) ?? 0n) + quantityToMilli(item.quantity));
			}
			return map;
		},
		async lockPurchaseOrderBilling() {},
		async insertSupplierBill(row: Record<string, unknown>) {
			const bill = { ...row, id: crypto.randomUUID() } as TSupplierBillSelect;
			bills.set(bill.id, bill);
			return bill;
		},
		async insertSupplierBillItems(rows: Record<string, unknown>[]) {
			const created = rows.map((row) => ({ ...row, id: crypto.randomUUID() }) as unknown as TSupplierBillItemSelect);
			items.push(...created);
			return created;
		},
		async findSupplierBillItems(_org: string, billId: string) {
			return items.filter((item) => item.supplierBillId === billId);
		},
		async findSupplierBillById(_org: string, id: string) {
			return bills.get(id) ?? null;
		},
		async updateSupplierBill(_org: string, id: string, patch: object) {
			const bill = bills.get(id);
			return bill ? Object.assign(bill, patch) : null;
		},
		async insertApOpenItem() {},
		async listOpenBillsDueBy() {
			return openBills;
		},
	};
	service = new SupplierBillService(
		{ transaction: async (work: (tx: never) => Promise<unknown>) => work({} as never) } as never,
		repo as never,
		repo as never,
		repo as never,
		{
			postBusinessEvent: async (_tx: unknown, entry: { lines: { role: string; debit: number; credit: number }[] }) => {
				posted.push(...entry.lines.map((line) => ({ role: line.role, debit: line.debit, credit: line.credit })));
				return { entry: { id: 'je' }, lines: [], replayed: false };
			},
		} as never,
		{
			resolveAllBill: async () => ({ ap: 'acc-ap', expense: 'acc-expense', taxInput: 'acc-tax' }),
			resolve: async (_org: string, role: string) => `acc-${role}`,
		} as never,
		{ next: async () => 'SB-0001' } as never,
		{
			getBillableOrder: async (id: string) => (id === ORDER ? order : null),
			listBillableOrders: async () => [order],
			priceLines: (o: Pick<TBillableOrder, 'vatMode' | 'vatRateBps'>, lines: { quantity: string; unitPrice: number }[]) => pricing.priceLines(o, lines),
		},
		{
			publish: async (topic: string, _aggregate: unknown, data: Record<string, unknown>, options?: { dedupeKey?: string }) => {
				events.push({ topic, data, dedupeKey: options?.dedupeKey });
				return {} as never;
			},
		} as never,
		{ assertActiveCompany: async () => ({ id: 'supplier-1', code: 'HIT', name: 'PT HIT', phone: '021', email: 'ap@hit.test' }) } as never,
	);
});

const input = (lines: { purchaseOrderItemId: string; quantity: string }[]) => ({
	purchaseOrderId: ORDER,
	supplierInvoiceNumber: 'INV/HIT/0099',
	billDate: '2026-11-16',
	dueDate: '2026-12-16',
	lines,
});

describe('pricing bill lines like the order', () => {
	test('VAT added on top', () => {
		const priced = pricing.priceLines({ vatMode: 'added', vatRateBps: 1100 }, [{ quantity: '2', unitPrice: 1_000_000_00 }]);
		expect(priced).toEqual({ lines: [{ lineTotal: 2_000_000_00, taxBase: 2_000_000_00 }], subtotal: 2_000_000_00, taxTotal: 220_000_00, grandTotal: 2_220_000_00 });
	});

	test('VAT included: line tax bases add up to the DPP exactly', () => {
		const priced = pricing.priceLines({ vatMode: 'included', vatRateBps: 1100 }, [
			{ quantity: '1', unitPrice: 1_110_000_00 },
			{ quantity: '3', unitPrice: 333_333 },
		]);
		expect(priced.lines.reduce((sum, line) => sum + line.taxBase, 0)).toBe(priced.subtotal);
		expect(priced.subtotal + priced.taxTotal).toBe(priced.grandTotal);
		expect(priced.grandTotal).toBe(1_110_000_00 + 999_999);
	});
});

describe('drafting a bill from a purchase order', () => {
	test('copies the supplier, the invoice number and prices the lines', async () => {
		const bill = await service.createFromPurchaseOrder(ctx, input([{ purchaseOrderItemId: READER, quantity: '2' }]));
		expect(bill.supplierCompanyId).toBe('supplier-1');
		expect(bill.purchaseOrderId).toBe(ORDER);
		expect(bill.supplierInvoiceNumber).toBe('INV/HIT/0099');
		expect(bill.subtotal).toBe(2_000_000_00);
		expect(bill.taxTotal).toBe(220_000_00);
		expect(bill.items[0]).toMatchObject({ quantity: '2', isStock: true, taxBase: 2_000_000_00 });
	});

	test('never bills more than received minus live bills; a void bill frees its quantity', async () => {
		const first = await service.createFromPurchaseOrder(ctx, input([{ purchaseOrderItemId: READER, quantity: '2' }]));
		await expect(service.createFromPurchaseOrder(ctx, input([{ purchaseOrderItemId: READER, quantity: '2' }]))).rejects.toMatchObject({
			key: 'accounting.billLine.over',
		});
		await service.cancel(ctx, first.id);
		const again = await service.createFromPurchaseOrder(ctx, input([{ purchaseOrderItemId: READER, quantity: '3' }]));
		expect(again.items[0]?.quantity).toBe('3');
	});

	test('refuses unknown and repeated lines, and orders that received nothing', async () => {
		await expect(
			service.createFromPurchaseOrder(ctx, input([{ purchaseOrderItemId: '0190a1b2-0000-7000-8000-0000000000ff', quantity: '1' }])),
		).rejects.toMatchObject({ key: 'accounting.billLine.unknown' });
		await expect(
			service.createFromPurchaseOrder(ctx, input([
				{ purchaseOrderItemId: READER, quantity: '1' },
				{ purchaseOrderItemId: READER, quantity: '1' },
			])),
		).rejects.toMatchObject({ key: 'accounting.billLine.duplicate' });
		await expect(
			service.createFromPurchaseOrder(ctx, { ...input([{ purchaseOrderItemId: READER, quantity: '1' }]), purchaseOrderId: '0190a1b2-0000-7000-8000-0000000000aa' }),
		).rejects.toMatchObject({ key: 'accounting.billOrderNotBillable' });
	});

	test('the billable view shows what is left per line', async () => {
		await service.createFromPurchaseOrder(ctx, input([{ purchaseOrderItemId: READER, quantity: '1' }]));
		const [view] = await service.billableOrders();
		expect(view?.lines.map((line) => [line.quantityBilled, line.quantityBillable])).toEqual([
			['1.000', '2.000'],
			['0.000', '1.000'],
		]);
	});
});

describe('recording a bill made from an order', () => {
	test('clears GR/IR for stock lines (ERP-0136), expense for the rest, input tax, credits AP', async () => {
		const bill = await service.createFromPurchaseOrder(
			ctx,
			input([
				{ purchaseOrderItemId: READER, quantity: '3' },
				{ purchaseOrderItemId: INSTALL, quantity: '1' },
			]),
		);
		await service.record(ctx, bill.id);
		expect(posted).toEqual([
			{ role: 'grir_clearing', debit: 3_000_000_00, credit: 0 },
			{ role: 'expense', debit: 500_000_00, credit: 0 },
			{ role: 'vat_input', debit: 385_000_00, credit: 0 },
			{ role: 'payable', debit: 0, credit: 3_885_000_00 },
		]);
	});
});

describe('purchase price variance (ERP-0136)', () => {
	test('a bill above the receipt cost debits PPV for the difference', async () => {
		const reader = order.lines[0]!;
		const original = reader.receivedUnitCost;
		reader.receivedUnitCost = 900_000_00;
		try {
			const bill = await service.createFromPurchaseOrder(ctx, input([{ purchaseOrderItemId: READER, quantity: '2' }]));
			await service.record(ctx, bill.id);
			expect(posted).toEqual([
				{ role: 'grir_clearing', debit: 1_800_000_00, credit: 0 },
				{ role: 'purchase_price_variance', debit: 200_000_00, credit: 0 },
				{ role: 'vat_input', debit: 220_000_00, credit: 0 },
				{ role: 'payable', debit: 0, credit: 2_220_000_00 },
			]);
		} finally {
			reader.receivedUnitCost = original;
		}
	});
});

describe('n8n events (ERP-0012)', () => {
	test('recording publishes supplier_bill.recorded with the supplier contact', async () => {
		const bill = await service.createFromPurchaseOrder(ctx, input([{ purchaseOrderItemId: READER, quantity: '1' }]));
		await service.record(ctx, bill.id);
		expect(events.map((event) => event.topic)).toEqual(['supplier_bill.recorded']);
		expect(events[0]?.data).toMatchObject({ code: 'SB-0001', supplierInvoiceNumber: 'INV/HIT/0099', supplier: { name: 'PT HIT', phone: '021' } });
	});

	test('the daily job reminds 7 days ahead and on/after the due date, once per threshold', async () => {
		const bill = (dueDate: string) => ({ id: `bill-${dueDate}`, supplierCompanyId: 'supplier-1', dueDate, status: 'approved', outstandingTotal: 100 }) as unknown as TSupplierBillSelect;
		openBills = [bill('2026-11-20'), bill('2026-11-16'), bill('2026-11-10'), bill('2026-11-30')];
		const result = await service.publishDueNotices('2026-11-16');
		expect(result).toEqual({ processed: 3, skipped: 1 });
		expect(events.map((event) => [event.data.threshold, event.data.stage, event.dedupeKey])).toEqual([
			[7, 'upcoming', 'supplier_bill.due:bill-2026-11-20:2026-11-20:7'],
			[0, 'due', 'supplier_bill.due:bill-2026-11-16:2026-11-16:0'],
			[0, 'overdue', 'supplier_bill.due:bill-2026-11-10:2026-11-10:0'],
		]);
	});
});
