import { ITEM_SERVICE_TOKEN, STOCK_SERVICE_TOKEN, WAREHOUSE_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { ItemService } from '@app/inventory/services/item.service';
import type { StockService } from '@app/inventory/services/stock.service';
import type { WarehouseService } from '@app/inventory/services/warehouse.service';
import { NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { NumberingService } from '@app/organization/services/numbering.service';
import type {
	TDeliveryNoteItemSelect,
	TSalesOrderItemSelect,
	TSalesOrderSelect,
} from '@drizzle/schemas/sales.schema';
import { businessDateOf } from '@utils/business-date.util';
import { quantityToMilli } from '@utils/money.util';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { DELIVERY_NOTE_REPOSITORY_TOKEN, SALES_ORDER_REPOSITORY_TOKEN } from '../constants/di';
import type {
	TCreateDeliveryNote,
	TDeliverDeliveryNote,
	TDeliveryNoteListQuery,
} from '../contracts/delivery-note.contract';
import type { IDeliveryNoteRepository, TDeliveryNoteRow } from '../contracts/delivery-note.repository.interface';
import type { ISalesOrderRepository } from '../contracts/sales-order.repository.interface';
import {
	DeliveryNoteBinError,
	DeliveryNoteLineError,
	DeliveryNoteNotFoundError,
	DeliveryNoteOrderNotDeliverableError,
	DeliveryNoteStateError,
} from '../errors/delivery-note.errors';

export type TDeliveryNoteDetail = TDeliveryNoteRow & {
	items: TDeliveryNoteItemSelect[];
	warehouse: { code: string; name: string } | null;
	bin: { code: string; name: string | null } | null;
};

/** A warehouse goods can be shipped from, with its active storages. */
export type TShippingWarehouse = {
	id: string;
	code: string;
	name: string;
	storages: { id: string; code: string; name: string | null }[];
};

/** An order that can still be delivered, with what is open per line. */
export type TDeliverableOrder = Pick<TSalesOrderSelect, 'id' | 'code' | 'title' | 'status' | 'orderDate' | 'attention'> & {
	customerName: string;
	customerAddress: string | null;
	customerContact: string | null;
	items: (Pick<TSalesOrderItemSelect, 'id' | 'itemId' | 'sku' | 'name' | 'unit' | 'quantity' | 'quantityDelivered' | 'unitPrice'> & {
		openQuantity: string;
		isSerialized: boolean;
		isStockTracked: boolean;
	})[];
};

const open = (item: Pick<TSalesOrderItemSelect, 'quantity' | 'quantityDelivered'>) =>
	(Number(quantityToMilli(item.quantity) - quantityToMilli(item.quantityDelivered)) / 1000).toFixed(3);

const noon = (date: string) => new Date(`${date}T12:00:00+07:00`);

/**
 * Delivery notes / surat jalan (ADR-0011 step 5a).
 *
 * @remarks
 * A note is numbered (`SJ`) and allocated against its order lines when
 * prepared, so it can be printed for the driver. Shipping is one unit of
 * work: one `issue` stock movement per stock-tracked line at the moving
 * average (the cost is kept on the line), the listed serial units sold to
 * the order's customer, the note `shipped` and the order `in_progress` — or
 * none of them. Only a prepared note can be cancelled; it gives its
 * quantities back to the order.
 */
@injectable()
export class DeliveryNoteService {
	constructor(
		@inject(DELIVERY_NOTE_REPOSITORY_TOKEN)
		private readonly notes: IDeliveryNoteRepository,
		@inject(SALES_ORDER_REPOSITORY_TOKEN)
		private readonly orders: Pick<
			ISalesOrderRepository,
			'findById' | 'findItems' | 'paginate' | 'allocateDelivery' | 'markInProgress'
		>,
		@inject(STOCK_SERVICE_TOKEN)
		private readonly stock: Pick<StockService, 'postMovement' | 'resolveScope'>,
		@inject(ITEM_SERVICE_TOKEN)
		private readonly items: Pick<ItemService, 'getItem' | 'inStockSerials' | 'sellUnits'>,
		@inject(NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<NumberingService, 'next'>,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
		@inject(WAREHOUSE_SERVICE_TOKEN)
		private readonly warehouses: Pick<WarehouseService, 'paginate' | 'getWarehouse'>,
	) {}

	list(query: TDeliveryNoteListQuery): Promise<TPaginationResult<TDeliveryNoteRow>> {
		return this.notes.paginate(query);
	}

	async get(id: string): Promise<TDeliveryNoteDetail> {
		const note = await this.notes.findById(id);
		if (!note) throw new DeliveryNoteNotFoundError();
		const [items, warehouse] = await Promise.all([
			this.notes.findItems(id),
			this.warehouses.getWarehouse(note.warehouseId).catch(() => null),
		]);
		const bin = warehouse?.storages.find((storage) => storage.id === note.binId) ?? null;
		return {
			...note,
			items,
			warehouse: warehouse ? { code: warehouse.code, name: warehouse.name } : null,
			bin: bin ? { code: bin.code, name: bin.name } : null,
		};
	}

	/** Active warehouses with their active storages, for the delivery form. */
	async shippingWarehouses(): Promise<TShippingWarehouse[]> {
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

	/** Serials of an item that are in stock in a warehouse (to pick from). */
	inStockSerials(itemId: string, warehouseId: string): Promise<string[]> {
		return this.items.inStockSerials(itemId, warehouseId);
	}

	/** Confirmed and in-progress orders with something left to deliver. */
	async deliverableOrders(search?: string): Promise<TDeliverableOrder[]> {
		const pages = await Promise.all(
			(['confirmed', 'in_progress'] as const).map((status) => this.orders.paginate({ page: 1, limit: 50, status, search })),
		);
		const result = await Promise.all(
			pages
				.flatMap((page) => page.data)
				.map(async (order) => {
					const lines = await this.orders.findItems(order.id);
					const items = await Promise.all(
						lines.map(async (line) => {
							const item = line.itemId ? await this.items.getItem(line.itemId).catch(() => null) : null;
							return {
								id: line.id,
								itemId: line.itemId,
								sku: line.sku,
								name: line.name,
								unit: line.unit,
								quantity: line.quantity,
								quantityDelivered: line.quantityDelivered,
								unitPrice: line.unitPrice,
								openQuantity: open(line),
								isSerialized: item?.isSerialized ?? false,
								isStockTracked: item?.isStockTracked ?? false,
							};
						}),
					);
					const snapshot = order.customerSnapshot;
					return {
						id: order.id,
						code: order.code,
						title: order.title,
						status: order.status,
						orderDate: order.orderDate,
						attention: order.attention,
						customerName: snapshot.name,
						customerAddress: [snapshot.addressLine, snapshot.postalCode].filter(Boolean).join(' ') || null,
						customerContact: [snapshot.phone, snapshot.email].filter(Boolean).join(' / ') || null,
						items,
					};
				}),
		);
		return result.filter((order) => order.items.some((item) => quantityToMilli(item.openQuantity) > 0n));
	}

	/**
	 * Prepares (and numbers) a delivery note against an order.
	 *
	 * @throws {DeliveryNoteOrderNotDeliverableError} The order is not confirmed / in progress
	 * @throws {DeliveryNoteLineError} A line is unknown, over the open quantity, or
	 * misses its serials (or they are not in stock in the warehouse)
	 * @throws {DeliveryNoteBinError} The storage is not one of the warehouse's
	 */
	async create(actorUserId: string, body: TCreateDeliveryNote): Promise<TDeliveryNoteDetail> {
		const order = await this.orders.findById(body.salesOrderId);
		if (!order || (order.status !== 'confirmed' && order.status !== 'in_progress')) {
			throw new DeliveryNoteOrderNotDeliverableError();
		}
		await this.stock.resolveScope(body.warehouseId);
		if (body.binId) {
			const warehouse = await this.warehouses.getWarehouse(body.warehouseId);
			if (!warehouse.storages.some((storage) => storage.id === body.binId && storage.isActive)) {
				throw new DeliveryNoteBinError();
			}
		}
		const orderItems = new Map((await this.orders.findItems(order.id)).map((item) => [item.id, item]));

		const lines = await Promise.all(
			body.lines.map(async (line, index) => {
				const orderItem = orderItems.get(line.salesOrderItemId);
				if (!orderItem) throw new DeliveryNoteLineError('unknown', index + 1);
				if (quantityToMilli(line.quantity) > quantityToMilli(open(orderItem))) {
					throw new DeliveryNoteLineError('over', index + 1);
				}
				const item = orderItem.itemId ? await this.items.getItem(orderItem.itemId).catch(() => null) : null;
				const serials = line.serialNumbers ?? [];
				if (item?.isSerialized) {
					const units = Number(line.quantity);
					if (!Number.isInteger(units) || serials.length !== units || new Set(serials).size !== serials.length) {
						throw new DeliveryNoteLineError('serials', index + 1);
					}
					const available = new Set(await this.items.inStockSerials(item.id, body.warehouseId));
					if (serials.some((serial) => !available.has(serial))) throw new DeliveryNoteLineError('notInStock', index + 1);
				}
				return { line, orderItem, serials: item?.isSerialized ? serials : [] };
			}),
		);

		const deliveryDate = body.deliveryDate ?? businessDateOf();
		const code = await this.numbering.next('delivery_note', { date: noon(deliveryDate) });
		const snapshot = order.customerSnapshot;

		const created = await this.transactions.run(async (tx) => {
			const allocation = await this.orders.allocateDelivery(
				order.id,
				lines.map(({ line }) => ({ salesOrderItemId: line.salesOrderItemId, quantity: line.quantity })),
				{},
				tx,
			);
			if (!allocation.ok) {
				if (allocation.reason === 'overDelivered') throw new DeliveryNoteLineError('over', allocation.line ?? 1);
				throw new DeliveryNoteOrderNotDeliverableError();
			}
			const { note } = await this.notes.create(
				{
					code,
					salesOrderId: order.id,
					warehouseId: body.warehouseId,
					binId: body.binId ?? null,
					deliveryDate,
					projectName: body.projectName ?? order.title,
					projectLocation: body.projectLocation,
					recipientName: body.recipientName ?? snapshot.name,
					recipientAddress: body.recipientAddress ?? ([snapshot.addressLine, snapshot.postalCode].filter(Boolean).join(' ') || null),
					recipientPic: body.recipientPic ?? order.attention,
					recipientContact: body.recipientContact ?? ([snapshot.phone, snapshot.email].filter(Boolean).join(' / ') || null),
					driverName: body.driverName,
					vehicleNumber: body.vehicleNumber,
					notes: body.notes,
					createdBy: actorUserId,
				},
				lines.map(({ line, orderItem, serials }, index) => ({
					salesOrderItemId: orderItem.id,
					itemId: orderItem.itemId,
					sku: orderItem.sku,
					name: orderItem.name,
					unit: orderItem.unit,
					quantity: line.quantity,
					unitPrice: orderItem.unitPrice,
					serialNumbers: serials.length ? serials : null,
					remarks: line.remarks,
					sortOrder: index,
				})),
				tx,
			);
			return note;
		});
		return this.get(created.id);
	}

	/**
	 * Ships a prepared note: stock out at the moving average, serial units
	 * sold, order in progress.
	 *
	 * @throws {DeliveryNoteStateError} The note is not prepared
	 * @throws {InsufficientStockError} Not enough stock in the warehouse (from inventory)
	 * @throws {DeliveryNoteLineError} A serial is no longer in stock there
	 */
	async ship(actor: { userId: string; organizationId: string }, id: string): Promise<TDeliveryNoteDetail> {
		const note = await this.notes.findById(id);
		if (!note) throw new DeliveryNoteNotFoundError();
		if (note.status !== 'prepared') throw new DeliveryNoteStateError('ship');
		const lines = await this.notes.findItems(id);
		const kinds = await Promise.all(
			lines.map(async (line) => (line.itemId ? await this.items.getItem(line.itemId).catch(() => null) : null)),
		);
		const occurredAt = noon(note.deliveryDate);

		await this.transactions.run(async (tx) => {
			const shipped = await this.notes.markShipped(id, actor.userId, tx);
			if (!shipped) throw new DeliveryNoteStateError('ship');
			for (const [index, line] of lines.entries()) {
				const item = kinds[index];
				if (!item) continue;
				let stockMovementId: string | null = null;
				// Stock moves for stock-tracked items; serial units are sold for
				// serialized ones (the two flags are independent in the master).
				if (item.isStockTracked) {
					const posted = await this.stock.postMovement(
						{
							actorOrganizationId: actor.organizationId,
							warehouseId: note.warehouseId,
							binId: note.binId,
							itemId: item.id,
							movementType: 'issue',
							quantity: line.quantity,
							occurredAt,
							referenceType: 'delivery_note',
							referenceId: note.id,
							createdBy: actor.userId,
							notes: `${note.code} · ${note.salesOrderCode}`,
						},
						tx,
					);
					stockMovementId = posted.movement.id;
					await this.notes.setLineIssue(line.id, { stockMovementId, unitCost: posted.movement.unitCost ?? 0 }, tx);
				}
				if (item.isSerialized && line.serialNumbers?.length) {
					const missing = await this.items.sellUnits(
						item.id,
						line.serialNumbers,
						{ warehouseId: note.warehouseId, customerId: note.customerId, stockMovementId },
						tx,
					);
					if (missing.length > 0) throw new DeliveryNoteLineError('notInStock', index + 1);
				}
			}
			await this.orders.markInProgress(note.salesOrderId, actor.userId, `delivery note ${note.code} shipped`, tx);
		});
		return this.get(id);
	}

	/** Records who received a shipped note. */
	async deliver(id: string, body: TDeliverDeliveryNote): Promise<TDeliveryNoteDetail> {
		const note = await this.notes.findById(id);
		if (!note) throw new DeliveryNoteNotFoundError();
		const delivered = await this.notes.markDelivered(id, {
			receiverName: body.receiverName,
			receivedAt: body.receivedAt ?? new Date(),
		});
		if (!delivered) throw new DeliveryNoteStateError('deliver');
		return this.get(id);
	}

	/** Cancels a prepared note and gives its quantities back to the order. */
	async cancel(actorUserId: string, id: string, reason: string): Promise<TDeliveryNoteDetail> {
		const note = await this.notes.findById(id);
		if (!note) throw new DeliveryNoteNotFoundError();
		const lines = await this.notes.findItems(id);
		await this.transactions.run(async (tx) => {
			const cancelled = await this.notes.cancel(id, actorUserId, reason, tx);
			if (!cancelled) throw new DeliveryNoteStateError('cancel');
			await this.orders.allocateDelivery(
				note.salesOrderId,
				lines.map((line) => ({ salesOrderItemId: line.salesOrderItemId, quantity: line.quantity })),
				{ release: true },
				tx,
			);
		});
		return this.get(id);
	}
}
