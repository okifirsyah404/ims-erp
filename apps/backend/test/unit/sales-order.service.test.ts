/**
 * Sales orders (ADR-0011 step 3d): created only from an approved or sent
 * SPH, which becomes Deal in the same step; one live order per SPH;
 * cancelling reopens the SPH; visibility follows the SPH owner.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	QuotationStatus,
	TQuotationItemSelect,
	TQuotationSelect,
	TSalesOrderItemSelect,
	TSalesOrderSelect,
} from '@drizzle/schemas/sales.schema';
import { cancelSalesOrderSchema, createSalesOrderSchema } from '../../src/app/sales/contracts/sales-order.contract';
import type {
	ISalesOrderRepository,
	TSalesOrderHeaderData,
	TSalesOrderItemData,
} from '../../src/app/sales/contracts/sales-order.repository.interface';
import { QuotationNotFoundError } from '../../src/app/sales/errors/quotation.errors';
import {
	SalesOrderExistsError,
	SalesOrderNotCancellableError,
	SalesOrderNotFoundError,
	SalesOrderQuotationNotReadyError,
} from '../../src/app/sales/errors/sales-order.errors';
import { SalesOrderService, type TSalesOrderContext } from '../../src/app/sales/services/sales-order.service';

const Q = '0190a1b2-0000-7000-8000-0000000000f1';

let quotations: Map<string, TQuotationSelect>;

class FakeOrders implements ISalesOrderRepository {
	rows: TSalesOrderSelect[] = [];
	items = new Map<string, TSalesOrderItemSelect[]>();
	history: { id: string; to: string }[] = [];

	async paginate(request: Parameters<ISalesOrderRepository['paginate']>[0]) {
		const data = this.rows.filter((row) => !request.salesPersonUserId || row.salesPersonUserId === request.salesPersonUserId);
		return { meta: { page: 1, limit: 20, total: data.length, totalPages: 1 }, data };
	}
	async findById(id: string) {
		return this.rows.find((row) => row.id === id) ?? null;
	}
	async findItems(id: string) {
		return this.items.get(id) ?? [];
	}
	async findHistory() {
		return [];
	}
	async findLiveByQuotation(quotationId: string) {
		return this.rows.find((row) => row.quotationId === quotationId && row.status !== 'cancelled') ?? null;
	}
	async createFromQuotation(header: TSalesOrderHeaderData, items: TSalesOrderItemData[], actor: string) {
		const quotation = quotations.get(header.quotationId);
		if (!quotation || !(['approved', 'sent'] as QuotationStatus[]).includes(quotation.status)) return null;
		if (await this.findLiveByQuotation(header.quotationId)) throw Object.assign(new Error('dup'), { code: '23505' });
		quotation.status = 'won';
		quotation.closedBy = actor;
		const order = { ...header, id: crypto.randomUUID(), status: 'confirmed' } as TSalesOrderSelect;
		this.rows.push(order);
		this.items.set(order.id, items as TSalesOrderItemSelect[]);
		this.history.push({ id: order.id, to: 'confirmed' });
		return order;
	}
	async cancel(id: string, actor: string, reason: string) {
		const order = await this.findById(id);
		if (!order || order.status !== 'confirmed') return null;
		Object.assign(order, { status: 'cancelled', cancelledBy: actor, cancellationReason: reason });
		const quotation = quotations.get(order.quotationId)!;
		quotation.status = quotation.sentAt ? 'sent' : 'approved';
		quotation.closedBy = null;
		return order;
	}
}

function quotation(status: QuotationStatus, overrides: Partial<TQuotationSelect> = {}): TQuotationSelect {
	return {
		id: Q,
		code: '1376/QT/IMS/X/26-R1',
		baseCode: '1376/QT/IMS/X/26',
		status,
		title: 'Penawaran swing gate',
		customerId: '0190a1b2-0000-7000-8000-0000000000c1',
		customerSnapshot: { code: 'PT-MAJU', name: 'PT Maju' },
		attention: 'Ibu Gloris',
		paymentTerms: 'DP 50% - 50% BAST',
		paymentSchedule: [
			{ label: 'DP', percentBps: 5000 },
			{ label: 'BAST', percentBps: 5000 },
		],
		guarantee: '1 Year',
		vatEnabled: true,
		vatRateBps: 1100,
		subtotal: 1_000_000_00,
		discountTotal: 0,
		taxTotal: 110_000_00,
		grandTotal: 1_110_000_00,
		currencyCode: 'IDR',
		createdBy: 'sales-1',
		sentAt: null,
		...overrides,
	} as TQuotationSelect;
}

const sales: TSalesOrderContext = { actorUserId: 'sales-1', canViewAll: false, canUseAnyQuotation: false };
const sales2: TSalesOrderContext = { actorUserId: 'sales-2', canViewAll: false, canUseAnyQuotation: false };
const manager: TSalesOrderContext = { actorUserId: 'manager', canViewAll: true, canUseAnyQuotation: true };
const finance: TSalesOrderContext = { actorUserId: 'finance', canViewAll: true, canUseAnyQuotation: false };

let orders: FakeOrders;
let service: SalesOrderService;
const create = (ctx: TSalesOrderContext, extra: Record<string, unknown> = {}) =>
	service.create(ctx, createSalesOrderSchema.parse({ quotationId: Q, ...extra }));

beforeEach(() => {
	quotations = new Map();
	orders = new FakeOrders();
	service = new SalesOrderService(
		orders,
		{
			findById: async (id: string) => quotations.get(id) ?? null,
			findItems: async () =>
				[
					{ id: 'qi-1', itemId: 'it-1', sku: 'SG-01', name: 'Swing gate', specification: null, unit: 'set', quantity: '2', unitPrice: 50_000_000, discountAmount: 0, lineTotal: 100_000_000 },
				] as TQuotationItemSelect[],
		},
		{ next: async () => '0001/SO/IMS/XI/26' },
		{ getUser: async (id: string) => ({ id, name: `User ${id}` }) as never },
	);
});

describe('creating an order from an SPH', () => {
	test('copies customer, terms, lines and amounts; the SPH becomes Deal', async () => {
		quotations.set(Q, quotation('approved'));
		const order = await create(sales, { customerPoNumber: 'PO-77', orderDate: '2026-11-06' });
		expect(order).toMatchObject({
			code: '0001/SO/IMS/XI/26',
			status: 'confirmed',
			quotationCode: '1376/QT/IMS/X/26-R1',
			customerPoNumber: 'PO-77',
			orderDate: '2026-11-06',
			grandTotal: 1_110_000_00,
			taxTotal: 110_000_00,
			salesPersonUserId: 'sales-1',
			paymentTerms: 'DP 50% - 50% BAST',
		});
		expect(order.paymentSchedule).toHaveLength(2);
		expect(await orders.findItems(order.id)).toMatchObject([{ quotationItemId: 'qi-1', sku: 'SG-01', quantity: '2' }]);
		expect(quotations.get(Q)!.status).toBe('won');
	});

	test('a sent SPH works too; draft, submitted, rejected and lost do not', async () => {
		quotations.set(Q, quotation('sent'));
		await create(sales);
		for (const status of ['draft', 'submitted', 'rejected', 'lost', 'superseded'] as const) {
			quotations.set(Q, quotation(status));
			await expect(create(sales)).rejects.toBeInstanceOf(SalesOrderQuotationNotReadyError);
		}
	});

	test('one live order per SPH', async () => {
		quotations.set(Q, quotation('approved'));
		await create(sales);
		await expect(create(sales)).rejects.toBeInstanceOf(SalesOrderExistsError);
	});

	test("a salesperson cannot use another's SPH; a manager can", async () => {
		quotations.set(Q, quotation('approved'));
		await expect(create(sales2)).rejects.toBeInstanceOf(QuotationNotFoundError);
		const order = await create(manager);
		expect(order.salesPersonUserId).toBe('sales-1');
		expect(order.createdBy).toBe('manager');
	});
});

describe('visibility', () => {
	test('salespeople see the orders of their own SPHs; managers and billing staff see all', async () => {
		quotations.set(Q, quotation('approved'));
		const order = await create(sales);
		expect((await service.list(sales2, { page: 1, limit: 20 })).data).toHaveLength(0);
		await expect(service.get(sales2, order.id)).rejects.toBeInstanceOf(SalesOrderNotFoundError);
		expect((await service.get(finance, order.id)).salesPerson?.name).toBe('User sales-1');
		expect((await service.list(manager, { page: 1, limit: 20 })).data).toHaveLength(1);
	});
});

describe('cancelling', () => {
	test('needs a reason; reopens the SPH to sent (or approved); twice is refused', async () => {
		expect(() => cancelSalesOrderSchema.parse({ reason: ' ' })).toThrow();
		quotations.set(Q, quotation('sent', { sentAt: new Date() }));
		const order = await create(sales);
		const cancelled = await service.cancel(manager, order.id, 'Customer batal');
		expect(cancelled).toMatchObject({ status: 'cancelled', cancellationReason: 'Customer batal' });
		expect(quotations.get(Q)!.status).toBe('sent');
		await expect(service.cancel(manager, order.id, 'lagi')).rejects.toBeInstanceOf(SalesOrderNotCancellableError);
		// The reopened SPH can become an order again.
		expect((await create(sales)).status).toBe('confirmed');
	});

	test('an SPH approved but never sent goes back to approved', async () => {
		quotations.set(Q, quotation('approved'));
		const order = await create(sales);
		await service.cancel(manager, order.id, 'Salah pelanggan');
		expect(quotations.get(Q)!.status).toBe('approved');
	});
});
