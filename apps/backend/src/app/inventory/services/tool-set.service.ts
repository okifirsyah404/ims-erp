import type {
	TItemSelect,
	TToolSetItemSelect,
	TToolSetSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { SYSTEM_AUDIT_ACTOR, type TInventoryAuditActor } from '../constants/audit-actor';
import {
	INVENTORY_NUMBERING_SERVICE_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	TOOL_SET_ITEM_REPOSITORY_TOKEN,
	TOOL_SET_REPOSITORY_TOKEN,
} from '../constants/di';
import type { TToolSetCreateInput, TToolSetUpdateInput } from '../contracts/item-operations.contract';
import type {
	IToolSetItemRepository,
	IToolSetRepository,
} from '../contracts/item-operations.repository.interface';
import type { IItemRepository } from '../contracts/item.repository.interface';
import { ItemNotFoundError, ItemRuleViolationError } from '../errors/item.errors';
import { InventoryAuditWriter } from './inventory-audit.writer';
import type { InventoryNumberingService } from './inventory-numbering.service';

/**
 * Tool sets: a kit of item units lent to a technician as one unit (Q37).
 *
 * @remarks
 * `lent` / `available` are flipped by `BorrowingService` inside the borrowing
 * transaction; this service owns the kit's master data and membership. A set is
 * archived only when empty. Members must be units of the caller's organization.
 */
@injectable()
export class ToolSetService {
	constructor(
		@inject(TOOL_SET_REPOSITORY_TOKEN)
		private readonly toolSets: IToolSetRepository,
		@inject(TOOL_SET_ITEM_REPOSITORY_TOKEN)
		private readonly toolSetItems: IToolSetItemRepository,
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly itemRepository: Pick<IItemRepository, 'findById'>,
		@inject(INVENTORY_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<InventoryNumberingService, 'next'>,
		private readonly audit: InventoryAuditWriter,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
	) {}

	async create(
		organizationId: string,
		data: TToolSetCreateInput,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TToolSetSelect> {
		const created = await this.transactions.run(async (tx) =>
			this.toolSets.create(
				{
					organizationId,
					code: await this.numbering.next('tool_set', tx),
					name: data.name,
					description: data.description ?? null,
					custodianEmployeeId: data.custodianEmployeeId ?? null,
					status: 'available',
					createdAt: new Date(),
				},
				tx,
			),
		);
		await this.audit.record({
			actor,
			action: 'asset.tool_set_created',
			targetType: 'tool_set',
			targetId: created.id,
			organizationId,
			meta: { code: created.code, name: created.name },
		});
		return created;
	}

	async get(
		id: string,
		organizationId: string,
	): Promise<TToolSetSelect & { items: TToolSetItemSelect[] }> {
		const toolSet = await this.requireToolSet(id, organizationId);
		return { ...toolSet, items: await this.toolSetItems.listByToolSet(id) };
	}

	list(
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TToolSetSelect>> {
		return this.toolSets.list(organizationId, page, limit);
	}

	async update(
		id: string,
		organizationId: string,
		data: TToolSetUpdateInput,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TToolSetSelect> {
		const current = await this.requireToolSet(id, organizationId);
		const updated = await this.toolSets.update(id, data);
		if (!updated) throw new ItemNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset.tool_set_updated',
			targetType: 'tool_set',
			targetId: id,
			organizationId,
			meta: {
				code: current.code,
				...InventoryAuditWriter.snapshot(
					{ name: current.name, status: current.status },
					{ name: updated.name, status: updated.status },
				),
			},
		});
		return updated;
	}

	/** Soft-deletes an empty tool set. */
	async archive(
		id: string,
		organizationId: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<void> {
		const current = await this.requireToolSet(id, organizationId);
		if ((await this.toolSetItems.listByToolSet(id)).length > 0) {
			throw new ItemRuleViolationError(
				'tool_set_not_empty',
				'assets.toolSetNotEmpty',
				'Cannot archive a tool set that still holds items',
			);
		}
		await this.toolSets.archive(id);
		await this.audit.record({
			actor,
			action: 'asset.tool_set_archived',
			targetType: 'tool_set',
			targetId: id,
			organizationId,
			meta: { code: current.code },
		});
	}

	async addItem(
		toolSetId: string,
		organizationId: string,
		data: { itemId: string; quantity: number },
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TToolSetItemSelect> {
		await this.requireToolSet(toolSetId, organizationId);
		await this.requireItemInScope(data.itemId, organizationId);
		const row = await this.toolSetItems.add({
			organizationId,
			toolSetId,
			itemId: data.itemId,
			quantity: String(data.quantity),
			createdAt: new Date(),
		});
		await this.audit.record({
			actor,
			action: 'asset.tool_set_updated',
			targetType: 'tool_set',
			targetId: toolSetId,
			organizationId,
			meta: { itemAdded: data.itemId, quantity: data.quantity },
		});
		return row;
	}

	async removeItem(
		toolSetId: string,
		rowId: string,
		organizationId: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<void> {
		await this.requireToolSet(toolSetId, organizationId);
		if (!(await this.toolSetItems.remove(toolSetId, rowId))) throw new ItemNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset.tool_set_updated',
			targetType: 'tool_set',
			targetId: toolSetId,
			organizationId,
			meta: { itemRemoved: rowId },
		});
	}

	private async requireToolSet(id: string, organizationId: string): Promise<TToolSetSelect> {
		const toolSet = await this.toolSets.findById(id);
		if (!toolSet || toolSet.organizationId !== organizationId) throw new ItemNotFoundError();
		return toolSet;
	}

	private async requireItemInScope(itemId: string, organizationId: string): Promise<TItemSelect> {
		const item = await this.itemRepository.findById(itemId);
		if (!item || item.organizationId !== organizationId) throw new ItemNotFoundError();
		return item;
	}
}
