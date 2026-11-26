import { STOCK_SERVICE_TOKEN } from '@app/inventory/constants/di';
import { PRODUCT_SERVICE_TOKEN } from '@app/product/constants/di';
import { WAREHOUSE_SERVICE_TOKEN } from '@app/warehouse/constants/di';
import type { ProductService } from '@app/product/services/product.service';
import { SERIAL_UNIT_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { SerialUnitService } from '@app/inventory/services/serial-unit.service';
import type { StockService } from '@app/inventory/services/stock.service';
import type { WarehouseService } from '@app/warehouse/services/warehouse.service';
import { PROCUREMENT_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { ProcurementNumberingService } from './procurement-numbering.service';
import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document/constants/di';
import type { DocumentService } from '@app/document';
import { isUniqueViolation } from '@drizzle/errors';
import { POSTING_SERVICE_TOKEN } from '@app/finance/constants/di';
import type { PostingService } from '@app/finance/services/posting.service';
import { inventoryValue } from '@app/finance/utils/inventory-value';
import type {
	PurchaseReturnStatus,
	TGoodsReceiptItemSelect,
	TPurchaseReturnItemSelect,
	TPurchaseReturnSelect,
} from '@drizzle/schemas/procurement.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { businessDateOf } from '@utils/business-date.util';
import { quantityToMilli } from '@utils/money.util';
import { inject, injectable } from 'tsyringe';
import {
	GOODS_RECEIPT_REPOSITORY_TOKEN,
	PURCHASE_ORDER_REPOSITORY_TOKEN,
	PURCHASE_RETURN_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IGoodsReceiptRepository, TGoodsReceiptRow } from '../contracts/goods-receipt.repository.interface';
import type { IPurchaseOrderRepository } from '../contracts/procurement.repository.interface';
import type {
	TPurchaseReturnBody,
	TPurchaseReturnDecision,
	TPurchaseReturnListQuery,
} from '../contracts/purchase-return.contract';
import type {
	IPurchaseReturnRepository,
	TPurchaseReturnHeaderData,
	TPurchaseReturnItemData,
	TPurchaseReturnRow,
	TReturnedOnLine,
} from '../contracts/purchase-return.repository.interface';
import {
	ProcurementWarehouseRequiredError,
	PurchaseOrderItemUnavailableError,
	PurchaseOrderSupplierUnavailableError,
	PurchaseReturnCodeTakenError,
	PurchaseReturnLineError,
	PurchaseReturnNotFoundError,
	PurchaseReturnReceiptError,
	PurchaseReturnSelfApprovalError,
	PurchaseReturnStateError,
} from '../errors/procurement.errors';
import { type PurchaseReturnChange, purchaseReturnUpdatedEvent } from '../utils/purchase-return-event';

/** Statuses whose lines still hold goods receipt quantity (not cancelled). */
const LIVE_STATUSES: readonly PurchaseReturnStatus[] = ['draft', 'submitted', 'approved', 'shipped'];

export type TPurchaseReturnDetail = TPurchaseReturnRow & {
	items: TPurchaseReturnItemSelect[];
	warehouse: { code: string; name: string } | null;
	bin: { code: string; name: string | null } | null;
};

/** A goods receipt goods can be returned from, with what is left per line. */
export type TReturnableReceipt = Pick<TGoodsReceiptRow, 'id' | 'code' | 'receiptDate' | 'purchaseOrderId' | 'purchaseOrderCode' | 'supplierName'> & {
	items: (Pick<TGoodsReceiptItemSelect, 'id' | 'productId' | 'sku' | 'name' | 'unit' | 'quantity'> & {
		returnableQuantity: string;
		/** Serials of this receipt line still in stock and not on another return. */
		serialNumbers: string[];
		isSerialized: boolean;
	})[];
};

const toQuantity = (milli: bigint) => (Number(milli) / 1000).toFixed(3);
const lineTotal = (quantity: string, unitCost: number) => Math.round(Number(quantity) * unitCost);

/**
 * Purchase returns (ERP-0068): goods received on a BPB go back to the
 * supplier for replacement.
 *
 * @remarks
 * - Created from one goods receipt; a line never takes more than the
 *   receipt line minus what live returns already take, and a serialized
 *   line names the receipt's own serials that are still in stock.
 * - One-level approval with `purchase_return:approve`, never by the creator;
 *   rejection returns to draft with the reason. Numbered on approval.
 * - Shipping is one unit of work: `return_out` stock movements from the
 *   receipt's warehouse, the serial units `returned`, and the quantities
 *   taken off the PO lines (the PO re-opens), so the replacement arrives on
 *   a normal goods receipt. No credit note, refund or journal.
 * - Cancelling is allowed until shipped.
 */
@injectable()
export class PurchaseReturnService {
	constructor(
		@inject(PURCHASE_RETURN_REPOSITORY_TOKEN)
		private readonly returns: IPurchaseReturnRepository,
		@inject(GOODS_RECEIPT_REPOSITORY_TOKEN)
		private readonly receipts: Pick<IGoodsReceiptRepository, 'findById' | 'findItems' | 'paginate'>,
		@inject(PURCHASE_ORDER_REPOSITORY_TOKEN)
		private readonly orders: Pick<IPurchaseOrderRepository, 'findById' | 'unreceive'>,
		@inject(STOCK_SERVICE_TOKEN)
		private readonly stock: Pick<StockService, 'postMovement'>,
		@inject(PRODUCT_SERVICE_TOKEN)
		private readonly items: Pick<ProductService, 'getProduct'>,
		/** Unit custody stayed in inventory when the product master moved (ADR-0026). */
		@inject(SERIAL_UNIT_SERVICE_TOKEN)
		private readonly units: Pick<SerialUnitService, 'supplierReturnableSerials' | 'returnUnits'>,
		@inject(WAREHOUSE_SERVICE_TOKEN)
		private readonly warehouses: Pick<WarehouseService, 'getWarehouse'>,
		@inject(PROCUREMENT_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<ProcurementNumberingService, 'next'>,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
		/** ERP-0044: approved returns are recorded in the document registry. */
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<DocumentService, 'register' | 'voidBySource'>,
		/** M04: every state change goes to n8n as `purchase_return.updated`. */
		@inject(OUTBOX_SERVICE_TOKEN)
		private readonly outbox: Pick<OutboxService, 'publish'>,
		/** ERP-0136: shipped returns post Dr GR/IR / Cr inventory. */
		@inject(POSTING_SERVICE_TOKEN)
		private readonly posting?: Pick<PostingService, 'postBusinessEvent'>,
	) {}

	/** Publishes `purchase_return.updated` after a committed change; never throws. */
	private async changed(id: string, change: PurchaseReturnChange, actorUserId: string): Promise<void> {
		try {
			const row = await this.returns.findById(id);
			if (!row) return;
			const [items, order] = await Promise.all([this.returns.findItems(id), this.orders.findById(row.purchaseOrderId)]);
			await this.outbox.publish(
				'purchase_return.updated',
				{ type: 'purchase_return', id },
				purchaseReturnUpdatedEvent(row, items, change, order?.supplierSnapshot ?? null, actorUserId),
			);
		} catch {
			// The outbox logs its own failures; a notification never undoes a return.
		}
	}

	private async require(id: string): Promise<TPurchaseReturnRow> {
		const row = await this.returns.findById(id);
		if (!row) throw new PurchaseReturnNotFoundError();
		return row;
	}

	list(query: TPurchaseReturnListQuery): Promise<TPaginationResult<TPurchaseReturnRow>> {
		return this.returns.paginate(query);
	}

	async get(id: string): Promise<TPurchaseReturnDetail> {
		const row = await this.require(id);
		const [items, warehouse] = await Promise.all([
			this.returns.findItems(id),
			row.warehouseId ? this.warehouses.getWarehouse(row.warehouseId).catch(() => null) : null,
		]);
		const bin = warehouse?.storages.find((storage) => storage.id === row.binId) ?? null;
		return {
			...row,
			items,
			warehouse: warehouse ? { code: warehouse.code, name: warehouse.name } : null,
			bin: bin ? { code: bin.code, name: bin.name } : null,
		};
	}

	/** Lines of a receipt with what is still returnable (live returns excluded). */
	private async returnableLines(receipt: TGoodsReceiptRow, excludeReturnId?: string) {
		const lines = await this.receipts.findItems(receipt.id);
		const taken = await this.returns.returnedOnLines(
			lines.map((line) => line.id),
			LIVE_STATUSES,
			excludeReturnId,
		);
		return Promise.all(
			lines.map(async (line) => {
				const used: TReturnedOnLine = taken.get(line.id) ?? { quantityMilli: 0n, serialNumbers: [] };
				const item = line.productId ? await this.items.getProduct(line.productId).catch(() => null) : null;
				const isSerialized = item?.isSerialized ?? false;
				let serialNumbers: string[] = [];
				if (isSerialized && line.productId && receipt.warehouseId) {
					// ERP-0065: units a customer returned damaged go back too.
					const inStock = new Set(await this.units.supplierReturnableSerials(line.productId, receipt.warehouseId));
					const onReturns = new Set(used.serialNumbers);
					serialNumbers = (line.serialNumbers ?? []).filter((serial) => inStock.has(serial) && !onReturns.has(serial));
				}
				const leftMilli = quantityToMilli(line.quantity) - used.quantityMilli;
				return { line, isSerialized, serialNumbers, returnableMilli: leftMilli > 0n ? leftMilli : 0n };
			}),
		);
	}

	/**
	 * Recent goods receipts that still have something to return, for the
	 * return form (only receipts of a received or partly received PO).
	 */
	async returnableReceipts(search?: string): Promise<TReturnableReceipt[]> {
		const page = await this.receipts.paginate({ page: 1, limit: 30, search });
		const result: TReturnableReceipt[] = [];
		for (const receipt of page.data) {
			const order = await this.orders.findById(receipt.purchaseOrderId);
			if (!order || (order.status !== 'partially_received' && order.status !== 'received')) continue;
			const lines = await this.returnableLines(receipt);
			const items = lines
				.filter(({ returnableMilli }) => returnableMilli > 0n)
				.map(({ line, isSerialized, serialNumbers, returnableMilli }) => ({
					id: line.id,
					productId: line.productId,
					sku: line.sku,
					name: line.name,
					unit: line.unit,
					quantity: line.quantity,
					returnableQuantity: toQuantity(returnableMilli),
					serialNumbers,
					isSerialized,
				}));
			if (items.length === 0) continue;
			result.push({
				id: receipt.id,
				code: receipt.code,
				receiptDate: receipt.receiptDate,
				purchaseOrderId: receipt.purchaseOrderId,
				purchaseOrderCode: receipt.purchaseOrderCode,
				supplierName: receipt.supplierName,
				items,
			});
		}
		return result;
	}

	/**
	 * Builds a return from its goods receipt.
	 *
	 * @throws {PurchaseReturnReceiptError} Unknown receipt, or its PO is not received
	 * @throws {PurchaseReturnLineError} A line is unknown, repeated, over what is
	 * returnable, or names wrong serials
	 */
	private async build(
		body: TPurchaseReturnBody,
		excludeReturnId?: string,
	): Promise<{ header: TPurchaseReturnHeaderData; items: TPurchaseReturnItemData[] }> {
		const receipt = await this.receipts.findById(body.goodsReceiptId);
		if (!receipt) throw new PurchaseReturnReceiptError();
		const order = await this.orders.findById(receipt.purchaseOrderId);
		if (!order || (order.status !== 'partially_received' && order.status !== 'received')) {
			throw new PurchaseReturnReceiptError();
		}
		// ADR-0014: the receipt and the order no longer guarantee these; a return needs both.
		const { warehouseId } = receipt;
		if (!warehouseId) throw new ProcurementWarehouseRequiredError();
		const { supplierCompanyId } = order;
		if (!supplierCompanyId) throw new PurchaseOrderSupplierUnavailableError();
		const returnable = new Map((await this.returnableLines(receipt, excludeReturnId)).map((entry) => [entry.line.id, entry]));
		const seen = new Set<string>();
		const items: TPurchaseReturnItemData[] = body.lines.map((line, index) => {
			const entry = returnable.get(line.goodsReceiptItemId);
			if (!entry) throw new PurchaseReturnLineError('unknown', index + 1);
			if (seen.has(line.goodsReceiptItemId)) throw new PurchaseReturnLineError('duplicate', index + 1);
			seen.add(line.goodsReceiptItemId);
			if (quantityToMilli(line.quantity) > entry.returnableMilli) throw new PurchaseReturnLineError('over', index + 1);
			const serials = line.serialNumbers ?? [];
			if (entry.isSerialized) {
				const units = Number(line.quantity);
				const allowed = new Set(entry.serialNumbers);
				if (
					!Number.isInteger(units) ||
					serials.length !== units ||
					new Set(serials).size !== serials.length ||
					serials.some((serial) => !allowed.has(serial))
				) {
					throw new PurchaseReturnLineError('serials', index + 1);
				}
			}
			const { line: receiptLine } = entry;
			if (!receiptLine.productId) throw new PurchaseOrderItemUnavailableError(index + 1);
			return {
				goodsReceiptItemId: receiptLine.id,
				purchaseOrderItemId: receiptLine.purchaseOrderItemId,
				productId: receiptLine.productId,
				sku: receiptLine.sku,
				name: receiptLine.name,
				unit: receiptLine.unit,
				quantity: line.quantity,
				unitCost: receiptLine.unitCost,
				lineTotal: lineTotal(line.quantity, receiptLine.unitCost),
				serialNumbers: entry.isSerialized ? serials : null,
			};
		});
		return {
			header: {
				goodsReceiptId: receipt.id,
				purchaseOrderId: receipt.purchaseOrderId,
				supplierCompanyId,
				warehouseId,
				binId: receipt.binId,
				returnDate: body.returnDate ?? businessDateOf(),
				reason: body.reason,
				notes: body.notes,
				totalAmount: items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0),
			},
			items,
		};
	}

	async create(actorUserId: string, body: TPurchaseReturnBody): Promise<TPurchaseReturnSelect> {
		const { header, items } = await this.build(body);
		return this.returns.create({ ...header, createdBy: actorUserId }, items);
	}

	async update(id: string, body: TPurchaseReturnBody): Promise<TPurchaseReturnSelect> {
		const row = await this.require(id);
		if (row.status !== 'draft') throw new PurchaseReturnStateError('notDraft');
		const { header, items } = await this.build(body, id);
		const updated = await this.returns.replaceDraft(id, header, items);
		if (!updated) throw new PurchaseReturnStateError('notDraft');
		return updated;
	}

	async submit(actorUserId: string, id: string): Promise<TPurchaseReturnSelect> {
		await this.require(id);
		const updated = await this.returns.transition(id, ['draft'], 'submitted', {
			submittedBy: actorUserId,
			submittedAt: new Date(),
			rejectionReason: null,
		});
		if (!updated) throw new PurchaseReturnStateError('notDraft');
		await this.changed(id, 'submitted', actorUserId);
		return updated;
	}

	/** Approves (numbering it) or rejects back to draft — never one's own return. */
	async decide(actorUserId: string, id: string, input: TPurchaseReturnDecision): Promise<TPurchaseReturnSelect> {
		const row = await this.require(id);
		if (row.status !== 'submitted') throw new PurchaseReturnStateError('notSubmitted');
		if (row.createdBy === actorUserId) throw new PurchaseReturnSelfApprovalError();
		if (input.decision === 'reject') {
			const rejected = await this.returns.transition(id, ['submitted'], 'draft', { rejectionReason: input.reason ?? null });
			if (!rejected) throw new PurchaseReturnStateError('notSubmitted');
			await this.changed(id, 'rejected', actorUserId);
			return rejected;
		}
		const code = await this.numbering.next('purchase_return', { date: new Date(`${row.returnDate}T12:00:00+07:00`) });
		try {
			const approved = await this.returns.transition(id, ['submitted'], 'approved', {
				code,
				approvedBy: actorUserId,
				approvedAt: new Date(),
				rejectionReason: null,
			});
			if (!approved) throw new PurchaseReturnStateError('notSubmitted');
			// ERP-0044: the approved return goes to the supplier with the goods.
			await this.documents.register({
				code: approved.code ?? code,
				title: `Retur Pembelian - ${row.supplierName}`,
				documentType: 'purchase_return',
				module: 'procurement',
				sourceType: 'purchase_return',
				sourceId: approved.id,
				organizationId: null,
				issuedOn: approved.returnDate,
				issuedByUserId: actorUserId,
			});
			await this.changed(id, 'approved', actorUserId);
			return approved;
		} catch (error) {
			if (isUniqueViolation(error)) throw new PurchaseReturnCodeTakenError(code);
			throw error;
		}
	}

	/**
	 * Approved → shipped: the goods leave the warehouse.
	 *
	 * @throws {PurchaseReturnStateError} Not approved (also a concurrent ship)
	 * @throws {PurchaseReturnLineError} Over the receipt line, or a serial left stock
	 * @throws {PurchaseReturnReceiptError} The PO can no longer take the return
	 */
	async ship(
		actor: { userId: string; organizationId: string },
		id: string,
		shipDate?: string | null,
	): Promise<TPurchaseReturnSelect> {
		const head = await this.require(id);
		const occurredAt = new Date(`${shipDate ?? businessDateOf()}T12:00:00+07:00`);
		const shipped = await this.transactions.run(async (tx) => {
			const row = await this.returns.claimForShip(id, tx);
			if (!row) throw new PurchaseReturnStateError('notApproved');
			const { warehouseId } = row;
			if (!warehouseId) throw new ProcurementWarehouseRequiredError();
			const lines = await this.returns.findItems(id);
			const receiptLines = new Map((await this.receipts.findItems(row.goodsReceiptId)).map((line) => [line.id, line]));
			const shipped = await this.returns.returnedOnLines(
				lines.map((line) => line.goodsReceiptItemId),
				['shipped'],
				id,
				tx,
			);
			for (const [index, line] of lines.entries()) {
				const receiptLine = receiptLines.get(line.goodsReceiptItemId);
				const already = shipped.get(line.goodsReceiptItemId)?.quantityMilli ?? 0n;
				if (!receiptLine || already + quantityToMilli(line.quantity) > quantityToMilli(receiptLine.quantity)) {
					throw new PurchaseReturnLineError('over', index + 1);
				}
			}
			const progress = await this.orders.unreceive(
				row.purchaseOrderId,
				lines.map((line) => ({ purchaseOrderItemId: line.purchaseOrderItemId, quantity: line.quantity })),
				tx,
			);
			if (!progress.ok) {
				if (progress.reason === 'overReturned') throw new PurchaseReturnLineError('over', progress.line ?? 1);
				throw new PurchaseReturnReceiptError();
			}
			// A receipt line that posted no movement was a non-stock product (a
			// licence, a service): it left no stock and no inventory value, so its
			// return moves neither.
			const stocked = (line: (typeof lines)[number]) => Boolean(receiptLines.get(line.goodsReceiptItemId)?.movementId);
			for (const [index, line] of lines.entries()) {
				const { productId } = line;
				if (!productId) throw new PurchaseOrderItemUnavailableError(index + 1);
				if (!stocked(line)) continue;
				const posted = await this.stock.postMovement(
					{
						actorOrganizationId: actor.organizationId,
						warehouseId,
						binId: row.binId,
						productId,
						movementType: 'return_out',
						quantity: line.quantity,
						unitCost: line.unitCost,
						occurredAt,
						referenceType: 'purchase_return',
						referenceId: row.id,
						createdBy: actor.userId,
						notes: `${row.code ?? ''} · ${head.goodsReceiptCode}`,
					},
					tx,
				);
				await this.returns.setMovement(line.id, posted.movement.id, tx);
				const serials = line.serialNumbers ?? [];
				if (serials.length) {
					const missing = await this.units.returnUnits(
						productId,
						serials,
						{ warehouseId, movementId: posted.movement.id },
						tx,
					);
					if (missing.length) throw new PurchaseReturnLineError('notInStock', index + 1);
				}
			}
			// ERP-0136: the goods leave at their receipt cost; GR/IR is debited
			// back. Units already billed keep a GR/IR debit until a supplier
			// credit note exists (not built, see finance.md).
			const returnLines = lines
				.filter(stocked)
				.map((line) => ({ productId: line.productId, value: inventoryValue(line.quantity, line.unitCost) }))
				.filter((line) => line.value > 0);
			const total = returnLines.reduce((sum, line) => sum + line.value, 0);
			let journalEntryId: string | null = null;
			if (this.posting && total > 0) {
				const { entry } = await this.posting.postBusinessEvent(tx, {
					organizationId: actor.organizationId,
					entryDate: occurredAt.toISOString().slice(0, 10),
					sourceModule: 'procurement',
					sourceType: 'purchase_return',
					sourceId: row.id,
					idempotencyKey: `purchase_return:${row.id}`,
					eventType: 'procurement.purchase_returned',
					description: `Purchase return ${row.code ?? ''}`.trim(),
					lines: [
						{ role: 'grir_clearing', debit: total, credit: 0 },
						...returnLines.map((line) => ({ role: 'inventory', debit: 0, credit: line.value, productId: line.productId })),
					],
				});
				journalEntryId = entry.id;
			}
			const updated = await this.returns.transition(
				id,
				['approved'],
				'shipped',
				{ shippedBy: actor.userId, shippedAt: new Date(), journalEntryId },
				tx,
			);
			if (!updated) throw new PurchaseReturnStateError('notApproved');
			return updated;
		});
		await this.changed(id, 'shipped', actor.userId);
		return shipped;
	}

	async cancel(actorUserId: string, id: string, reason: string): Promise<TPurchaseReturnSelect> {
		const row = await this.require(id);
		const updated = await this.returns.transition(id, ['draft', 'submitted', 'approved'], 'cancelled', {
			cancelledBy: actorUserId,
			cancelledAt: new Date(),
			cancelledReason: reason,
		});
		if (!updated) throw new PurchaseReturnStateError('notCancellable');
		// ERP-0044: an approved return that is cancelled is a dead document.
		if (row.code) await this.documents.voidBySource('procurement', 'purchase_return', id);
		await this.changed(id, 'cancelled', actorUserId);
		return updated;
	}
}
