/**
 * Supplier bills from a purchase order (ERP-0012): lines at the order price
 * and VAT, never more than received minus what live bills hold, and
 * recording debits inventory for stock lines and expense for the rest.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TSupplierBillItemSelect, TSupplierBillSelect } from '@drizzle/schemas/finance.schema';
import { quantityToMilli } from '@utils/money.util';
import { SupplierBillService } from '../../src/app/accounting/services/supplier-bill.service';
import { PurchaseBillingService, type TBillableOrder } from '../../src/app/procurement/services/purchase-billing.service';

const ORDER = '0190a1b2-0000-7000-8000-0000000000d1';
const READER = '0190a1b2-0000-7000-8000-0000000000c1';
const INSTALL = '0190a1b2-0000-7000-8000-0000000000c2';
const ctx = { organizationId: 'org-1', actorUserId: 'finance-1' };

let order: TBillableOrder;
let bills: Map<string, TSupplierBillSelect>;
let items: TSupplierBillItemSelect[];
let posted: { accountId: string; debit: number; credit: number }[];
let service: SupplierBillService;
const pricing = new PurchaseBillingService({} as never, {} as never);

beforeEach(() => {
	order = {
		id: ORDER,
		code: 'PO/IMS-HIT/HW/1126/001',
		subject: 'Reader',
		status: 'received',
		supplierId: 'supplier-1',
		supplierName: 'PT HIT',
		vatMode: 'added',
		vatRateBps: 1100,
		lines: [
			{ id: READER, itemId: 'item-reader', sku: 'RDR', name: 'Reader', unit: 'pcs', unitPrice: 1_000_000_00, quantityReceived: '3.000', isStock: true },
			{ id: INSTALL, itemId: 'item-install', sku: 'JS', name: 'Instalasi', unit: 'ls', unitPrice: 500_000_00, quantityReceived: '1.000', isStock: false },
		],
	};
	bills = new Map();
	items = [];
	posted = [];
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
	};
	service = new SupplierBillService(
		{ transaction: async (work: (tx: never) => Promise<unknown>) => work({} as never) } as never,
		repo as never,
		{
			post: async (_tx: unknown, entry: { lines: { accountId: string; debit: number; credit: number }[] }) => {
				posted.push(...entry.lines);
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
		expect(bill.supplierId).toBe('supplier-1');
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
	test('debits inventory for stock lines, expense for the rest, input tax, credits AP', async () => {
		const bill = await service.createFromPurchaseOrder(
			ctx,
			input([
				{ purchaseOrderItemId: READER, quantity: '3' },
				{ purchaseOrderItemId: INSTALL, quantity: '1' },
			]),
		);
		await service.record(ctx, bill.id);
		expect(posted).toEqual([
			{ accountId: 'acc-inventory', debit: 3_000_000_00, credit: 0 },
			{ accountId: 'acc-expense', debit: 500_000_00, credit: 0 },
			{ accountId: 'acc-tax', debit: 385_000_00, credit: 0 },
			{ accountId: 'acc-ap', debit: 0, credit: 3_885_000_00 },
		]);
	});
});
