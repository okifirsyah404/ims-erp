import { ITEM_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { ItemService } from '@app/inventory/services/item.service';
import type { PoVatMode, PurchaseOrderStatus } from '@drizzle/schemas/procurement.schema';
import { inject, injectable } from 'tsyringe';
import { PURCHASE_ORDER_REPOSITORY_TOKEN } from '../constants/di';
import type { IPurchaseOrderRepository } from '../contracts/procurement.repository.interface';
import { computePoTotals, poLineTotal } from '../utils/po-totals';

/** Orders whose received goods can be billed. */
const BILLABLE_STATUSES: readonly PurchaseOrderStatus[] = ['partially_received', 'received'];

/** A purchase order as Finance bills it (ERP-0012). */
export type TBillableOrder = {
	id: string;
	code: string | null;
	subject: string;
	status: PurchaseOrderStatus;
	supplierId: string;
	supplierName: string;
	vatMode: PoVatMode;
	vatRateBps: number;
	lines: {
		id: string;
		itemId: string;
		sku: string;
		name: string;
		unit: string;
		unitPrice: number;
		quantityReceived: string;
		/** Stock-tracked item: the bill line debits inventory. */
		isStock: boolean;
	}[];
};

/** Priced bill lines with the order's VAT applied. */
export type TPricedBill = {
	lines: { lineTotal: number; taxBase: number }[];
	/** Tax base (DPP): what the debit lines add up to. */
	subtotal: number;
	taxTotal: number;
	grandTotal: number;
};

/**
 * Procurement contract for Finance's supplier bills (ERP-0012).
 *
 * @remarks
 * Finance owns the bills and their lines; it asks this service what an
 * order received and how its VAT works, and keeps its own count of what was
 * already billed, so Procurement never reads Finance tables (no cycle).
 */
@injectable()
export class PurchaseBillingService {
	constructor(
		@inject(PURCHASE_ORDER_REPOSITORY_TOKEN)
		private readonly orders: Pick<IPurchaseOrderRepository, 'findById' | 'findItems' | 'paginate'>,
		@inject(ITEM_SERVICE_TOKEN)
		private readonly items: Pick<ItemService, 'getItem'>,
	) {}

	private async toBillable(order: Awaited<ReturnType<IPurchaseOrderRepository['findById']>>): Promise<TBillableOrder | null> {
		if (!order || !BILLABLE_STATUSES.includes(order.status)) return null;
		const lines = await this.orders.findItems(order.id);
		return {
			id: order.id,
			code: order.code,
			subject: order.subject,
			status: order.status,
			supplierId: order.supplierId,
			supplierName: order.supplierSnapshot.name,
			vatMode: order.vatMode,
			vatRateBps: order.vatRateBps,
			lines: await Promise.all(
				lines.map(async (line) => ({
					id: line.id,
					itemId: line.itemId,
					sku: line.sku,
					name: line.name,
					unit: line.unit,
					unitPrice: line.unitPrice,
					quantityReceived: line.quantityReceived,
					isStock: (await this.items.getItem(line.itemId).catch(() => null))?.isStockTracked ?? false,
				})),
			),
		};
	}

	/** One order with what it received, or `null` when nothing can be billed on it. */
	async getBillableOrder(purchaseOrderId: string): Promise<TBillableOrder | null> {
		return this.toBillable(await this.orders.findById(purchaseOrderId));
	}

	/** Orders that received goods, newest first. */
	async listBillableOrders(search?: string): Promise<TBillableOrder[]> {
		const pages = await Promise.all(
			BILLABLE_STATUSES.map((status) => this.orders.paginate({ page: 1, limit: 50, status, search })),
		);
		const orders = await Promise.all(pages.flatMap((page) => page.data).map((order) => this.toBillable(order)));
		return orders.filter((order): order is TBillableOrder => order !== null);
	}

	/**
	 * Prices bill lines the way the order does: line totals at the order unit
	 * price, then the order's VAT mode. Each line's tax base is its share of
	 * the total tax base; the last line takes the rounding rest, so the lines
	 * always add up to the subtotal.
	 */
	priceLines(order: Pick<TBillableOrder, 'vatMode' | 'vatRateBps'>, lines: { quantity: string; unitPrice: number }[]): TPricedBill {
		const lineTotals = lines.map((line) => poLineTotal(line));
		const totals = computePoTotals(lineTotals, order.vatMode, order.vatRateBps);
		const gross = lineTotals.reduce((sum, value) => sum + value, 0);
		let allocated = 0;
		const priced = lineTotals.map((lineTotal, index) => {
			const taxBase =
				index === lineTotals.length - 1
					? totals.taxBase - allocated
					: gross === 0
						? 0
						: Math.round((lineTotal * totals.taxBase) / gross);
			allocated += taxBase;
			return { lineTotal, taxBase };
		});
		return { lines: priced, subtotal: totals.taxBase, taxTotal: totals.taxTotal, grandTotal: totals.taxBase + totals.taxTotal };
	}
}
