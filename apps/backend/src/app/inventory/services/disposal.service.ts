import type { TDisposalSelect, TItemSelect } from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { SYSTEM_AUDIT_ACTOR, type TInventoryAuditActor } from '../constants/audit-actor';
import {
	DISPOSAL_REPOSITORY_TOKEN,
	INVENTORY_NUMBERING_SERVICE_TOKEN,
	ITEM_REPOSITORY_TOKEN,
} from '../constants/di';
import type { TDisposalCreateInput } from '../contracts/item-operations.contract';
import type {
	IDisposalRepository,
	TDisposalPaginationRequest,
} from '../contracts/item-operations.repository.interface';
import type { IItemRepository } from '../contracts/item.repository.interface';
import {
	ItemNotFoundError,
	ItemRuleViolationError,
	ItemTransitionError,
} from '../errors/item.errors';
import { InventoryAuditWriter } from './inventory-audit.writer';
import type { InventoryNumberingService } from './inventory-numbering.service';

/**
 * Disposal workflow of item units: `draft -> approved -> executed`, or cancelled
 * (D21).
 *
 * @remarks
 * Executing is one transaction: the atomic claim (`status = 'approved'` in the
 * `WHERE`), the unit flipping to `disposed` with a zero book value, and its soft
 * delete - the disposal record stays as the financial proof. The book value and
 * gain/loss are snapshotted at execution, not at request, because depreciation
 * may post in between (finance, P5).
 */
@injectable()
export class DisposalService {
	constructor(
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly itemRepository: Pick<IItemRepository, 'findById' | 'update' | 'archive'>,
		@inject(DISPOSAL_REPOSITORY_TOKEN)
		private readonly disposals: IDisposalRepository,
		@inject(INVENTORY_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<InventoryNumberingService, 'next'>,
		private readonly audit: InventoryAuditWriter,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
	) {}

	/** Raises a disposal in `draft`. */
	async requestDisposal(
		itemId: string,
		organizationId: string,
		data: TDisposalCreateInput,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TDisposalSelect> {
		const item = await this.requireItemInScope(itemId, organizationId);
		if (item.status === 'disposed') throw new ItemTransitionError(item.status, 'disposal_requested');

		const disposal = await this.transactions.run(async (tx) =>
			this.disposals.create(
				{
					organizationId,
					code: await this.numbering.next('disposal', tx),
					itemId,
					disposalDate: data.disposalDate ?? null,
					disposalMethod: data.disposalMethod,
					proceedsAmount: data.proceedsAmount,
					currencyCode: data.currencyCode ?? item.currencyCode,
					buyerName: data.buyerName ?? null,
					status: 'draft',
					requestedBy: actor.userId,
					createdAt: new Date(),
				},
				tx,
			),
		);
		await this.audit.record({
			actor,
			action: 'asset.disposal_requested',
			targetType: 'asset_disposal',
			targetId: disposal.id,
			organizationId,
			meta: { itemId, code: disposal.code, method: disposal.disposalMethod },
		});
		return disposal;
	}

	/** `draft | submitted -> approved`. */
	async approveDisposal(
		disposalId: string,
		organizationId: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TDisposalSelect> {
		const disposal = await this.requireDisposal(disposalId, organizationId);
		if (!['draft', 'submitted'].includes(disposal.status)) {
			throw new ItemTransitionError(disposal.status, 'approved');
		}
		const updated = await this.disposals.update(disposalId, {
			status: 'approved',
			approvedBy: actor.userId,
			approvedAt: new Date(),
		});
		if (!updated) throw new ItemNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset.disposal_approved',
			targetType: 'asset_disposal',
			targetId: disposalId,
			organizationId,
			meta: { code: disposal.code, from: disposal.status },
		});
		return updated;
	}

	/** Executes an approved disposal; of two concurrent executions exactly one wins. */
	async executeDisposal(
		disposalId: string,
		organizationId: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TDisposalSelect> {
		const disposal = await this.requireDisposal(disposalId, organizationId);
		if (disposal.status !== 'approved') throw new ItemTransitionError(disposal.status, 'executed');
		const item = await this.itemRepository.findById(disposal.itemId);
		if (!item) throw new ItemNotFoundError();

		const executed = await this.transactions.run(async (tx) => {
			const claimed = await this.disposals.claimForExecution(
				disposalId,
				{
					bookValueAtDisposal: item.bookValue,
					gainLoss: disposal.proceedsAmount - item.bookValue,
				},
				tx,
			);
			if (!claimed) throw new ItemRuleViolationError('disposal_already_executed');
			await this.itemRepository.update(disposal.itemId, { status: 'disposed', bookValue: 0 }, tx);
			// Soft delete the unit; the disposal row is the financial proof.
			await this.itemRepository.archive(disposal.itemId, tx);
			return claimed;
		});
		await this.audit.record({
			actor,
			action: 'asset.disposal_executed',
			targetType: 'asset_disposal',
			targetId: disposalId,
			organizationId,
			meta: {
				itemId: disposal.itemId,
				code: disposal.code,
				proceedsAmount: executed.proceedsAmount,
				bookValueAtDisposal: executed.bookValueAtDisposal,
			},
		});
		return executed;
	}

	/** Any non-executed disposal can be cancelled. */
	async cancelDisposal(
		disposalId: string,
		organizationId: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TDisposalSelect> {
		const disposal = await this.requireDisposal(disposalId, organizationId);
		if (disposal.status === 'executed') throw new ItemTransitionError(disposal.status, 'cancelled');
		const updated = await this.disposals.update(disposalId, { status: 'cancelled' });
		if (!updated) throw new ItemNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset.disposal_cancelled',
			targetType: 'asset_disposal',
			targetId: disposalId,
			organizationId,
			meta: { code: disposal.code, from: disposal.status },
		});
		return updated;
	}

	/** Fetches one page of the tenant's disposal documents. */
	list(
		request: TDisposalPaginationRequest,
	): Promise<TPaginationResult<TDisposalSelect>> {
		return this.disposals.paginate(request);
	}

	getDisposal(id: string, organizationId: string): Promise<TDisposalSelect> {
		return this.requireDisposal(id, organizationId);
	}

	private async requireItemInScope(itemId: string, organizationId: string): Promise<TItemSelect> {
		const item = await this.itemRepository.findById(itemId);
		if (!item || item.organizationId !== organizationId) throw new ItemNotFoundError();
		return item;
	}

	private async requireDisposal(id: string, organizationId: string): Promise<TDisposalSelect> {
		const disposal = await this.disposals.findById(id);
		if (!disposal || disposal.organizationId !== organizationId) throw new ItemNotFoundError();
		return disposal;
	}
}
