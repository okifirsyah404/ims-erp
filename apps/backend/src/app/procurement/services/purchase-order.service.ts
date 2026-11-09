import { ITEM_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { ItemService } from '@app/inventory/services/item.service';
import { NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { NumberingService } from '@app/organization/services/numbering.service';
import { isUniqueViolation } from '@drizzle/errors';
import {
	PURCHASE_CATEGORY_CODES,
	type TPoSupplierSnapshot,
	type TPurchaseOrderItemSelect,
	type TPurchaseOrderSelect,
	type TSupplierSelect,
} from '@drizzle/schemas/procurement.schema';
import { businessDateOf } from '@utils/business-date.util';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { PURCHASE_ORDER_REPOSITORY_TOKEN, SUPPLIER_SERVICE_TOKEN } from '../constants/di';
import type {
	IPurchaseOrderRepository,
	TPurchaseOrderHeaderData,
	TPurchaseOrderItemData,
} from '../contracts/procurement.repository.interface';
import type {
	TPurchaseOrderBody,
	TPurchaseOrderDecision,
	TPurchaseOrderListQuery,
} from '../contracts/purchase-order.contract';
import {
	PurchaseOrderCodeTakenError,
	PurchaseOrderItemUnavailableError,
	PurchaseOrderNotFoundError,
	PurchaseOrderSelfApprovalError,
	PurchaseOrderStateError,
	PurchaseOrderSupplierUnavailableError,
} from '../errors/procurement.errors';
import { computePoTotals, DEFAULT_PO_VAT_RATE_BPS, poLineTotal } from '../utils/po-totals';
import type { SupplierService } from './supplier.service';

export type TPurchaseOrderDetail = TPurchaseOrderSelect & {
	items: TPurchaseOrderItemSelect[];
	/** Tax base (DPP), derived for `included`. */
	taxBase: number;
};

function snapshotOf(supplier: TSupplierSelect): TPoSupplierSnapshot {
	return {
		code: supplier.code,
		name: supplier.legalName ?? supplier.name,
		address: [supplier.addressLine, supplier.postalCode].filter(Boolean).join(' ') || null,
		taxId: supplier.taxId,
		phone: supplier.phone,
		email: supplier.email,
		picName: supplier.picName,
		picTitle: supplier.picTitle,
		picPhone: supplier.picPhone,
		picEmail: supplier.picEmail,
	};
}

/**
 * Purchase order use cases (ADR-0011 step 4a).
 *
 * @remarks
 * - One-level approval with `purchase_order:approve`, never by the PO's own
 *   creator (403); rejection returns the PO to draft with the reason kept.
 * - Numbers follow the company format `PO/<COMPANY>-<SUPPLIER>/<CAT>/<MMYY>/<SEQ>`
 *   and are assigned on approval, from the order date.
 * - Supplier and item data are snapshotted; only active suppliers and items
 *   are ordered. The unit price defaults to the item's purchase price.
 * - Cancelling is refused once anything was received (step 4b).
 */
@injectable()
export class PurchaseOrderService {
	constructor(
		@inject(PURCHASE_ORDER_REPOSITORY_TOKEN)
		private readonly orders: IPurchaseOrderRepository,
		@inject(SUPPLIER_SERVICE_TOKEN)
		private readonly suppliers: Pick<SupplierService, 'getActiveSupplier'>,
		@inject(ITEM_SERVICE_TOKEN)
		private readonly items: Pick<ItemService, 'getActiveItems'>,
		@inject(NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<NumberingService, 'next'>,
	) {}

	private async require(id: string): Promise<TPurchaseOrderSelect> {
		const order = await this.orders.findById(id);
		if (!order) throw new PurchaseOrderNotFoundError();
		return order;
	}

	private async build(body: TPurchaseOrderBody): Promise<{ header: TPurchaseOrderHeaderData; items: TPurchaseOrderItemData[] }> {
		const supplier = await this.suppliers.getActiveSupplier(body.supplierId);
		if (!supplier) throw new PurchaseOrderSupplierUnavailableError();
		const found = new Map((await this.items.getActiveItems(body.lines.map((line) => line.itemId))).map((item) => [item.id, item]));
		const items: TPurchaseOrderItemData[] = body.lines.map((line, index) => {
			const item = found.get(line.itemId);
			if (!item) throw new PurchaseOrderItemUnavailableError(index + 1);
			const unitPrice = line.unitPrice ?? item.purchasePrice;
			return {
				itemId: item.id,
				sku: item.sku,
				name: item.name,
				specification: line.specification ?? item.specification,
				unit: item.unitLabel,
				quantity: line.quantity,
				unitPrice,
				lineTotal: poLineTotal({ quantity: line.quantity, unitPrice }),
			};
		});
		const vatRateBps = body.vatMode === 'none' ? 0 : (body.vatRateBps ?? DEFAULT_PO_VAT_RATE_BPS);
		const totals = computePoTotals(items.map((item) => item.lineTotal!), body.vatMode, vatRateBps);
		return {
			header: {
				supplierId: supplier.id,
				supplierSnapshot: snapshotOf(supplier),
				category: body.category,
				subject: body.subject,
				orderDate: body.orderDate ?? businessDateOf(),
				expectedDeliveryDate: body.expectedDeliveryDate ?? null,
				supplierQuoteRef: body.supplierQuoteRef,
				supplierQuoteDate: body.supplierQuoteDate ?? null,
				projectName: body.projectName,
				buyerPicName: body.buyerPicName,
				vatMode: body.vatMode,
				vatRateBps,
				subtotal: totals.subtotal,
				taxTotal: totals.taxTotal,
				grandTotal: totals.grandTotal,
				// The printed payment line defaults to the supplier's terms.
				paymentTerms: body.paymentTerms ?? supplier.paymentTermNote,
				terms: body.terms,
				notes: body.notes,
			},
			items,
		};
	}

	list(query: TPurchaseOrderListQuery): Promise<TPaginationResult<TPurchaseOrderSelect>> {
		return this.orders.paginate(query);
	}

	async get(id: string): Promise<TPurchaseOrderDetail> {
		const order = await this.require(id);
		const items = await this.orders.findItems(id);
		const { taxBase } = computePoTotals(items.map((item) => item.lineTotal), order.vatMode, order.vatRateBps);
		return { ...order, items, taxBase };
	}

	async create(actorUserId: string, body: TPurchaseOrderBody): Promise<TPurchaseOrderSelect> {
		const { header, items } = await this.build(body);
		return this.orders.create({ ...header, createdBy: actorUserId }, items);
	}

	async update(id: string, body: TPurchaseOrderBody): Promise<TPurchaseOrderSelect> {
		const order = await this.require(id);
		if (order.status !== 'draft') throw new PurchaseOrderStateError('notDraft');
		const { header, items } = await this.build(body);
		const updated = await this.orders.replaceDraft(id, header, items);
		if (!updated) throw new PurchaseOrderStateError('notDraft');
		return updated;
	}

	async submit(actorUserId: string, id: string): Promise<TPurchaseOrderSelect> {
		await this.require(id);
		const updated = await this.orders.transition(id, ['draft'], 'submitted', {
			submittedBy: actorUserId,
			submittedAt: new Date(),
			rejectionReason: null,
		});
		if (!updated) throw new PurchaseOrderStateError('notDraft');
		return updated;
	}

	/** Approves (numbering it) or rejects back to draft — never one's own PO. */
	async decide(actorUserId: string, id: string, input: TPurchaseOrderDecision): Promise<TPurchaseOrderSelect> {
		const order = await this.require(id);
		if (order.status !== 'submitted') throw new PurchaseOrderStateError('notSubmitted');
		if (order.createdBy === actorUserId) throw new PurchaseOrderSelfApprovalError();
		if (input.decision === 'reject') {
			const rejected = await this.orders.transition(id, ['submitted'], 'draft', { rejectionReason: input.reason ?? null });
			if (!rejected) throw new PurchaseOrderStateError('notSubmitted');
			return rejected;
		}
		const code = await this.numbering.next('purchase_order', {
			date: new Date(`${order.orderDate}T12:00:00+07:00`),
			context: { supplier: order.supplierSnapshot.code, category: PURCHASE_CATEGORY_CODES[order.category] },
		});
		try {
			const approved = await this.orders.transition(id, ['submitted'], 'approved', {
				code,
				approvedBy: actorUserId,
				approvedAt: new Date(),
				rejectionReason: null,
			});
			if (!approved) throw new PurchaseOrderStateError('notSubmitted');
			return approved;
		} catch (error) {
			if (isUniqueViolation(error)) throw new PurchaseOrderCodeTakenError(code);
			throw error;
		}
	}

	/** Approved → sent (recorded after sending it to the supplier). */
	async markSent(actorUserId: string, id: string): Promise<TPurchaseOrderSelect> {
		await this.require(id);
		const updated = await this.orders.transition(id, ['approved'], 'sent', { sentBy: actorUserId, sentAt: new Date() });
		if (!updated) throw new PurchaseOrderStateError('notApproved');
		return updated;
	}

	async cancel(actorUserId: string, id: string, reason: string): Promise<TPurchaseOrderSelect> {
		await this.require(id);
		if (await this.orders.hasReceipts(id)) throw new PurchaseOrderStateError('received');
		const updated = await this.orders.transition(id, ['draft', 'submitted', 'approved', 'sent'], 'cancelled', {
			cancelledBy: actorUserId,
			cancelledAt: new Date(),
			cancelledReason: reason,
		});
		if (!updated) throw new PurchaseOrderStateError('notCancellable');
		return updated;
	}
}
