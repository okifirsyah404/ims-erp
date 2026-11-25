/**
 * Procurement (ADR-0011 step 4a): purchase orders snapshot supplier and items, compute
 * VAT modes exactly, are numbered on approval with supplier and category,
 * are never approved by their creator, and cannot be cancelled once goods
 * arrived.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	PurchaseOrderStatus,
	TPurchaseOrderItemSelect,
	TPurchaseOrderSelect,
} from '@drizzle/schemas/procurement.schema';
import type { TSupplierCompanySelect, TSupplierSelect } from '@drizzle/schemas/supplier.schema';
import type { IPurchaseOrderRepository } from '../../src/app/procurement/contracts/procurement.repository.interface';
import type { TPurchaseOrderWrite } from '../../src/app/procurement/contracts/procurement.repository.interface';
import { purchaseOrderBodySchema } from '../../src/app/procurement/contracts/purchase-order.contract';
import {
	PurchaseOrderItemUnavailableError,
	PurchaseOrderSelfApprovalError,
	PurchaseOrderStateError,
	PurchaseRequestLineUnavailableError,
	PurchaseOrderSupplierUnavailableError,
} from '../../src/app/procurement/errors/procurement.errors';
import { PurchaseOrderService } from '../../src/app/procurement/services/purchase-order.service';
import { computePoTotals } from '../../src/app/procurement/utils/po-totals';

const ITEM = '0190a1b2-0000-7000-8000-0000000000a1';

/** Fake of the supplier module's repository-only export facade. */
class FakeSuppliers {
	companies: TSupplierCompanySelect[] = [];
	people: TSupplierSelect[] = [];
	addCompany(extra: Partial<TSupplierCompanySelect> = {}): TSupplierCompanySelect {
		const row = {
			id: crypto.randomUUID(),
			code: 'HIT',
			name: 'PT HIT International',
			legalName: null,
			taxId: null,
			phone: null,
			email: null,
			paymentTermNote: 'DP 50%, pelunasan sebelum kirim',
			status: 'active',
			...extra,
		} as TSupplierCompanySelect;
		this.companies.push(row);
		return row;
	}
	addPerson(companyId: string): TSupplierSelect {
		const row = {
			id: crypto.randomUUID(),
			companyId,
			name: 'Ria Nainggolan',
			title: 'Marketing',
			phone: null,
			email: null,
		} as TSupplierSelect;
		this.people.push(row);
		return row;
	}
	async assertActiveCompany(id: string) {
		const row = this.companies.find((company) => company.id === id);
		if (!row) throw new PurchaseOrderSupplierUnavailableError();
		return row;
	}
	async findPerson(id: string) {
		return this.people.find((person) => person.id === id) ?? null;
	}
	async getPurchaseSnapshot(companyId: string) {
		const company = await this.assertActiveCompany(companyId);
		return {
			code: company.code,
			name: company.name,
			address: null,
			taxId: company.taxId,
			phone: company.phone,
			email: company.email,
			picName: null,
			picTitle: null,
			picPhone: null,
			picEmail: null,
		};
	}
}

class FakeOrders implements IPurchaseOrderRepository {
	async listOpenForProject(): Promise<Array<{ id: string; subtotal: number }>> {
		return [];
	}
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
	async create(header: Parameters<IPurchaseOrderRepository['create']>[0], items: Parameters<IPurchaseOrderRepository['create']>[1]): Promise<TPurchaseOrderWrite> {
		const row = { ...header, id: crypto.randomUUID(), code: null, status: 'draft' } as TPurchaseOrderSelect;
		this.rows.push(row);
		this.items.set(row.id, items as TPurchaseOrderItemSelect[]);
		return { ok: true as const, order: row };
	}
	async replaceDraft(id: string, header: object, items: unknown[]) {
		const row = await this.findById(id);
		if (!row || row.status !== 'draft') return { ok: false as const, reason: 'notDraft' as const };
		this.items.set(id, items as TPurchaseOrderItemSelect[]);
		return { ok: true as const, order: Object.assign(row, header) };
	}
	async findItemRequests() {
		return [];
	}
	synced: string[] = [];
	async syncRequestsOfOrder(id: string) {
		this.synced.push(id);
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

let suppliers: FakeSuppliers;
let orderRepo: FakeOrders;
let orders: PurchaseOrderService;
let numbered: unknown[];
/** Registry calls made by the service (ERP-0044). */
let registered: { code: string; sourceId: string; documentType: string }[];
let voided: string[];

beforeEach(() => {
	suppliers = new FakeSuppliers();
	orderRepo = new FakeOrders();
	numbered = [];
	registered = [];
	voided = [];
	orders = new PurchaseOrderService(
		orderRepo,
		suppliers,
		{
			getActiveProducts: async (ids: string[]) =>
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

describe('purchase order totals', () => {
	test('VAT none / added / included, half-up', () => {
		expect(computePoTotals([132_300_000_00], 'none', 0)).toMatchObject({ taxTotal: 0, grandTotal: 132_300_000_00 });
		expect(computePoTotals([100_00], 'added', 1100)).toMatchObject({ taxBase: 100_00, taxTotal: 11_00, grandTotal: 111_00 });
		expect(computePoTotals([111_00], 'included', 1100)).toMatchObject({ taxBase: 100_00, taxTotal: 11_00, grandTotal: 111_00 });
	});
});

describe('purchase orders', () => {
	const body = (supplierCompanyId: string, extra: Record<string, unknown> = {}) =>
		purchaseOrderBodySchema.parse({
			supplierCompanyId,
			category: 'hardware',
			subject: 'Pembelian Hardware',
			orderDate: '2026-10-28',
			vatMode: 'included',
			lines: [{ productId: ITEM, quantity: 33 }],
			...extra,
		});

	test('snapshots supplier and item, prices default to the purchase price, payment line only from the PO body', async () => {
		const supplier = suppliers.addCompany();
		const pic = suppliers.addPerson(supplier.id);
		const order = await orders.create('purchasing', body(supplier.id, { supplierPicId: pic.id, paymentTerms: 'DP 50%, pelunasan sebelum kirim' }));
		expect(order).toMatchObject({ status: 'draft', code: null, subtotal: 6_270_000_000, grandTotal: 6_270_000_000, vatRateBps: 1100 });
		expect(order.supplierSnapshot).toMatchObject({ code: 'HIT', picName: 'Ria Nainggolan', picTitle: 'Marketing' });
		expect(order.paymentTerms).toBe('DP 50%, pelunasan sebelum kirim');
		const [line] = await orderRepo.findItems(order.id);
		expect(line).toMatchObject({ sku: 'QR50', unitPrice: 190_000_000, lineTotal: 6_270_000_000 });
	});

	test('without a body payment line the PO prints none even though the old supplier column had one', async () => {
		const supplier = suppliers.addCompany();
		const order = await orders.create('purchasing', body(supplier.id));
		expect(order.paymentTerms).toBeNull();
	});

	test('an inactive supplier or an unknown item is refused', async () => {
		const supplier = suppliers.addCompany();
		await expect(orders.create('purchasing', body(supplier.id, { lines: [{ productId: crypto.randomUUID(), quantity: 1 }] }))).rejects.toBeInstanceOf(
			PurchaseOrderItemUnavailableError,
		);
		supplier.status = 'inactive';
		await expect(orders.create('purchasing', body(supplier.id))).rejects.toBeInstanceOf(PurchaseOrderSupplierUnavailableError);
	});

	test('approval of a project order runs the budget check; a blocking budget keeps it submitted (ERP-0146)', async () => {
		const checks: unknown[] = [];
		let block = false;
		const budgeted = new PurchaseOrderService(
			orderRepo,
			suppliers,
			{ getActiveProducts: async (ids: string[]) => (ids.includes(ITEM) ? ([{ id: ITEM, sku: 'QR50', name: 'QR50 Mifare', specification: null, unitLabel: 'pcs', purchasePrice: 190_000_000 }] as never) : []) },
			{ next: async () => 'PO/IMS-HIT/HW/1026/009' },
			{ register: async () => ({}) as never, voidBySource: async () => 0 },
			{ getProject: async (id: string) => (id === '01930000-0000-7000-8000-0000000000f1' ? ({ id } as never) : null) },
			{
				check: async (input: unknown) => {
					checks.push(input);
					if (block) throw new Error('budget exceeded');
					return null;
				},
			},
		);
		const supplier = suppliers.addCompany();
		await expect(budgeted.create('purchasing', body(supplier.id, { projectId: '01930000-0000-7000-8000-0000000000ff' }))).rejects.toThrow();
		const order = await budgeted.create('purchasing', body(supplier.id, { projectId: '01930000-0000-7000-8000-0000000000f1' }));
		await budgeted.submit('purchasing', order.id);
		block = true;
		await expect(budgeted.decide('owner', order.id, { decision: 'approve' })).rejects.toThrow('budget exceeded');
		block = false;
		const approved = await budgeted.decide('owner', order.id, { decision: 'approve' });
		expect(approved.status).toBe('approved');
		expect(checks[1]).toEqual({ projectId: '01930000-0000-7000-8000-0000000000f1', amount: approved.subtotal, excludePurchaseOrderId: order.id });
	});

	test('submit, reject back to draft, approve with number — never by the creator', async () => {
		const supplier = suppliers.addCompany();
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
		const supplier = suppliers.addCompany();
		const order = await orders.create('purchasing', body(supplier.id));
		orderRepo.received.add(order.id);
		await expect(orders.cancel('owner', order.id, 'x')).rejects.toBeInstanceOf(PurchaseOrderStateError);
		orderRepo.received.clear();
		expect((await orders.cancel('owner', order.id, 'Salah pemasok')).status).toBe('cancelled');
		// ERP-0044: a cancelled PO is voided in the registry.
		expect(voided).toEqual([`procurement/purchase_order/${order.id}`]);
		// Its purchase request lines are open for ordering again.
		expect(orderRepo.synced).toEqual([order.id]);
		await expect(orders.cancel('owner', order.id, 'lagi')).rejects.toBeInstanceOf(PurchaseOrderStateError);
	});

	test('a line may order a purchase request line; a refused claim names the PO line', async () => {
		const supplier = suppliers.addCompany();
		const requestLine = crypto.randomUUID();
		const order = await orders.create('purchasing', body(supplier.id, { lines: [{ productId: ITEM, quantity: 2, purchaseRequestItemId: requestLine }] }));
		expect((await orderRepo.findItems(order.id))[0]).toMatchObject({ purchaseRequestItemId: requestLine });
		orderRepo.create = async () => ({ ok: false as const, reason: 'requestLine' as const, line: 1 });
		const refused = orders.create('purchasing', body(supplier.id, { lines: [{ productId: ITEM, quantity: 2, purchaseRequestItemId: requestLine }] }));
		await expect(refused).rejects.toBeInstanceOf(PurchaseRequestLineUnavailableError);
		await expect(refused).rejects.toMatchObject({ params: { line: 1 } });
	});
});
