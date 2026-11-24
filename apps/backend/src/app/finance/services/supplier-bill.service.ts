import { inventoryValue } from '../utils/inventory-value';
import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { DRIZZLE_TOKEN } from '@di/provider';
import type { TPaginationResult } from '@ims-erp/common';
import type { TSupplierBillItemSelect, TSupplierBillSelect } from '@drizzle/schemas/finance.schema';
import { PURCHASE_BILLING_SERVICE_TOKEN } from '@app/procurement';
import { EXPORTED_SUPPLIER_SERVICE_TOKEN } from '@app/supplier';
import type { PurchaseBillingService, TBillableOrder } from '@app/procurement';
import type { ExportedSupplierService } from '@app/supplier';
import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import { businessDateOf } from '@utils/business-date.util';
import { pinoLogger } from '@providers/logger/logger';
import { billDueThreshold, supplierBillEvent, type TBillEventSupplier } from '../utils/supplier-bill-event';
import { quantityToMilli } from '@utils/money.util';
import { FINANCE_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { FinanceNumberingService } from './finance-numbering.service';
import {
	AR_ACCOUNT_RESOLVER_TOKEN,
	POSTING_SERVICE_TOKEN,
} from '../constants/ar-di';
import {
	AP_OPEN_ITEM_REPOSITORY_TOKEN,
	SUPPLIER_BILL_ITEM_REPOSITORY_TOKEN,
	SUPPLIER_BILL_REPOSITORY_TOKEN,
} from '../constants/di';
import type { PostingService } from './posting.service';
import type { ArAccountResolverService } from './ar-account-resolver.service';
import {
	BillLineError,
	BillNotDraftError,
	BillNotFoundError,
	BillOrderNotBillableError,
} from '../errors/ledger.errors';
import type {
	ISupplierBillRepository,
	TSupplierBillPaginationRequest,
} from '../contracts/supplier-bill.repository.interface';
import type { ISupplierBillItemRepository } from '../contracts/supplier-bill-item.repository.interface';
import type { IApOpenItemRepository } from '../contracts/ap-open-item.repository.interface';

export type TBillActionContext = {
	organizationId: string;
	actorUserId: string;
};

export type TCreateSupplierBillInput = {
	supplierCompanyId: string;
	purchaseOrderId: string | null;
	billDate: string;
	dueDate: string | null;
	/** Expense subtotal before tax. */
	subtotal: number;
	taxTotal: number;
	currencyCode: string;
	notes: string | null;
};

/** A bill made from a purchase order (ERP-0012). */
export type TCreateBillFromOrderInput = {
	purchaseOrderId: string;
	supplierInvoiceNumber: string;
	billDate: string;
	dueDate: string | null;
	lines: { purchaseOrderItemId: string; quantity: string }[];
};

/** An order Finance can bill, with what is still unbilled per line. */
export type TBillableOrderView = Omit<TBillableOrder, 'lines'> & {
	lines: (TBillableOrder['lines'][number] & { quantityBilled: string; quantityBillable: string })[];
};

export type TSupplierBillDetail = TSupplierBillSelect & { items: TSupplierBillItemSelect[] };

const toQuantity = (milli: bigint) => (Number(milli) / 1000).toFixed(3);

/**
 * Supplier-bill application service (M09 F5).
 *
 * @remarks
 * Mirror of the invoice flow on the purchasing side. **Recording** the bill
 * is the ledger event: one transaction approves the bill, posts
 * DR expense / DR input tax / CR AP through the shared posting service (D9),
 * and opens the `finance.ap_open_items` sub-ledger row (D3). Bills live in
 * `finance.supplier_bills` — finance owns them outright (unlike invoices,
 * which belong to sales per D2).
 */
@injectable()
export class SupplierBillService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(SUPPLIER_BILL_REPOSITORY_TOKEN) private readonly bills: ISupplierBillRepository,
		@inject(AP_OPEN_ITEM_REPOSITORY_TOKEN) private readonly ap: IApOpenItemRepository,
		@inject(SUPPLIER_BILL_ITEM_REPOSITORY_TOKEN) private readonly billItems: ISupplierBillItemRepository,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: PostingService,
		@inject(AR_ACCOUNT_RESOLVER_TOKEN)
		private readonly accountResolver: ArAccountResolverService,
		@inject(FINANCE_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: FinanceNumberingService,
		/** ERP-0012: what a purchase order received and how its VAT works. */
		@inject(PURCHASE_BILLING_SERVICE_TOKEN)
		private readonly purchasing: Pick<PurchaseBillingService, 'getBillableOrder' | 'listBillableOrders' | 'priceLines'>,
		/** M04: booked bills and due reminders go to n8n. */
		@inject(OUTBOX_SERVICE_TOKEN)
		private readonly outbox: Pick<OutboxService, 'publish'>,
		@inject(EXPORTED_SUPPLIER_SERVICE_TOKEN)
		private readonly suppliers: Pick<ExportedSupplierService, 'assertActiveCompany'>,
	) {}

	/** Supplier contact for an event, never the bank details; `null` when unknown. */
	private async supplierOf(supplierCompanyId: string | null): Promise<TBillEventSupplier | null> {
		if (!supplierCompanyId) return null;
		const supplier = await this.suppliers.assertActiveCompany(supplierCompanyId).catch(() => null);
		if (!supplier) return null;
		return {
			id: supplier.id,
			code: supplier.code,
			name: supplier.name,
			phone: supplier.phone,
			email: supplier.email,
			picName: null,
			picPhone: null,
		};
	}

	/**
	 * Daily `supplier_bill.due` reminders (ERP-0012): open bills due within 7
	 * days (threshold 7) and due or overdue (threshold 0). Each (bill, due
	 * date, threshold) is published once through the outbox dedupe key, so
	 * the job is safe to re-run.
	 */
	async publishDueNotices(today = businessDateOf()): Promise<{ processed: number; skipped: number }> {
		const horizon = new Date(`${today}T00:00:00Z`);
		horizon.setUTCDate(horizon.getUTCDate() + 7);
		const bills = await this.bills.listOpenBillsDueBy(horizon.toISOString().slice(0, 10));
		let processed = 0;
		let skipped = 0;
		for (const bill of bills) {
			const daysLeft = Math.round((Date.parse(`${bill.dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
			const threshold = billDueThreshold(daysLeft);
			if (threshold === null) {
				skipped += 1;
				continue;
			}
			const message = await this.outbox.publish(
				'supplier_bill.due',
				{ type: 'supplier_bill', id: bill.id },
				supplierBillEvent(bill, await this.supplierOf(bill.supplierCompanyId), {
					threshold,
					stage: daysLeft < 0 ? 'overdue' : daysLeft === 0 ? 'due' : 'upcoming',
					daysLeft,
				}),
				{ dedupeKey: `supplier_bill.due:${bill.id}:${bill.dueDate}:${threshold}` },
			);
			if (message) processed += 1;
			else skipped += 1;
		}
		return { processed, skipped };
	}

	private async withBilled(order: TBillableOrder): Promise<TBillableOrderView> {
		const billed = await this.billItems.billedQuantities(order.lines.map((line) => line.id));
		return {
			...order,
			lines: order.lines.map((line) => {
				const done = billed.get(line.id) ?? 0n;
				const left = quantityToMilli(line.quantityReceived) - done;
				return { ...line, quantityBilled: toQuantity(done), quantityBillable: toQuantity(left > 0n ? left : 0n) };
			}),
		};
	}

	/** Purchase orders with received goods that are not billed yet (ERP-0012). */
	async billableOrders(search?: string): Promise<TBillableOrderView[]> {
		const orders = await Promise.all((await this.purchasing.listBillableOrders(search)).map((order) => this.withBilled(order)));
		return orders.filter((order) => order.lines.some((line) => Number(line.quantityBillable) > 0));
	}

	/** One bill with its purchase order lines, if any. */
	async detail(organizationId: string, id: string): Promise<TSupplierBillDetail> {
		const bill = await this.get(organizationId, id);
		return { ...bill, items: await this.billItems.findSupplierBillItems(organizationId, id) };
	}

	/**
	 * Drafts a bill from a purchase order: lines at the order unit price and
	 * VAT, never more than received minus what live bills already hold, in
	 * any organization. Serialized per order, so two users cannot bill the
	 * same goods.
	 *
	 * @throws {BillOrderNotBillableError} The order received nothing
	 * @throws {BillLineError} A line is unknown, repeated or over the billable quantity
	 */
	async createFromPurchaseOrder(ctx: TBillActionContext, input: TCreateBillFromOrderInput): Promise<TSupplierBillDetail> {
		const order = await this.purchasing.getBillableOrder(input.purchaseOrderId);
		if (!order) throw new BillOrderNotBillableError();
		const byId = new Map(order.lines.map((line) => [line.id, line]));
		const seen = new Set<string>();
		const chosen = input.lines.map((line, index) => {
			const orderLine = byId.get(line.purchaseOrderItemId);
			if (!orderLine) throw new BillLineError('unknown', index + 1);
			if (seen.has(orderLine.id)) throw new BillLineError('duplicate', index + 1);
			seen.add(orderLine.id);
			return { orderLine, quantity: line.quantity };
		});
		const priced = this.purchasing.priceLines(
			order,
			chosen.map(({ orderLine, quantity }) => ({ quantity, unitPrice: orderLine.unitPrice })),
		);

		const created = await this.database.transaction(async (tx) => {
			await this.billItems.lockPurchaseOrderBilling(order.id, tx);
			const billed = await this.billItems.billedQuantities(
				chosen.map(({ orderLine }) => orderLine.id),
				tx,
			);
			for (const [index, { orderLine, quantity }] of chosen.entries()) {
				const left = quantityToMilli(orderLine.quantityReceived) - (billed.get(orderLine.id) ?? 0n);
				if (quantityToMilli(quantity) > left) throw new BillLineError('over', index + 1);
			}
			const code = await this.numbering.next('supplier_bill', {
				date: new Date(`${input.billDate}T12:00:00+07:00`),
				tx,
			});
			const bill = await this.bills.insertSupplierBill(
				{
					organizationId: ctx.organizationId,
					code,
					supplierCompanyId: order.supplierCompanyId,
					purchaseOrderId: order.id,
					supplierInvoiceNumber: input.supplierInvoiceNumber,
					billDate: input.billDate,
					dueDate: input.dueDate,
					subtotal: priced.subtotal,
					taxTotal: priced.taxTotal,
					grandTotal: priced.grandTotal,
					paidTotal: 0,
					outstandingTotal: 0,
					currencyCode: 'IDR',
					status: 'draft',
					approvedBy: null,
					approvedAt: null,
				},
				tx,
			);
			await this.billItems.insertSupplierBillItems(
				chosen.map(({ orderLine, quantity }, index) => ({
					organizationId: ctx.organizationId,
					supplierBillId: bill.id,
					purchaseOrderItemId: orderLine.id,
					productId: orderLine.productId,
					name: orderLine.name,
					unit: orderLine.unit,
					quantity,
					unitPrice: orderLine.unitPrice,
					lineTotal: priced.lines[index]!.lineTotal,
					taxBase: priced.lines[index]!.taxBase,
					isStock: orderLine.isStock,
					grirAmount: orderLine.isStock ? inventoryValue(quantity, orderLine.receivedUnitCost) : 0,
					sortOrder: index,
				})),
				tx,
			);
			return bill;
		});
		return this.detail(ctx.organizationId, created.id);
	}

	/** Fetches one page of the tenant's supplier bills. */
	async list(
		request: TSupplierBillPaginationRequest,
	): Promise<TPaginationResult<TSupplierBillSelect>> {
		return this.bills.paginate(request);
	}

	async get(organizationId: string, id: string): Promise<TSupplierBillSelect> {
		const bill = await this.bills.findSupplierBillById(organizationId, id);
		if (!bill) throw new BillNotFoundError();
		return bill;
	}

	/** Creates a draft bill; grand total is derived (subtotal + tax). */
	async create(
		ctx: TBillActionContext,
		input: TCreateSupplierBillInput,
	): Promise<TSupplierBillSelect> {
		return this.database.transaction(async (tx) => {
			const code = await this.numbering.next('supplier_bill', {
				date: new Date(`${input.billDate}T12:00:00+07:00`),
				tx,
			});
			return this.bills.insertSupplierBill(
				{
					organizationId: ctx.organizationId,
					code,
					supplierCompanyId: input.supplierCompanyId,
					purchaseOrderId: input.purchaseOrderId,
					billDate: input.billDate,
					dueDate: input.dueDate,
					subtotal: input.subtotal,
					taxTotal: input.taxTotal,
					grandTotal: input.subtotal + input.taxTotal,
					paidTotal: 0,
					outstandingTotal: 0,
					currencyCode: input.currencyCode,
					status: 'draft',
					approvedBy: null,
					approvedAt: null,
				},
				tx,
			);
		});
	}

	/** Draft → void. No journal impact (nothing was posted). */
	async cancel(ctx: TBillActionContext, id: string): Promise<TSupplierBillSelect> {
		const bill = await this.bills.findSupplierBillById(ctx.organizationId, id);
		if (!bill) throw new BillNotFoundError();
		if (bill.status !== 'draft') throw new BillNotDraftError();
		const updated = await this.bills.updateSupplierBill(ctx.organizationId, id, {
			status: 'void',
		});
		return updated ?? bill;
	}

	/**
	 * Records the bill — the ledger event of F5. One transaction covers the
	 * status stamp, the journal (DR expense / DR input tax / CR AP) and the
	 * `ap_open_items` row. Idempotent through the JE idempotency key.
	 */
	async record(ctx: TBillActionContext, id: string): Promise<TSupplierBillSelect> {
		const recorded = await this.recordInTransaction(ctx, id);
		try {
			await this.outbox.publish(
				'supplier_bill.recorded',
				{ type: 'supplier_bill', id: recorded.id },
				supplierBillEvent(recorded, await this.supplierOf(recorded.supplierCompanyId), { recordedBy: ctx.actorUserId }),
			);
		} catch (error) {
			pinoLogger.warn({ err: error, billId: recorded.id }, 'supplier_bill.recorded not published');
		}
		return recorded;
	}

	private async recordInTransaction(ctx: TBillActionContext, id: string): Promise<TSupplierBillSelect> {
		return this.database.transaction(async (tx) => {
			const bill = await this.bills.findSupplierBillById(ctx.organizationId, id, tx);
			if (!bill) throw new BillNotFoundError();
			if (bill.status !== 'draft') throw new BillNotDraftError();

			const billDate = bill.billDate ?? new Date().toISOString().slice(0, 10);

			// ERP-0136 (grill Q24): stock lines clear GR/IR at the receipt value;
			// the difference to the billed base is purchase price variance.
			// Service and non-stock lines stay an expense.
			const items = await this.billItems.findSupplierBillItems(ctx.organizationId, id, tx);
			const stockItems = items.filter((item) => item.isStock);
			const grir = stockItems.reduce((sum, item) => sum + item.grirAmount, 0);
			const stockBase = stockItems.reduce((sum, item) => sum + item.taxBase, 0);
			const variance = stockBase - grir;
			const party = { partyType: 'supplier', partyId: bill.supplierCompanyId };
			const lines = [
				{ role: 'grir_clearing', debit: grir, credit: 0 },
				{ role: 'purchase_price_variance', debit: Math.max(variance, 0), credit: Math.max(-variance, 0) },
				{ role: 'expense', debit: bill.subtotal - stockBase, credit: 0 },
				{ role: 'vat_input', debit: bill.taxTotal, credit: 0 },
				{ role: 'payable', debit: 0, credit: bill.grandTotal, ...party },
			].filter((line) => line.debit > 0 || line.credit > 0);

			await this.posting.postBusinessEvent(tx, {
				organizationId: ctx.organizationId,
				entryDate: billDate,
				sourceModule: 'finance',
				sourceType: 'supplier_bill',
				sourceId: bill.id,
				idempotencyKey: `supplier-bill:${bill.id}`,
				eventType: 'finance.supplier_bill_recorded',
				description: `Supplier bill ${bill.code}`,
				actorUserId: ctx.actorUserId,
				lines,
			});

			await this.ap.insertApOpenItem(
				{
					organizationId: ctx.organizationId,
					supplierBillId: bill.id,
					supplierCompanyId: bill.supplierCompanyId,
					billDate,
					dueDate: bill.dueDate,
					originalAmount: bill.grandTotal,
					paidAmount: 0,
					outstandingAmount: bill.grandTotal,
					currencyCode: bill.currencyCode,
					status: 'open',
				},
				tx,
			);

			return this.bills.updateSupplierBill(
				ctx.organizationId,
				id,
				{
					status: 'approved',
					approvedBy: ctx.actorUserId,
					approvedAt: new Date(),
					outstandingTotal: bill.grandTotal,
				},
				tx,
			).then((updated) => updated ?? bill);
		});
	}
}


