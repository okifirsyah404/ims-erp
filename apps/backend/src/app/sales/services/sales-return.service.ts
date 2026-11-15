import { ITEM_SERVICE_TOKEN, STOCK_SERVICE_TOKEN, WAREHOUSE_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { ItemService } from '@app/inventory/services/item.service';
import type { StockService } from '@app/inventory/services/stock.service';
import type { WarehouseService } from '@app/inventory/services/warehouse.service';
import { CODE_NUMBER_SERVICE_TOKEN } from '@app/code-number';
import type { CodeNumberService } from '@app/code-number';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document';
import type { DocumentService } from '@app/document';
import { isUniqueViolation } from '@drizzle/errors';
import type {
	SalesReturnStatus,
	TDeliveryNoteItemSelect,
	TSalesReturnItemSelect,
	TSalesReturnSelect,
} from '@drizzle/schemas/sales.schema';
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
	SalesReturnSelfApprovalError,
	SalesReturnStateError,
} from '../errors/sales-return.errors';

/** Statuses whose lines still hold delivered quantity (not cancelled). */
const LIVE_STATUSES: readonly SalesReturnStatus[] = ['draft', 'submitted', 'approved', 'received'];

export type TSalesReturnDetail = TSalesReturnRow & {
	items: TSalesReturnItemSelect[];
	warehouse: { code: string; name: string; storages: { id: string; code: string; name: string | null }[] } | null;
};

/** A shipped delivery note goods can come back from, with what is left per line. */
export type TReturnableDelivery = Pick<TDeliveryNoteRow, 'id' | 'code' | 'deliveryDate' | 'salesOrderId' | 'salesOrderCode' | 'customerName' | 'warehouseId'> & {
	items: (Pick<TDeliveryNoteItemSelect, 'id' | 'itemId' | 'sku' | 'name' | 'unit' | 'quantity'> & {
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
		private readonly orders: Pick<ISalesOrderRepository, 'allocateDelivery' | 'reopenForReplacement'>,
		@inject(STOCK_SERVICE_TOKEN)
		private readonly stock: Pick<StockService, 'postMovement' | 'resolveScope'>,
		@inject(ITEM_SERVICE_TOKEN)
		private readonly items: Pick<ItemService, 'getItem' | 'receiveCustomerUnits'>,
		@inject(WAREHOUSE_SERVICE_TOKEN)
		private readonly warehouses: Pick<WarehouseService, 'getWarehouse'>,
		@inject(CODE_NUMBER_SERVICE_TOKEN)
		private readonly numbering: Pick<CodeNumberService, 'next'>,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
		/** ERP-0044: approved returns are recorded in the document registry. */
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<DocumentService, 'register' | 'voidBySource'>,
	) {}

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
			this.warehouses.getWarehouse(row.warehouseId).catch(() => null),
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
				const item = line.itemId ? await this.items.getItem(line.itemId).catch(() => null) : null;
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
					itemId: line.itemId,
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
				salesOrderId: note.salesOrderId,
				salesOrderCode: note.salesOrderCode,
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
		await this.stock.resolveScope(warehouseId);
		const returnable = new Map((await this.returnableLines(note.id, excludeReturnId)).map((entry) => [entry.line.id, entry]));
		const seen = new Set<string>();
		const items: TSalesReturnItemData[] = body.lines.map((line, index) => {
			const entry = returnable.get(line.deliveryNoteItemId);
			if (!entry) throw new SalesReturnLineError('unknown', index + 1);
			if (!entry.stockTracked || !entry.line.itemId) throw new SalesReturnLineError('notStock', index + 1);
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
				salesOrderItemId: noteLine.salesOrderItemId,
				itemId: noteLine.itemId!,
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
				salesOrderId: note.salesOrderId,
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

	async create(actorUserId: string, body: TSalesReturnBody): Promise<TSalesReturnSelect> {
		const { header, items } = await this.build(body);
		return this.returns.create({ ...header, createdBy: actorUserId }, items);
	}

	async update(id: string, body: TSalesReturnBody): Promise<TSalesReturnSelect> {
		const row = await this.require(id);
		if (row.status !== 'draft') throw new SalesReturnStateError('notDraft');
		const { header, items } = await this.build(body, id);
		const updated = await this.returns.replaceDraft(id, header, items);
		if (!updated) throw new SalesReturnStateError('notDraft');
		return updated;
	}

	async submit(actorUserId: string, id: string): Promise<TSalesReturnSelect> {
		await this.require(id);
		const updated = await this.returns.transition(id, ['draft'], 'submitted', {
			submittedBy: actorUserId,
			submittedAt: new Date(),
			rejectionReason: null,
		});
		if (!updated) throw new SalesReturnStateError('notDraft');
		return updated;
	}

	/** Approves (numbering it) or rejects back to draft — never one's own return. */
	async decide(actorUserId: string, id: string, input: TSalesReturnDecision): Promise<TSalesReturnSelect> {
		const row = await this.require(id);
		if (row.status !== 'submitted') throw new SalesReturnStateError('notSubmitted');
		if (row.createdBy === actorUserId) throw new SalesReturnSelfApprovalError();
		if (input.decision === 'reject') {
			const rejected = await this.returns.transition(id, ['submitted'], 'draft', { rejectionReason: input.reason ?? null });
			if (!rejected) throw new SalesReturnStateError('notSubmitted');
			return rejected;
		}
		const code = await this.numbering.next('sales_return', { date: noon(row.returnDate) });
		try {
			const approved = await this.returns.transition(id, ['submitted'], 'approved', {
				code,
				approvedBy: actorUserId,
				approvedAt: new Date(),
				rejectionReason: null,
			});
			if (!approved) throw new SalesReturnStateError('notSubmitted');
			// ERP-0044: the approved return is the document the customer signs.
			await this.documents.register({
				code: approved.code ?? code,
				documentType: 'sales_return',
				module: 'sales',
				sourceType: 'sales_return',
				sourceId: approved.id,
				organizationId: null,
				issuedOn: approved.returnDate,
				issuedByUserId: actorUserId,
			});
			return approved;
		} catch (error) {
			if (isUniqueViolation(error)) throw new SalesReturnCodeTakenError(code);
			throw error;
		}
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
	): Promise<TSalesReturnSelect> {
		const head = await this.require(id);
		const lines = await this.returns.findItems(id);
		const byLine = new Map(body.lines.map((line) => [line.salesReturnItemId, line]));
		if (byLine.size !== body.lines.length || lines.length !== byLine.size || lines.some((line) => !byLine.has(line.id))) {
			throw new SalesReturnReceiveError('lines');
		}
		const warehouse = await this.warehouses.getWarehouse(head.warehouseId);
		const storages = new Set(warehouse.storages.filter((storage) => storage.isActive).map((storage) => storage.id));
		if (body.lines.some((line) => line.binId && !storages.has(line.binId))) throw new SalesReturnReceiveError('bin');
		const occurredAt = noon(body.receivedDate ?? businessDateOf());

		return this.transactions.run(async (tx) => {
			const row = await this.returns.claimForReceive(id, tx);
			if (!row) throw new SalesReturnStateError('notApproved');
			const noteLines = new Map((await this.notes.findItems(row.deliveryNoteId)).map((line) => [line.id, line]));
			const received = await this.returns.returnedOnLines(
				lines.map((line) => line.deliveryNoteItemId),
				['received'],
				id,
				tx,
			);
			for (const [index, line] of lines.entries()) {
				const noteLine = noteLines.get(line.deliveryNoteItemId);
				const already = received.get(line.deliveryNoteItemId)?.quantityMilli ?? 0n;
				if (!noteLine || already + quantityToMilli(line.quantity) > quantityToMilli(noteLine.quantity)) {
					throw new SalesReturnLineError('over', index + 1);
				}
			}
			const released = await this.orders.allocateDelivery(
				row.salesOrderId,
				lines.map((line) => ({ salesOrderItemId: line.salesOrderItemId, quantity: line.quantity })),
				{ release: true },
				tx,
			);
			if (!released.ok) throw new SalesReturnDeliveryError();
			for (const [index, line] of lines.entries()) {
				const choice = byLine.get(line.id)!;
				const binId = choice.binId ?? null;
				const posted = await this.stock.postMovement(
					{
						actorOrganizationId: actor.organizationId,
						warehouseId: row.warehouseId,
						binId,
						itemId: line.itemId,
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
					const missing = await this.items.receiveCustomerUnits(
						line.itemId,
						serials,
						{
							warehouseId: row.warehouseId,
							binId,
							status: choice.condition === 'good' ? 'in_stock' : 'damaged',
							stockMovementId: posted.movement.id,
						},
						tx,
					);
					if (missing.length) throw new SalesReturnLineError('notSold', index + 1);
				}
				await this.returns.setReceived(line.id, { condition: choice.condition, binId, stockMovementId: posted.movement.id }, tx);
			}
			await this.orders.reopenForReplacement(row.salesOrderId, actor.userId, `sales return ${row.code ?? ''} received`, tx);
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
	}

	async cancel(actorUserId: string, id: string, reason: string): Promise<TSalesReturnSelect> {
		const row = await this.require(id);
		const updated = await this.returns.transition(id, ['draft', 'submitted', 'approved'], 'cancelled', {
			cancelledBy: actorUserId,
			cancelledAt: new Date(),
			cancelledReason: reason,
		});
		if (!updated) throw new SalesReturnStateError('notCancellable');
		// ERP-0044: an approved return that is cancelled is a dead document.
		if (row.code) await this.documents.voidBySource('sales', 'sales_return', id);
		return updated;
	}
}
