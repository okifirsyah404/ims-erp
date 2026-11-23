import { PRODUCT_SERVICE_TOKEN } from '@app/product/constants/di';
import type { ProductService } from '@app/product/services/product.service';
import { PROCUREMENT_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { ProcurementNumberingService } from './procurement-numbering.service';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document/constants/di';
import type { DocumentService } from '@app/document';
import { EXPORTED_SUPPLIER_SERVICE_TOKEN } from '@app/supplier';
import type { ExportedSupplierService } from '@app/supplier';
import type { TSupplierCompanySelect, TSupplierSelect } from '@drizzle/schemas/supplier.schema';
import { isUniqueViolation } from '@drizzle/errors';
import {
	PURCHASE_CATEGORY_CODES,
	type TPoSupplierSnapshot,
	type TPurchaseOrderItemSelect,
	type TPurchaseOrderSelect,
} from '@drizzle/schemas/procurement.schema';
import { businessDateOf } from '@utils/business-date.util';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { PURCHASE_ORDER_REPOSITORY_TOKEN } from '../constants/di';
import type {
	IPurchaseOrderRepository,
	TPurchaseOrderHeaderData,
	TPurchaseOrderItemData,
	TPurchaseOrderWrite,
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
	PurchaseRequestLineUnavailableError,
} from '../errors/procurement.errors';
import { computePoTotals, DEFAULT_PO_VAT_RATE_BPS, poLineTotal } from '../utils/po-totals';

export type TPurchaseOrderDetail = TPurchaseOrderSelect & {
	items: (TPurchaseOrderItemSelect & { purchaseRequestId: string | null; purchaseRequestCode: string | null })[];
	/** Tax base (DPP), derived for `included`. */
	taxBase: number;
};

function snapshotOf(supplier: TSupplierCompanySelect, pic: TSupplierSelect | null, address: string | null): TPoSupplierSnapshot {
	return {
		code: supplier.code,
		name: supplier.legalName ?? supplier.name,
		address,
		taxId: supplier.taxId,
		phone: supplier.phone,
		email: supplier.email,
		picName: pic?.name ?? null,
		picTitle: pic?.title ?? null,
		picPhone: pic?.phone ?? null,
		picEmail: pic?.email ?? null,
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
		@inject(EXPORTED_SUPPLIER_SERVICE_TOKEN)
		private readonly suppliers: Pick<
			ExportedSupplierService,
			'assertActiveCompany' | 'findPerson' | 'getPurchaseSnapshot'
		>,
		@inject(PRODUCT_SERVICE_TOKEN)
		private readonly items: Pick<ProductService, 'getActiveProducts'>,
		@inject(PROCUREMENT_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<ProcurementNumberingService, 'next'>,
		/** ERP-0044: approved purchase orders are recorded in the registry. */
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<DocumentService, 'register' | 'voidBySource'>,
	) {}

	private async require(id: string): Promise<TPurchaseOrderSelect> {
		const order = await this.orders.findById(id);
		if (!order) throw new PurchaseOrderNotFoundError();
		return order;
	}

	private async build(body: TPurchaseOrderBody): Promise<{ header: TPurchaseOrderHeaderData; items: TPurchaseOrderItemData[] }> {
		const supplier = await this.suppliers.assertActiveCompany(body.supplierCompanyId);
		if (supplier.status !== 'active') throw new PurchaseOrderSupplierUnavailableError();
		const pic = body.supplierPicId ? await this.suppliers.findPerson(body.supplierPicId) : null;
		if (body.supplierPicId && (!pic || pic.companyId !== supplier.id)) throw new PurchaseOrderSupplierUnavailableError();
		const found = new Map((await this.items.getActiveProducts(body.lines.map((line) => line.productId))).map((item) => [item.id, item]));
		const items: TPurchaseOrderItemData[] = body.lines.map((line, index) => {
			const item = found.get(line.productId);
			if (!item) throw new PurchaseOrderItemUnavailableError(index + 1);
			const unitPrice = line.unitPrice ?? item.purchasePrice;
			return {
				productId: item.id,
				sku: item.sku,
				name: item.name,
				specification: line.specification ?? item.specification,
				unit: item.unitLabel,
				quantity: line.quantity,
				unitPrice,
				lineTotal: poLineTotal({ quantity: line.quantity, unitPrice }),
				purchaseRequestItemId: line.purchaseRequestItemId,
			};
		});
		const vatRateBps = body.vatMode === 'none' ? 0 : (body.vatRateBps ?? DEFAULT_PO_VAT_RATE_BPS);
		const totals = computePoTotals(items.map((item) => item.lineTotal!), body.vatMode, vatRateBps);
		return {
			header: {
				supplierCompanyId: supplier.id,
				supplierPicId: pic?.id ?? null,
				supplierSnapshot: snapshotOf(supplier, pic, await this.suppliers.getPurchaseSnapshot(supplier.id).then((s) => s.address)),
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
				// The printed payment line comes from the PO form only; the
				// supplier master no longer holds default payment terms.
				paymentTerms: body.paymentTerms,
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
		const [items, requests] = await Promise.all([this.orders.findItems(id), this.orders.findItemRequests(id)]);
		const byLine = new Map(requests.map((request) => [request.purchaseOrderItemId, request]));
		const { taxBase } = computePoTotals(items.map((item) => item.lineTotal), order.vatMode, order.vatRateBps);
		return {
			...order,
			items: items.map((item) => ({
				...item,
				purchaseRequestId: byLine.get(item.id)?.purchaseRequestId ?? null,
				purchaseRequestCode: byLine.get(item.id)?.purchaseRequestCode ?? null,
			})),
			taxBase,
		};
	}

	/** A failed write: not a draft, or a purchase request line that is not open. */
	private written(result: TPurchaseOrderWrite): TPurchaseOrderSelect {
		if (result.ok) return result.order;
		if (result.reason === 'requestLine') throw new PurchaseRequestLineUnavailableError(result.line);
		throw new PurchaseOrderStateError('notDraft');
	}

	/** Lines may order approved purchase request lines (`purchaseRequestItemId`), each on one live PO only. */
	async create(actorUserId: string, body: TPurchaseOrderBody): Promise<TPurchaseOrderSelect> {
		const { header, items } = await this.build(body);
		return this.written(await this.orders.create({ ...header, createdBy: actorUserId }, items));
	}

	async update(id: string, body: TPurchaseOrderBody): Promise<TPurchaseOrderSelect> {
		const order = await this.require(id);
		if (order.status !== 'draft') throw new PurchaseOrderStateError('notDraft');
		const { header, items } = await this.build(body);
		return this.written(await this.orders.replaceDraft(id, header, items));
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
			// ERP-0044: the approved PO is the outward-facing document; the
			// code is allocated above, so the registry copies it verbatim.
			await this.documents.register({
				code: approved.code ?? code,
				documentType: 'purchase_order',
				module: 'procurement',
				sourceType: 'purchase_order',
				sourceId: approved.id,
				organizationId: null,
				issuedOn: approved.orderDate,
				issuedByUserId: actorUserId,
			});
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
		// Its purchase request lines are open for ordering again.
		await this.orders.syncRequestsOfOrder(id);
		// ERP-0044: a cancelled PO is a dead document in the registry.
		await this.documents.voidBySource('procurement', 'purchase_order', id);
		return updated;
	}
}
