import { ITEM_SERVICE_TOKEN } from '@app/inventory/constants/di';
import { ItemNotFoundError } from '@app/inventory/errors/item.errors';
import type { ItemService } from '@app/inventory/services/item.service';
import type { TAssetDepreciationSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { DEPRECIATION_REPOSITORY_TOKEN, FINANCE_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { TDepreciationCreateInput } from '../contracts/depreciation.contract';
import type { IDepreciationRepository } from '../contracts/depreciation.repository.interface';
import { DepreciationPeriodTakenError } from '../errors/depreciation.errors';
import type { FinanceNumberingService } from './finance-numbering.service';

/**
 * Depreciation of item units (ADR-0024 Q15): finance owns the entries,
 * inventory owns the valuation.
 *
 * @remarks
 * Idempotent per (item, period). The entry and the item's book value /
 * accumulated depreciation change in one transaction, through
 * `ItemService.applyDepreciation` - the only writer of those two columns after
 * registration. The entry snapshots the opening and closing book value.
 */
@injectable()
export class DepreciationService {
	constructor(
		@inject(DEPRECIATION_REPOSITORY_TOKEN)
		private readonly depreciations: IDepreciationRepository,
		@inject(ITEM_SERVICE_TOKEN)
		private readonly items: Pick<ItemService, 'getItem' | 'applyDepreciation'>,
		@inject(FINANCE_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<FinanceNumberingService, 'next'>,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
	) {}

	/**
	 * Records the depreciation of one item for one month.
	 *
	 * @throws {ItemNotFoundError} When the item is absent or belongs to another organization
	 * @throws {DepreciationPeriodTakenError} When the period already has an entry
	 * @throws {ItemRuleViolationError} When the amount exceeds the book value
	 */
	async record(organizationId: string, input: TDepreciationCreateInput): Promise<TAssetDepreciationSelect> {
		const item = await this.items.getItem(input.itemId);
		if (item.organizationId !== organizationId) throw new ItemNotFoundError();
		if (await this.depreciations.findPeriod(input.itemId, input.periodYear, input.periodMonth)) {
			throw new DepreciationPeriodTakenError();
		}
		return this.transactions.run(async (tx) => {
			// Snapshot the opening value BEFORE the item is written: the entry
			// records what the valuation was when the period started.
			const openingBookValue = item.bookValue;
			const updated = await this.items.applyDepreciation(input.itemId, organizationId, input.depreciationAmount, tx);
			await this.numbering.next('asset_depreciation', { tx });
			return this.depreciations.create(
				{
					organizationId,
					itemId: input.itemId,
					periodYear: input.periodYear,
					periodMonth: input.periodMonth,
					depreciationMethod: item.depreciationMethod ?? 'straight_line',
					depreciationAmount: input.depreciationAmount,
					openingBookValue,
					closingBookValue: updated.bookValue,
					currencyCode: item.currencyCode,
					calculatedAt: new Date(),
				},
				tx,
			);
		});
	}

	list(
		organizationId: string,
		filter: { itemId?: string },
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetDepreciationSelect>> {
		return this.depreciations.list(organizationId, filter, page, limit);
	}
}
