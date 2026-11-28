import { PRODUCT_SERVICE_TOKEN } from '@app/product/constants/di';
import type { ProductService } from '@app/product/services/product.service';
import { PROCUREMENT_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { ProcurementNumberingService } from './procurement-numbering.service';
import { isUniqueViolation } from '@drizzle/errors';
import type { TPurchaseRequestSelect } from '@drizzle/schemas/procurement.schema';
import { businessDateOf } from '@utils/business-date.util';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { inTransaction, type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { PURCHASE_REQUEST_REPOSITORY_TOKEN } from '../constants/di';
import type {
	IPurchaseRequestRepository,
	TOpenRequestLine,
	TPurchaseRequestHeaderData,
	TPurchaseRequestItemData,
	TPurchaseRequestLineView,
} from '../contracts/procurement.repository.interface';
import type { TOpenLinesQuery, TPurchaseRequestBody, TPurchaseRequestListQuery } from '../contracts/purchase-request.contract';
import {
	PurchaseOrderItemUnavailableError,
	PurchaseRequestCodeTakenError,
	PurchaseRequestNotFoundError,
	PurchaseRequestNotOwnerError,
	PurchaseRequestSelfApprovalError,
	PurchaseRequestStateError,
} from '../errors/procurement.errors';
import { poLineTotal } from '../utils/po-totals';

export type TPurchaseRequestDetail = TPurchaseRequestSelect & { lines: TPurchaseRequestLineView[] };

/** An item a requester may ask for: only what the request form needs. */
export type TRequestableItem = {
	id: string;
	sku: string;
	name: string;
	unitLabel: string;
	specification: string | null;
	purchasePrice: number;
};

/** Who acts, from the session (the name is kept on the request for display). */
export type TRequestActor = { userId: string; name: string | null; organizationId: string | null };

/**
 * Purchase request use cases (M05, owner decisions 2026-11-15).
 *
 * @remarks
 * - Company-wide like purchase orders (ADR-0011); the requester's active
 *   organization is recorded for information only.
 * - Only the requester edits, submits or cancels their own request; approval
 *   is one level (`purchase_request:approve` / `reject`) and never by the
 *   requester. Rejection returns the request to draft with the reason.
 * - The number (`purchase_request`, e.g. `0001/PR/IMS/XI/26`) is allocated on
 *   the first submit and kept when a rejected request is submitted again.
 * - A line is an item of the master (snapshot of name, unit, SKU, price) or
 *   free text; purchasing maps free text to an item on the purchase order.
 * - `approved` ↔ `ordered` is derived on the purchase order side when its
 *   lines claim request lines (`repositories/request-ordering.ts`).
 */
@injectable()
export class PurchaseRequestService {
	constructor(
		@inject(PURCHASE_REQUEST_REPOSITORY_TOKEN)
		private readonly requests: IPurchaseRequestRepository,
		@inject(PRODUCT_SERVICE_TOKEN)
		private readonly items: Pick<ProductService, 'getActiveProducts' | 'paginate'>,
		@inject(PROCUREMENT_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<ProcurementNumberingService, 'next'>,
		/** P7-5: document number + write in one transaction; optional for unit tests built by hand. */
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions?: ITransactionRunner,
	) {}

	private async require(id: string): Promise<TPurchaseRequestSelect> {
		const request = await this.requests.findById(id);
		if (!request) throw new PurchaseRequestNotFoundError();
		return request;
	}

	private async requireOwn(actorUserId: string, id: string): Promise<TPurchaseRequestSelect> {
		const request = await this.require(id);
		if (request.requestedBy !== actorUserId) throw new PurchaseRequestNotOwnerError();
		return request;
	}

	private async build(body: TPurchaseRequestBody): Promise<{ header: TPurchaseRequestHeaderData; items: TPurchaseRequestItemData[] }> {
		const ids = body.lines.flatMap((line) => (line.productId ? [line.productId] : []));
		const found = new Map((ids.length ? await this.items.getActiveProducts(ids) : []).map((item) => [item.id, item]));
		const items: TPurchaseRequestItemData[] = body.lines.map((line, index) => {
			if (line.productId) {
				const item = found.get(line.productId);
				if (!item) throw new PurchaseOrderItemUnavailableError(index + 1);
				const price = line.estimatedUnitPrice ?? item.purchasePrice;
				return {
					productId: item.id,
					sku: item.sku,
					name: item.name,
					specification: line.specification ?? item.specification,
					unit: item.unitLabel,
					quantity: line.quantity,
					estimatedUnitPrice: price,
					estimatedTotal: poLineTotal({ quantity: line.quantity, unitPrice: price }),
					notes: line.notes,
				};
			}
			const price = line.estimatedUnitPrice ?? 0;
			return {
				productId: null,
				sku: null,
				name: line.name!,
				specification: line.specification,
				unit: line.unit!,
				quantity: line.quantity,
				estimatedUnitPrice: price,
				estimatedTotal: poLineTotal({ quantity: line.quantity, unitPrice: price }),
				notes: line.notes,
			};
		});
		return {
			header: {
				subject: body.subject,
				justification: body.justification,
				projectName: body.projectName,
				requestDate: body.requestDate ?? businessDateOf(),
				neededBy: body.neededBy,
				estimatedTotal: items.reduce((sum, item) => sum + (item.estimatedTotal ?? 0), 0),
			},
			items,
		};
	}

	list(query: TPurchaseRequestListQuery, actorUserId: string): Promise<TPaginationResult<TPurchaseRequestSelect>> {
		return this.requests.paginate(query, actorUserId);
	}

	async get(id: string): Promise<TPurchaseRequestDetail> {
		const request = await this.require(id);
		return { ...request, lines: await this.requests.findLines(id) };
	}

	/**
	 * Active items of the master for the request form. Requesters (technicians,
	 * project managers) hold no `product:read`, so the form searches here, through
	 * the Inventory contract, and sees only the fields a request needs.
	 */
	async searchItems(search: string | undefined): Promise<TRequestableItem[]> {
		const page = await this.items.paginate({ page: 1, limit: 20, search, activeOnly: true });
		return page.data.map((item) => ({
			id: item.id,
			sku: item.sku,
			name: item.name,
			unitLabel: item.unitLabel,
			specification: item.specification,
			purchasePrice: item.purchasePrice,
		}));
	}

	/** Approved lines not yet on a live purchase order (the PO form's picker). */
	openLines(query: TOpenLinesQuery): Promise<TOpenRequestLine[]> {
		return this.requests.openLines(query);
	}

	async create(actor: TRequestActor, body: TPurchaseRequestBody): Promise<TPurchaseRequestSelect> {
		const { header, items } = await this.build(body);
		return this.requests.create(
			{
				...header,
				organizationId: actor.organizationId,
				requestedBy: actor.userId,
				requestedByName: actor.name?.slice(0, 120) ?? null,
			},
			items,
		);
	}

	async update(actorUserId: string, id: string, body: TPurchaseRequestBody): Promise<TPurchaseRequestSelect> {
		const request = await this.requireOwn(actorUserId, id);
		if (request.status !== 'draft') throw new PurchaseRequestStateError('notDraft');
		const { header, items } = await this.build(body);
		const updated = await this.requests.replaceDraft(id, header, items);
		if (!updated) throw new PurchaseRequestStateError('notDraft');
		return updated;
	}

	async submit(actorUserId: string, id: string): Promise<TPurchaseRequestSelect> {
		const request = await this.requireOwn(actorUserId, id);
		if (request.status !== 'draft') throw new PurchaseRequestStateError('notDraft');
		// P7-5 (T-1): number and submission commit together; a failed submit
		// rolls the counter back (no gap).
		const allocated: { code: string | null } = { code: request.code };
		try {
			return await inTransaction(this.transactions, async (tx) => {
				const code =
					request.code ??
					(await this.numbering.next('purchase_request', { date: new Date(`${request.requestDate}T12:00:00+07:00`), tx }));
				allocated.code = code;
				const updated = await this.requests.transition(
					id,
					['draft'],
					'submitted',
					{ code, submittedAt: new Date(), rejectionReason: null },
					tx,
				);
				if (!updated) throw new PurchaseRequestStateError('notDraft');
				return updated;
			});
		} catch (error) {
			if (allocated.code && isUniqueViolation(error)) throw new PurchaseRequestCodeTakenError(allocated.code);
			throw error;
		}
	}

	async approve(actorUserId: string, id: string): Promise<TPurchaseRequestSelect> {
		const request = await this.require(id);
		if (request.status !== 'submitted') throw new PurchaseRequestStateError('notSubmitted');
		if (request.requestedBy === actorUserId) throw new PurchaseRequestSelfApprovalError();
		const approved = await this.requests.transition(id, ['submitted'], 'approved', { approvedBy: actorUserId, approvedAt: new Date() });
		if (!approved) throw new PurchaseRequestStateError('notSubmitted');
		return approved;
	}

	/** Back to draft with the reason, for the requester to revise. */
	async reject(actorUserId: string, id: string, reason: string): Promise<TPurchaseRequestSelect> {
		const request = await this.require(id);
		if (request.status !== 'submitted') throw new PurchaseRequestStateError('notSubmitted');
		if (request.requestedBy === actorUserId) throw new PurchaseRequestSelfApprovalError();
		const rejected = await this.requests.transition(id, ['submitted'], 'draft', { rejectionReason: reason });
		if (!rejected) throw new PurchaseRequestStateError('notSubmitted');
		return rejected;
	}

	/** The requester withdraws it while no line is on a purchase order. */
	async cancel(actorUserId: string, id: string, reason: string): Promise<TPurchaseRequestSelect> {
		await this.requireOwn(actorUserId, id);
		const cancelled = await this.requests.cancelUnordered(id, ['draft', 'submitted', 'approved'], {
			cancelledBy: actorUserId,
			cancelledAt: new Date(),
			cancelledReason: reason,
		});
		if (!cancelled || cancelled === 'ordered') throw new PurchaseRequestStateError('notCancellable');
		return cancelled;
	}
}
