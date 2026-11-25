import { STOCK_SERVICE_TOKEN } from '@app/inventory/constants/di';
import { PRODUCT_SERVICE_TOKEN } from '@app/product/constants/di';
import { WAREHOUSE_SERVICE_TOKEN } from '@app/warehouse/constants/di';
import type { WarehouseService } from '@app/warehouse/services/warehouse.service';
import type { ProductService } from '@app/product/services/product.service';
import { SERIAL_UNIT_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { SerialUnitService } from '@app/inventory/services/serial-unit.service';
import type { StockService } from '@app/inventory/services/stock.service';
import { exVatUnitCost } from '@app/inventory/utils/moving-average';
import { POSTING_SERVICE_TOKEN } from '@app/finance/constants/di';
import type { PostingService } from '@app/finance/services/posting.service';
import { inventoryValue } from '@app/finance/utils/inventory-value';
import { PROCUREMENT_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { ProcurementNumberingService } from './procurement-numbering.service';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document/constants/di';
import type { DocumentService } from '@app/document';
import type {
	TGoodsReceiptItemSelect,
	TPurchaseOrderItemSelect,
	TPurchaseOrderSelect,
} from '@drizzle/schemas/procurement.schema';
import { businessDateOf } from '@utils/business-date.util';
import { quantityToMilli } from '@utils/money.util';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { GOODS_RECEIPT_REPOSITORY_TOKEN, PURCHASE_ORDER_REPOSITORY_TOKEN } from '../constants/di';
import type { TCreateGoodsReceipt, TGoodsReceiptListQuery } from '../contracts/goods-receipt.contract';
import type {
	IGoodsReceiptRepository,
	TGoodsReceiptRow,
} from '../contracts/goods-receipt.repository.interface';
import type { IPurchaseOrderRepository } from '../contracts/procurement.repository.interface';
import {
	GoodsReceiptBinError,
	GoodsReceiptLineError,
	GoodsReceiptNotFoundError,
	GoodsReceiptOrderNotReceivableError,
	PurchaseOrderItemUnavailableError,
} from '../errors/procurement.errors';

export type TGoodsReceiptDetail = TGoodsReceiptRow & {
	items: TGoodsReceiptItemSelect[];
	warehouse: { code: string; name: string } | null;
	bin: { code: string; name: string | null } | null;
};

/** A warehouse goods can be received into, with its active storages. */
export type TReceivingWarehouse = {
	id: string;
	code: string;
	name: string;
	storages: { id: string; code: string; name: string | null }[];
};

/** A PO the warehouse can receive against, with what is still open per line. */
export type TReceivableOrder = Pick<TPurchaseOrderSelect, 'id' | 'code' | 'subject' | 'status' | 'orderDate'> & {
	supplierName: string;
	items: (Pick<TPurchaseOrderItemSelect, 'id' | 'productId' | 'sku' | 'name' | 'unit' | 'quantity' | 'quantityReceived'> & {
		openQuantity: string;
		isSerialized: boolean;
	})[];
};

const open = (item: Pick<TPurchaseOrderItemSelect, 'quantity' | 'quantityReceived'>) =>
	(Number(quantityToMilli(item.quantity) - quantityToMilli(item.quantityReceived)) / 1000).toFixed(3);

/**
 * Goods receipts (ADR-0011 step 4b): posted on creation and immutable.
 *
 * @remarks
 * One unit of work (the transaction runner) writes the receipt, the PO
 * progress, one `receipt` stock movement per line valued at the ex-VAT unit
 * price (moving-average cost, ADR-0011 §5), and an `in_stock` serial unit per
 * received serial — or none of them. Corrections go through stock
 * adjustments.
 */
@injectable()
export class GoodsReceiptService {
	constructor(
		@inject(GOODS_RECEIPT_REPOSITORY_TOKEN)
		private readonly receipts: IGoodsReceiptRepository,
		@inject(PURCHASE_ORDER_REPOSITORY_TOKEN)
		private readonly orders: Pick<IPurchaseOrderRepository, 'findById' | 'findItems' | 'paginate' | 'receive'>,
		@inject(STOCK_SERVICE_TOKEN)
		private readonly stock: Pick<StockService, 'postMovement' | 'resolveScope'>,
		@inject(PRODUCT_SERVICE_TOKEN)
		private readonly items: Pick<ProductService, 'getProduct'>,
		/** Unit registration stayed in inventory when the product master moved (ADR-0026). */
		@inject(SERIAL_UNIT_SERVICE_TOKEN)
		private readonly units: Pick<SerialUnitService, 'registerUnit'>,
		@inject(PROCUREMENT_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<ProcurementNumberingService, 'next'>,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
		@inject(WAREHOUSE_SERVICE_TOKEN)
		private readonly warehouses: Pick<WarehouseService, 'paginate' | 'getWarehouse'>,
		/** ERP-0044: received goods are recorded in the registry. */
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<DocumentService, 'register'>,
		/** ERP-0136: received stock posts Dr inventory / Cr GR/IR. */
		@inject(POSTING_SERVICE_TOKEN)
		private readonly posting?: Pick<PostingService, 'postBusinessEvent'>,
	) {}

	list(query: TGoodsReceiptListQuery): Promise<TPaginationResult<TGoodsReceiptRow>> {
		return this.receipts.paginate(query);
	}

	async get(id: string): Promise<TGoodsReceiptDetail> {
		const receipt = await this.receipts.findById(id);
		if (!receipt) throw new GoodsReceiptNotFoundError();
		const [items, warehouse] = await Promise.all([
			this.receipts.findItems(id),
			receipt.warehouseId ? this.warehouses.getWarehouse(receipt.warehouseId).catch(() => null) : null,
		]);
		const bin = warehouse?.storages.find((storage) => storage.id === receipt.binId) ?? null;
		return {
			...receipt,
			items,
			warehouse: warehouse ? { code: warehouse.code, name: warehouse.name } : null,
			bin: bin ? { code: bin.code, name: bin.name } : null,
		};
	}

	/**
	 * Active warehouses with their active storages, for the receiving form
	 * (the warehouse admin pages are application-admin only, ADR-0008).
	 */
	async receivingWarehouses(): Promise<TReceivingWarehouse[]> {
		const page = await this.warehouses.paginate({ page: 1, limit: 100, isActive: true });
		return Promise.all(
			page.data.map(async (warehouse) => {
				const detail = await this.warehouses.getWarehouse(warehouse.id);
				return {
					id: warehouse.id,
					code: warehouse.code,
					name: warehouse.name,
					storages: detail.storages
						.filter((storage) => storage.isActive && !storage.deletedAt)
						.map((storage) => ({ id: storage.id, code: storage.code, name: storage.name })),
				};
			}),
		);
	}

	/** POs that can still be received (sent or partly received), newest first. */
	async receivableOrders(search?: string): Promise<TReceivableOrder[]> {
		const pages = await Promise.all(
			(['sent', 'partially_received'] as const).map((status) => this.orders.paginate({ page: 1, limit: 50, status, search })),
		);
		const orders = pages.flatMap((page) => page.data);
		return Promise.all(
			orders.map(async (order) => {
				const lines = await this.orders.findItems(order.id);
				const withKind = await Promise.all(
					lines.map(async (line) => ({
						id: line.id,
						productId: line.productId,
						sku: line.sku,
						name: line.name,
						unit: line.unit,
						quantity: line.quantity,
						quantityReceived: line.quantityReceived,
						openQuantity: open(line),
						isSerialized: line.productId
							? ((await this.items.getProduct(line.productId).catch(() => null))?.isSerialized ?? false)
							: false,
					})),
				);
				return {
					id: order.id,
					code: order.code,
					subject: order.subject,
					status: order.status,
					orderDate: order.orderDate,
					supplierName: order.supplierSnapshot.name,
					items: withKind,
				};
			}),
		);
	}

	/**
	 * Posts a goods receipt.
	 *
	 * @throws {GoodsReceiptOrderNotReceivableError} The PO is not sent / partly received
	 * @throws {GoodsReceiptLineError} A line is unknown, over the open quantity, or
	 * misses its serial numbers
	 */
	async create(actor: { userId: string; organizationId: string }, body: TCreateGoodsReceipt): Promise<TGoodsReceiptDetail> {
		const order = await this.orders.findById(body.purchaseOrderId);
		if (!order || (order.status !== 'sent' && order.status !== 'partially_received')) {
			throw new GoodsReceiptOrderNotReceivableError();
		}
		await this.stock.resolveScope(body.warehouseId);
		if (body.binId) {
			const warehouse = await this.warehouses.getWarehouse(body.warehouseId);
			if (!warehouse.storages.some((storage) => storage.id === body.binId && storage.isActive)) {
				throw new GoodsReceiptBinError();
			}
		}
		const poItems = new Map((await this.orders.findItems(order.id)).map((item) => [item.id, item]));

		const lines = await Promise.all(
			body.lines.map(async (line, index) => {
				const poItem = poItems.get(line.purchaseOrderItemId);
				if (!poItem) throw new GoodsReceiptLineError('unknown', index + 1);
				if (quantityToMilli(line.quantity) > quantityToMilli(open(poItem))) throw new GoodsReceiptLineError('over', index + 1);
				// ADR-0014: a PO line is not guaranteed to carry its product; no product, no stock.
				const productId = poItem.productId;
				if (!productId) throw new PurchaseOrderItemUnavailableError(index + 1);
				const item = await this.items.getProduct(productId);
				const serials = line.serialNumbers ?? [];
				if (item.isSerialized) {
					const units = Number(line.quantity);
					if (!Number.isInteger(units) || serials.length !== units || new Set(serials).size !== serials.length) {
						throw new GoodsReceiptLineError('serials', index + 1);
					}
				}
				return { line, poItem, productId, item, serials: item.isSerialized ? serials : [] };
			}),
		);

		const receiptDate = body.receiptDate ?? businessDateOf();
		const code = await this.numbering.next('goods_receipt', { date: new Date(`${receiptDate}T12:00:00+07:00`) });
		const occurredAt = new Date(`${receiptDate}T12:00:00+07:00`);

		const created = await this.transactions.run(async (tx) => {
			const progress = await this.orders.receive(
				order.id,
				lines.map(({ line }) => ({ purchaseOrderItemId: line.purchaseOrderItemId, quantity: line.quantity })),
				tx,
			);
			if (!progress.ok) {
				if (progress.reason === 'overReceived') throw new GoodsReceiptLineError('over', progress.line ?? 1);
				throw new GoodsReceiptOrderNotReceivableError();
			}
			const { receipt, items } = await this.receipts.create(
				{
					code,
					purchaseOrderId: order.id,
					warehouseId: body.warehouseId,
					binId: body.binId ?? null,
					receiptDate,
					supplierDeliveryRef: body.supplierDeliveryRef,
					receivedBy: actor.userId,
					notes: body.notes,
				},
				lines.map(({ line, poItem, productId, serials }) => ({
					purchaseOrderItemId: poItem.id,
					productId,
					sku: poItem.sku,
					name: poItem.name,
					unit: poItem.unit,
					quantity: line.quantity,
					unitCost: exVatUnitCost(poItem.unitPrice, order.vatMode === 'included', order.vatRateBps),
					serialNumbers: serials.length ? serials : null,
				})),
				tx,
			);
			for (const [index, row] of items.entries()) {
				const { poItem, productId, item, serials } = lines[index]!;
				const posted = await this.stock.postMovement(
					{
						actorOrganizationId: actor.organizationId,
						warehouseId: body.warehouseId,
						binId: body.binId ?? null,
						productId,
						movementType: 'receipt',
						quantity: row.quantity,
						unitCost: row.unitCost,
						occurredAt,
						referenceType: 'goods_receipt',
						referenceId: receipt.id,
						createdBy: actor.userId,
						notes: `${code} · ${order.code ?? ''}`,
					},
					tx,
				);
				await this.receipts.setMovement(row.id, posted.movement.id, tx);
				for (const serialNumber of serials) {
					await this.units.registerUnit(
						productId,
						{
							serialNumber,
							organizationId: item.organizationId,
							status: 'in_stock',
							warehouseId: body.warehouseId,
							binId: body.binId ?? null,
							acquiredOn: receiptDate,
							purchaseOrderLineId: poItem.id,
							movementId: posted.movement.id,
						},
						tx,
					);
				}
			}
			// ERP-0136 (ADR-0030, grill Q24): stock lines are valued at the ex-VAT
			// order price and parked in GR/IR until the supplier bill clears it.
			const stockLines = items
				.map((row, index) => ({ row, item: lines[index]!.item }))
				.filter(({ item }) => item.isStockTracked)
				.map(({ row }) => ({ productId: row.productId, value: inventoryValue(row.quantity, row.unitCost) }))
				.filter((line) => line.value > 0);
			const total = stockLines.reduce((sum, line) => sum + line.value, 0);
			if (this.posting && total > 0) {
				await this.posting.postBusinessEvent(tx, {
					organizationId: actor.organizationId,
					entryDate: receiptDate,
					sourceModule: 'procurement',
					sourceType: 'goods_receipt',
					sourceId: receipt.id,
					idempotencyKey: `goods_receipt:${receipt.id}`,
					eventType: 'procurement.goods_received',
					description: `Goods receipt ${code}`,
					lines: [
						...stockLines.map((line) => ({ role: 'inventory', debit: line.value, credit: 0, productId: line.productId })),
						{
							role: 'grir_clearing',
							debit: 0,
							credit: total,
							partyType: 'supplier',
							partyId: order.supplierCompanyId ?? null,
						},
					],
				});
			}
			return receipt;
		});
		// ERP-0044: the BPB (bukti penerimaan barang) is an issued document. No
		// void path exists - a receipt is never cancelled, only superseded by a
		// correction, which the registry keeps as history.
		await this.documents.register({
			code: created.code,
			title: `Penerimaan Barang - ${order.supplierSnapshot.name}`,
			documentType: 'goods_receipt',
			module: 'procurement',
			sourceType: 'goods_receipt',
			sourceId: created.id,
			organizationId: null,
			issuedOn: created.receiptDate,
			issuedByUserId: actor.userId,
		});
		return this.get(created.id);
	}
}
