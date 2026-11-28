import { STOCK_SERVICE_TOKEN } from '@app/inventory/constants/di';
import { PRODUCT_SERVICE_TOKEN } from '@app/product/constants/di';
import { WAREHOUSE_SERVICE_TOKEN } from '@app/warehouse/constants/di';
import type { ProductService } from '@app/product/services/product.service';
import { SERIAL_UNIT_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { SerialUnitService } from '@app/inventory/services/serial-unit.service';
import type { StockService } from '@app/inventory/services/stock.service';
import type { WarehouseService } from '@app/warehouse/services/warehouse.service';
import { SALE_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { SaleNumberingService } from './sale-numbering.service';
import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document/constants/di';
import { POSTING_SERVICE_TOKEN } from '@app/finance/constants/di';
import type { PostingService } from '@app/finance/services/posting.service';
import { inventoryValue } from '@app/finance/utils/inventory-value';
import { PROJECT_LOOKUP_SERVICE_TOKEN } from '@app/project/constants/di';
import type { ProjectLookupService } from '@app/project/services/project-lookup.service';
import type { DocumentService } from '@app/document';
import { isUniqueViolation } from '@drizzle/errors';
import type {
	ReturnStatus,
	TDeliveryNoteItemSelect,
	TReturnItemSelect,
	TReturnSelect,
} from '@drizzle/schemas/sale.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { businessDateOf } from '@utils/business-date.util';
import { quantityToMilli } from '@utils/money.util';
import { inject, injectable } from 'tsyringe';
import {
	DELIVERY_NOTE_REPOSITORY_TOKEN,
	SALES_ORDER_REPOSITORY_TOKEN,
	SALES_RETURN_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IDeliveryNoteRepository, TDeliveryNoteRow } from '../contracts/delivery-note.repository.interface';
import type { ISalesOrderRepository } from '../contracts/sales-order.repository.interface';
import type {
	TSalesReturnBody,
	TSalesReturnDecision,
	TSalesReturnListQuery,
	TSalesReturnReceive,
} from '../contracts/sales-return.contract';
import type {
	ISalesReturnRepository,
	TReturnedOnDeliveryLine,
	TSalesReturnHeaderData,
	TSalesReturnItemData,
	TSalesReturnRow,
} from '../contracts/sales-return.repository.interface';
import {
	SalesReturnCodeTakenError,
	SalesReturnDeliveryError,
	SalesReturnLineError,
	SalesReturnNotFoundError,
	SalesReturnReceiveError,
	SalesReturnWarehouseRequiredError,
	SalesReturnSelfApprovalError,
	SalesReturnStateError,
} from '../errors/sales-return.errors';
import { type SalesReturnChange, salesReturnUpdatedEvent } from '../utils/sales-return-event';

/** Statuses whose lines still hold delivered quantity (not cancelled). */
const LIVE_STATUSES: readonly ReturnStatus[] = ['draft', 'submitted', 'approved', 'received'];

export type TSalesReturnDetail = TSalesReturnRow & {
	items: TReturnItemSelect[];
	warehouse: { code: string; name: string; storages: { id: string; code: string; name: string | null }[] } | null;
};

/** A shipped delivery note goods can come back from, with what is left per line. */
export type TReturnableDelivery = Pick<TDeliveryNoteRow, 'id' | 'code' | 'deliveryDate' | 'orderId' | 'orderCode' | 'customerName' | 'warehouseId'> & {
	items: (Pick<TDeliveryNoteItemSelect, 'id' | 'productId' | 'sku' | 'name' | 'unit' | 'quantity'> & {
		returnableQuantity: string;
		/** Serials of this line that are still with the customer and not on another return. */
		serialNumbers: string[];
		isSerialized: boolean;
	})[];
};

const toQuantity = (milli: bigint) => (Number(milli) / 1000).toFixed(3);
const lineTotal = (quantity: string, unitPrice: number) => Math.round(Number(quantity) * unitPrice);
const noon = (date: string) => new Date(`${date}T12:00:00+07:00`);

/**
 * Sales returns (ERP-0065): goods a customer sends back from a shipped
 * delivery note, for replacement.
 *
 * @remarks
 * - Created from one shipped (or delivered) note; only stock-tracked lines.
 *   A line never takes more than the delivery line minus what live returns
 *   take, and a serialized line names that line's serials.
 * - One-level approval with `sales_return:approve`, never by the creator;
 *   rejection returns to draft. Numbered `RTJ` on approval.
 * - Receiving is one unit of work: per line a condition (`good` /
 *   `damaged`) and an optional storage, a `return_in` movement at the
 *   delivery cost, serial units back `in_stock` or `damaged`, and the
 *   quantity released on the order lines (the order re-opens), so the
 *   replacement leaves on a normal delivery note. No credit memo.
 * - Cancelling is allowed until received.
 */
@injectable()
export class SalesReturnService {
	constructor(
		@inject(SALES_RETURN_REPOSITORY_TOKEN)
		private readonly returns: ISalesReturnRepository,
		@inject(DELIVERY_NOTE_REPOSITORY_TOKEN)
		private readonly notes: Pick<IDeliveryNoteRepository, 'findById' | 'findItems' | 'paginate'>,
		@inject(SALES_ORDER_REPOSITORY_TOKEN)
		private readonly orders: Pick<ISalesOrderRepository, 'allocateDelivery' | 'reopenForReplacement' | 'findById'>,
		@inject(STOCK_SERVICE_TOKEN)
		private readonly stock: Pick<StockService, 'postMovement' | 'resolveScope'>,
		@inject(PRODUCT_SERVICE_TOKEN)
		private readonly items: Pick<ProductService, 'getProduct'>,
		/** Unit custody stayed in inventory when the product master moved (ADR-0026). */
		@inject(SERIAL_UNIT_SERVICE_TOKEN)
		private readonly units: Pick<SerialUnitService, 'receiveCustomerUnits'>,
		@inject(WAREHOUSE_SERVICE_TOKEN)
		private readonly warehouses: Pick<WarehouseService, 'getWarehouse'>,
		@inject(SALE_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<SaleNumberingService, 'next'>,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
		/** ERP-0044: approved returns are recorded in the document registry. */
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<DocumentService, 'register' | 'voidBySource'>,
		/** M04: every state change goes to n8n as `sales_return.updated`. */
		@inject(OUTBOX_SERVICE_TOKEN)
		private readonly outbox: Pick<OutboxService, 'publish'>,
		/** ERP-0137: received returns post Dr inventory / Cr COGS. */
		@inject(POSTING_SERVICE_TOKEN)
		private readonly posting?: Pick<PostingService, 'postBusinessEvent'>,
		@inject(PROJECT_LOOKUP_SERVICE_TOKEN)
		private readonly projects?: Pick<ProjectLookupService, 'liveProjectOfOrder'>,
	) {}

	/** Publishes `sales_return.updated` after a committed change; never throws. */
	private async changed(id: string, change: SalesReturnChange, actorUserId: string): Promise<void> {
		try {
			const row = await this.returns.findById(id);
			if (!row) return;
			const [items, order] = await Promise.all([this.returns.findItems(id), this.orders.findById(row.orderId)]);
			await this.outbox.publish(
				'sales_return.updated',
				{ type: 'sales_return', id },
				salesReturnUpdatedEvent(row, items, change, order?.customerSnapshot ?? null, actorUserId),
			);
		} catch {
			// The outbox logs its own failures; a notification never undoes a return.
		}
	}

	private async require(id: string): Promise<TSalesReturnRow> {
		const row = await this.returns.findById(id);
		if (!row) throw new SalesReturnNotFoundError();
		return row;
	}

	list(query: TSalesReturnListQuery): Promise<TPaginationResult<TSalesReturnRow>> {
		return this.returns.paginate(query);
	}

	async get(id: string): Promise<TSalesReturnDetail> {
		const row = await this.require(id);
		const [items, warehouse] = await Promise.all([
			this.returns.findItems(id),
			row.warehouseId ? this.warehouses.getWarehouse(row.warehouseId).catch(() => null) : Promise.resolve(null),
		]);
		return {
			...row,
			items,
			warehouse: warehouse
				? {
						code: warehouse.code,
						name: warehouse.name,
						storages: warehouse.storages
							.filter((storage) => storage.isActive && !storage.deletedAt)
							.map((storage) => ({ id: storage.id, code: storage.code, name: storage.name })),
					}
				: null,
		};
	}

	/** Lines of a note with what is still returnable (live returns excluded). */
	private async returnableLines(noteId: string, excludeReturnId?: string) {
		const lines = await this.notes.findItems(noteId);
		const taken = await this.returns.returnedOnLines(
			lines.map((line) => line.id),
			LIVE_STATUSES,
			excludeReturnId,
		);
		const result = await Promise.all(
			lines.map(async (line) => {
				const item = line.productId ? await this.items.getProduct(line.productId).catch(() => null) : null;
				const used: TReturnedOnDeliveryLine = taken.get(line.id) ?? { quantityMilli: 0n, serialNumbers: [] };
				const onReturns = new Set(used.serialNumbers);
				const leftMilli = quantityToMilli(line.quantity) - used.quantityMilli;
				return {
					line,
					stockTracked: !!item?.isStockTracked,
					isSerialized: !!item?.isSerialized,
					serialNumbers: (line.serialNumbers ?? []).filter((serial) => !onReturns.has(serial)),
					returnableMilli: leftMilli > 0n ? leftMilli : 0n,
				};
			}),
		);
		return result;
	}

	private async requireShipped(id: string): Promise<TDeliveryNoteRow> {
		const note = await this.notes.findById(id);
		if (!note || (note.status !== 'shipped' && note.status !== 'delivered')) throw new SalesReturnDeliveryError();
		return note;
	}

	/** Recent shipped delivery notes with goods that can still come back. */
	async returnableDeliveries(search?: string): Promise<TReturnableDelivery[]> {
		const pages = await Promise.all(
			(['shipped', 'delivered'] as const).map((status) => this.notes.paginate({ page: 1, limit: 30, status, search })),
		);
		const result: TReturnableDelivery[] = [];
		for (const note of pages.flatMap((page) => page.data)) {
			const lines = await this.returnableLines(note.id);
			const items = lines
				.filter(({ stockTracked, returnableMilli }) => stockTracked && returnableMilli > 0n)
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
				id: note.id,
				code: note.code,
				deliveryDate: note.deliveryDate,
				orderId: note.orderId,
				orderCode: note.orderCode,
				customerName: note.customerName,
				warehouseId: note.warehouseId,
				items,
			});
		}
		return result.sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));
	}

	/**
	 * Builds a return from its delivery note.
	 *
	 * @throws {SalesReturnDeliveryError} Unknown or unshipped note
	 * @throws {SalesReturnLineError} A line is unknown, not stock, repeated, over
	 * what is returnable, or names wrong serials
	 */
	private async build(
		body: TSalesReturnBody,
		excludeReturnId?: string,
	): Promise<{ header: TSalesReturnHeaderData; items: TSalesReturnItemData[] }> {
		const note = await this.requireShipped(body.deliveryNoteId);
		const warehouseId = body.warehouseId ?? note.warehouseId;
		if (!warehouseId) throw new SalesReturnWarehouseRequiredError();
		await this.stock.resolveScope(warehouseId);
		const returnable = new Map((await this.returnableLines(note.id, excludeReturnId)).map((entry) => [entry.line.id, entry]));
		const seen = new Set<string>();
		const items: TSalesReturnItemData[] = body.lines.map((line, index) => {
			const entry = returnable.get(line.deliveryNoteItemId);
			if (!entry) throw new SalesReturnLineError('unknown', index + 1);
			if (!entry.stockTracked || !entry.line.productId) throw new SalesReturnLineError('notStock', index + 1);
			if (seen.has(line.deliveryNoteItemId)) throw new SalesReturnLineError('duplicate', index + 1);
			seen.add(line.deliveryNoteItemId);
			if (quantityToMilli(line.quantity) > entry.returnableMilli) throw new SalesReturnLineError('over', index + 1);
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
					throw new SalesReturnLineError('serials', index + 1);
				}
			}
			const { line: noteLine } = entry;
			return {
				deliveryNoteItemId: noteLine.id,
				orderItemId: noteLine.orderItemId,
				productId: noteLine.productId!,
				sku: noteLine.sku,
				name: noteLine.name,
				unit: noteLine.unit,
				quantity: line.quantity,
				unitPrice: noteLine.unitPrice,
				unitCost: noteLine.unitCost ?? 0,
				lineTotal: lineTotal(line.quantity, noteLine.unitPrice),
				serialNumbers: entry.isSerialized ? serials : null,
			};
		});
		return {
			header: {
				deliveryNoteId: note.id,
				orderId: note.orderId,
				customerId: note.customerId,
				warehouseId,
				returnDate: body.returnDate ?? businessDateOf(),
				reason: body.reason,
				notes: body.notes,
				totalAmount: items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0),
			},
			items,
		};
	}

	async create(actorUserId: string, body: TSalesReturnBody): Promise<TReturnSelect> {
		const { header, items } = await this.build(body);
		return this.returns.create({ ...header, createdBy: actorUserId }, items);
	}

	async update(id: string, body: TSalesReturnBody): Promise<TReturnSelect> {
		const row = await this.require(id);
		if (row.status !== 'draft') throw new SalesReturnStateError('notDraft');
		const { header, items } = await this.build(body, id);
		const updated = await this.returns.replaceDraft(id, header, items);
		if (!updated) throw new SalesReturnStateError('notDraft');
		return updated;
	}

	async submit(actorUserId: string, id: string): Promise<TReturnSelect> {
		await this.require(id);
		const updated = await this.returns.transition(id, ['draft'], 'submitted', {
			submittedBy: actorUserId,
			submittedAt: new Date(),
			rejectionReason: null,
		});
		if (!updated) throw new SalesReturnStateError('notDraft');
		await this.changed(id, 'submitted', actorUserId);
		return updated;
	}

	/** Approves (numbering it) or rejects back to draft — never one's own return. */
	async decide(actorUserId: string, id: string, input: TSalesReturnDecision): Promise<TReturnSelect> {
		const row = await this.require(id);
		if (row.status !== 'submitted') throw new SalesReturnStateError('notSubmitted');
		if (row.createdBy === actorUserId) throw new SalesReturnSelfApprovalError();
		if (input.decision === 'reject') {
			const rejected = await this.returns.transition(id, ['submitted'], 'draft', { rejectionReason: input.reason ?? null });
			if (!rejected) throw new SalesReturnStateError('notSubmitted');
			await this.changed(id, 'rejected', actorUserId);
			return rejected;
		}
		// P7-5 (T-1): number, approval and registry entry commit together; the
		// outbox event is published only after the commit.
		const allocated: { code: string | null } = { code: null };
		let approved: TReturnSelect;
		try {
			approved = await this.transactions.run(async (tx) => {
				const code = await this.numbering.next('return', { date: noon(row.returnDate), tx });
				allocated.code = code;
				const done = await this.returns.transition(
					id,
					['submitted'],
					'approved',
					{ code, approvedBy: actorUserId, approvedAt: new Date(), rejectionReason: null },
					tx,
				);
				if (!done) throw new SalesReturnStateError('notSubmitted');
				// ERP-0044: the approved return is the document the customer signs.
				await this.documents.register(
					{
						code: done.code ?? code,
						title: `Retur Penjualan - ${row.customerName}`,
						documentType: 'return',
						module: 'sale',
						sourceType: 'sales_return',
						sourceId: done.id,
						organizationId: null,
						issuedOn: done.returnDate,
						issuedByUserId: actorUserId,
					},
					tx,
				);
				return done;
			});
		} catch (error) {
			if (allocated.code && isUniqueViolation(error)) throw new SalesReturnCodeTakenError(allocated.code);
			throw error;
		}
		await this.changed(id, 'approved', actorUserId);
		return approved;
	}

	/**
	 * Approved → received: the goods are back in the warehouse.
	 *
	 * @throws {SalesReturnStateError} Not approved (also a concurrent receive)
	 * @throws {SalesReturnReceiveError} A line without a condition, or a foreign storage
	 * @throws {SalesReturnLineError} Over the delivery line, or a serial is no longer sold
	 */
	async receive(
		actor: { userId: string; organizationId: string },
		id: string,
		body: TSalesReturnReceive,
	): Promise<TReturnSelect> {
		const head = await this.require(id);
		const lines = await this.returns.findItems(id);
		const byLine = new Map(body.lines.map((line) => [line.salesReturnItemId, line]));
		if (byLine.size !== body.lines.length || lines.length !== byLine.size || lines.some((line) => !byLine.has(line.id))) {
			throw new SalesReturnReceiveError('lines');
		}
		const warehouseId = head.warehouseId;
		if (!warehouseId) throw new SalesReturnWarehouseRequiredError();
		const warehouse = await this.warehouses.getWarehouse(warehouseId);
		const storages = new Set(warehouse.storages.filter((storage) => storage.isActive).map((storage) => storage.id));
		if (body.lines.some((line) => line.binId && !storages.has(line.binId))) throw new SalesReturnReceiveError('bin');
		const occurredAt = noon(body.receivedDate ?? businessDateOf());
		const project = this.projects ? await this.projects.liveProjectOfOrder(head.orderId) : null;

		const received = await this.transactions.run(async (tx) => {
			const row = await this.returns.claimForReceive(id, tx);
			if (!row) throw new SalesReturnStateError('notApproved');
			const noteLines = new Map((await this.notes.findItems(row.deliveryNoteId)).map((line) => [line.id, line]));
			const alreadyReceived = await this.returns.returnedOnLines(
				lines.map((line) => line.deliveryNoteItemId),
				['received'],
				id,
				tx,
			);
			for (const [index, line] of lines.entries()) {
				const noteLine = noteLines.get(line.deliveryNoteItemId);
				const already = alreadyReceived.get(line.deliveryNoteItemId)?.quantityMilli ?? 0n;
				if (!noteLine || already + quantityToMilli(line.quantity) > quantityToMilli(noteLine.quantity)) {
					throw new SalesReturnLineError('over', index + 1);
				}
			}
			const released = await this.orders.allocateDelivery(
				row.orderId,
				lines.map((line) => ({ orderItemId: line.orderItemId, quantity: line.quantity })),
				{ release: true },
				tx,
			);
			if (!released.ok) throw new SalesReturnDeliveryError();
			for (const [index, line] of lines.entries()) {
				const choice = byLine.get(line.id)!;
				const binId = choice.binId ?? null;
				// ADR-0014: the product link is nullable; a line without a product
				// is not a stock item and cannot be put back into stock.
				const productId = line.productId;
				if (!productId) throw new SalesReturnLineError('notStock', index + 1);
				const posted = await this.stock.postMovement(
					{
						actorOrganizationId: actor.organizationId,
						warehouseId,
						binId,
						productId,
						movementType: 'return_in',
						quantity: line.quantity,
						unitCost: line.unitCost,
						occurredAt,
						referenceType: 'sales_return',
						referenceId: row.id,
						createdBy: actor.userId,
						notes: `${row.code ?? ''} · ${head.deliveryNoteCode}${choice.condition === 'damaged' ? ' · damaged' : ''}`,
					},
					tx,
				);
				const serials = line.serialNumbers ?? [];
				if (serials.length) {
					const missing = await this.units.receiveCustomerUnits(
						productId,
						serials,
						{
							warehouseId,
							binId,
							status: choice.condition === 'good' ? 'in_stock' : 'damaged',
							movementId: posted.movement.id,
						},
						tx,
					);
					if (missing.length) throw new SalesReturnLineError('notSold', index + 1);
				}
				await this.returns.setReceived(line.id, { condition: choice.condition, binId, movementId: posted.movement.id }, tx);
			}
			// ERP-0137: the goods come back at their delivery cost; COGS is
			// credited (project COGS for a project order). Replacements ship on
			// a new delivery note, which books COGS again.
			const back = lines
				.filter((line) => line.productId)
				.map((line) => ({ productId: line.productId as string, value: inventoryValue(line.quantity, line.unitCost) }))
				.filter((line) => line.value > 0);
			const backTotal = back.reduce((sum, line) => sum + line.value, 0);
			if (this.posting && backTotal > 0) {
				const role = project ? 'project_cogs' : 'cogs';
				await this.posting.postBusinessEvent(tx, {
					organizationId: actor.organizationId,
					entryDate: occurredAt.toISOString().slice(0, 10),
					sourceModule: 'sale',
					sourceType: 'sales_return',
					sourceId: row.id,
					idempotencyKey: `sales_return:${row.id}`,
					eventType: 'sale.return_received',
					description: `Sales return ${row.code ?? ''}`.trim(),
					lines: [
						...back.map((line) => ({ role: 'inventory', debit: line.value, credit: 0, productId: line.productId })),
						...back.map((line) => ({ role, debit: 0, credit: line.value, productId: line.productId, projectId: project?.id ?? null })),
					],
				});
			}
			await this.orders.reopenForReplacement(row.orderId, actor.userId, `sales return ${row.code ?? ''} received`, tx);
			const updated = await this.returns.transition(
				id,
				['approved'],
				'received',
				{ receivedBy: actor.userId, receivedAt: new Date() },
				tx,
			);
			if (!updated) throw new SalesReturnStateError('notApproved');
			return updated;
		});
		await this.changed(id, 'received', actor.userId);
		return received;
	}

	async cancel(actorUserId: string, id: string, reason: string): Promise<TReturnSelect> {
		const row = await this.require(id);
		const updated = await this.returns.transition(id, ['draft', 'submitted', 'approved'], 'cancelled', {
			cancelledBy: actorUserId,
			cancelledAt: new Date(),
			cancelledReason: reason,
		});
		if (!updated) throw new SalesReturnStateError('notCancellable');
		// ERP-0044: an approved return that is cancelled is a dead document.
		if (row.code) await this.documents.voidBySource('sale', 'return', id);
		await this.changed(id, 'cancelled', actorUserId);
		return updated;
	}
}
