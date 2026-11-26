import { ITEM_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { ItemService } from '@app/inventory/services/item.service';
import type { TFiscalGroup, TFixedAssetBookSelect } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import {
	CHART_OF_ACCOUNT_REPOSITORY_TOKEN,
	DEPRECIATION_REPOSITORY_TOKEN,
	FIXED_ASSET_BOOK_REPOSITORY_TOKEN,
	POSTING_RULE_SERVICE_TOKEN,
	POSTING_SERVICE_TOKEN,
} from '../constants/di';
import type { IChartOfAccountRepository } from '../contracts/chart-of-account.repository.interface';
import type { IDepreciationRepository } from '../contracts/depreciation.repository.interface';
import type { IFixedAssetBookRepository } from '../contracts/fixed-asset.contract';
import { AccountNotFoundError } from '../errors/ledger.errors';
import { FixedAssetBookExistsError, FixedAssetItemError, FixedAssetNotFoundError } from '../errors/fixed-asset.errors';
import { fiscalDepreciation, monthlyDepreciation } from '../utils/depreciation';
import type { PostingRuleService } from './posting-rule.service';
import type { PostingService } from './posting.service';

export type TFixedAssetContext = { organizationId: string; actorUserId: string };

/** One capitalized asset as finance shows it: the book plus the item's valuation. */
export type TFixedAssetView = TFixedAssetBookSelect & {
	itemCode: string;
	itemName: string;
	itemKind: string;
	acquisitionCost: number;
	accumulatedDepreciation: number;
	bookValue: number;
	usefulLifeMonths: number | null;
	depreciationMethod: string;
};

const periodEnd = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

/**
 * Fixed assets in the general ledger (ERP-0145, grill decision on fixed
 * assets, adapted).
 *
 * @remarks
 * The physical unit stays `inventory.items` (ADR-0024 Q15) - no second asset
 * master. Finance keeps a book per capitalized item: capitalization posts Dr
 * fixed asset (posting-rule discriminator `item_kind`) / Cr the chosen
 * counterpart; the monthly run depreciates every active book (straight line or
 * double declining, never below salvage) through `ItemService.applyDepreciation`
 * and posts one journal per run, Dr Beban Penyusutan / Cr Akumulasi
 * Penyusutan by item kind; inventory's disposal execution posts the disposal
 * journal here. The fiscal report applies the UU PPh Pasal 11 groups to the
 * same assets and shows the difference to the commercial book.
 */
@injectable()
export class FixedAssetService {
	constructor(
		@inject(FIXED_ASSET_BOOK_REPOSITORY_TOKEN) private readonly books: IFixedAssetBookRepository,
		@inject(DEPRECIATION_REPOSITORY_TOKEN)
		private readonly depreciations: Pick<IDepreciationRepository, 'findPeriod' | 'create' | 'listForItem'>,
		@inject(ITEM_SERVICE_TOKEN) private readonly items: Pick<ItemService, 'getItem' | 'applyDepreciation'>,
		@inject(CHART_OF_ACCOUNT_REPOSITORY_TOKEN) private readonly accounts: Pick<IChartOfAccountRepository, 'findAccountById'>,
		@inject(POSTING_RULE_SERVICE_TOKEN) private readonly rules: Pick<PostingRuleService, 'resolveAccountId'>,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: Pick<PostingService, 'post'>,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
	) {}

	private role(organizationId: string, eventType: string, role: string, itemKind: string | null, tx?: TTx) {
		return this.rules.resolveAccountId(
			organizationId,
			{ eventType, role, discriminatorType: itemKind ? 'item_kind' : null, discriminatorValue: itemKind },
			tx,
		);
	}

	private async view(book: TFixedAssetBookSelect): Promise<TFixedAssetView> {
		const item = await this.items.getItem(book.itemId as string);
		return {
			...book,
			itemCode: item.code,
			itemName: item.name,
			itemKind: item.itemKind,
			acquisitionCost: item.acquisitionCost,
			accumulatedDepreciation: item.accumulatedDepreciation,
			bookValue: item.bookValue,
			usefulLifeMonths: item.usefulLifeMonths,
			depreciationMethod: item.depreciationMethod,
		};
	}

	async list(organizationId: string): Promise<TFixedAssetView[]> {
		return Promise.all((await this.books.list(organizationId)).map((book) => this.view(book)));
	}

	/** Capitalizes an inventory item: the book plus Dr fixed asset / Cr counterpart. */
	async capitalize(
		ctx: TFixedAssetContext,
		itemId: string,
		input: { capitalizedOn: string; counterpartAccountId: string; fiscalGroup: TFiscalGroup | null },
	): Promise<TFixedAssetView> {
		const item = await this.items.getItem(itemId);
		if (item.organizationId !== ctx.organizationId || item.acquisitionCost <= 0 || item.status === 'disposed') throw new FixedAssetItemError();
		const counterpart = await this.accounts.findAccountById(ctx.organizationId, input.counterpartAccountId);
		if (!counterpart || !counterpart.isPostable || !counterpart.isActive) throw new AccountNotFoundError();
		const book = await this.transactions.run(async (tx) => {
			if (await this.books.findByItem(ctx.organizationId, itemId, tx)) throw new FixedAssetBookExistsError();
			const { entry } = await this.posting.post(tx, {
				organizationId: ctx.organizationId,
				entryDate: input.capitalizedOn,
				sourceModule: 'finance',
				sourceType: 'fixed_asset_capitalization',
				sourceId: itemId,
				idempotencyKey: `fixed_asset_capitalization:${itemId}`,
				eventType: 'finance.asset_capitalized',
				description: `Capitalization ${item.code}`,
				actorUserId: ctx.actorUserId,
				lines: [
					{
						accountId: await this.role(ctx.organizationId, 'finance.asset_capitalized', 'fixed_asset', item.itemKind, tx),
						debit: item.acquisitionCost,
						credit: 0,
					},
					{ accountId: counterpart.id, debit: 0, credit: item.acquisitionCost },
				],
			});
			return this.books.insert(
				{
					organizationId: ctx.organizationId,
					itemId,
					fiscalGroup: input.fiscalGroup,
					capitalizedOn: input.capitalizedOn,
					capitalizedAmount: item.acquisitionCost,
					counterpartAccountId: counterpart.id,
					capitalizationEntryId: entry.id,
					status: 'active',
					createdBy: ctx.actorUserId,
				},
				tx,
			);
		});
		return this.view(book);
	}

	async setFiscalGroup(ctx: TFixedAssetContext, itemId: string, fiscalGroup: TFiscalGroup | null): Promise<TFixedAssetView> {
		const book = await this.books.findByItem(ctx.organizationId, itemId);
		if (!book) throw new FixedAssetNotFoundError();
		return this.view((await this.books.update(ctx.organizationId, book.id, { fiscalGroup })) ?? book);
	}

	/**
	 * Depreciates every active book for one month. Items that already have
	 * an entry for the month are skipped, so a rerun only picks up assets
	 * capitalized since; each run with something to post is one journal.
	 */
	async runMonth(ctx: TFixedAssetContext, year: number, month: number): Promise<{ depreciated: number; total: number; journalEntryId: string | null }> {
		const end = periodEnd(year, month);
		return this.transactions.run(async (tx) => {
			const books = (await this.books.list(ctx.organizationId, tx)).filter((book) => book.status === 'active' && book.capitalizedOn <= end);
			const credits = new Map<string, number>();
			const done: Array<{ itemId: string; amount: number; opening: number; closing: number; method: string }> = [];
			for (const book of books) {
				const itemId = book.itemId as string;
				if (await this.depreciations.findPeriod(itemId, year, month, tx)) continue;
				const item = await this.items.getItem(itemId);
				const startedOn = item.depreciationStartedOn ?? book.capitalizedOn;
				if (startedOn > end || !item.usefulLifeMonths) continue;
				const elapsed = (await this.depreciations.listForItem(itemId, tx)).length;
				const amount = monthlyDepreciation({
					cost: item.acquisitionCost,
					salvage: item.salvageValue,
					bookValue: item.bookValue,
					usefulLifeMonths: item.usefulLifeMonths,
					method: item.depreciationMethod as 'straight_line' | 'declining_balance' | 'none',
					monthsElapsed: elapsed,
				});
				if (amount <= 0) continue;
				const updated = await this.items.applyDepreciation(itemId, ctx.organizationId, amount, tx);
				const account = await this.role(ctx.organizationId, 'finance.asset_depreciated', 'accumulated_depreciation', item.itemKind, tx);
				credits.set(account, (credits.get(account) ?? 0) + amount);
				done.push({ itemId, amount, opening: item.bookValue, closing: updated.bookValue, method: item.depreciationMethod });
			}
			if (done.length === 0) return { depreciated: 0, total: 0, journalEntryId: null };
			const total = done.reduce((sum, row) => sum + row.amount, 0);
			const first = done.map((row) => row.itemId).sort()[0];
			const { entry } = await this.posting.post(tx, {
				organizationId: ctx.organizationId,
				entryDate: end,
				sourceModule: 'finance',
				sourceType: 'depreciation_run',
				sourceId: `${year}-${String(month).padStart(2, '0')}`,
				idempotencyKey: `depreciation:${year}-${String(month).padStart(2, '0')}:${first}`,
				eventType: 'finance.asset_depreciated',
				description: `Depreciation ${year}-${String(month).padStart(2, '0')}`,
				actorUserId: ctx.actorUserId,
				lines: [
					{ accountId: await this.role(ctx.organizationId, 'finance.asset_depreciated', 'depreciation_expense', null, tx), debit: total, credit: 0 },
					...[...credits].map(([accountId, amount]) => ({ accountId, debit: 0, credit: amount })),
				],
			});
			for (const row of done) {
				await this.depreciations.create(
					{
						organizationId: ctx.organizationId,
						itemId: row.itemId,
						periodYear: year,
						periodMonth: month,
						depreciationMethod: row.method,
						depreciationAmount: row.amount,
						openingBookValue: row.opening,
						closingBookValue: row.closing,
						currencyCode: 'IDR',
						calculatedAt: new Date(),
						journalEntryId: entry.id,
					},
					tx,
				);
			}
			return { depreciated: done.length, total, journalEntryId: entry.id };
		});
	}

	/** Fiscal (UU PPh Pasal 11) against commercial depreciation for one tax year. */
	async fiscalReport(organizationId: string, year: number) {
		const rows = [];
		for (const book of await this.books.list(organizationId)) {
			const view = await this.view(book);
			const commercial = (await this.depreciations.listForItem(book.itemId as string))
				.filter((entry) => entry.periodYear === year)
				.reduce((sum, entry) => sum + entry.depreciationAmount, 0);
			const fiscal = book.fiscalGroup
				? fiscalDepreciation({
						cost: book.capitalizedAmount,
						capitalizedOn: book.capitalizedOn,
						group: book.fiscalGroup,
						method: view.depreciationMethod as 'straight_line' | 'declining_balance' | 'none',
						year,
					})
				: null;
			rows.push({
				itemId: book.itemId,
				itemCode: view.itemCode,
				itemName: view.itemName,
				fiscalGroup: book.fiscalGroup,
				capitalizedOn: book.capitalizedOn,
				cost: book.capitalizedAmount,
				fiscalMethod: fiscal?.method ?? null,
				fiscalAccumulatedBefore: fiscal?.accumulatedBefore ?? null,
				fiscalDepreciation: fiscal?.yearAmount ?? null,
				commercialDepreciation: commercial,
				/** Positive: fiscal above commercial (negative fiscal correction). */
				difference: fiscal ? fiscal.yearAmount - commercial : null,
			});
		}
		return { year, rows };
	}

	/**
	 * Disposal journal, called by inventory inside its execute transaction.
	 * Uncapitalized items have no book and post nothing.
	 */
	async postDisposal(
		tx: TTx,
		input: {
			organizationId: string;
			actorUserId: string | null;
			itemId: string;
			itemCode: string;
			itemKind: string;
			disposalId: string;
			disposalDate: string;
			acquisitionCost: number;
			accumulatedDepreciation: number;
			proceeds: number;
		},
	): Promise<string | null> {
		const book = await this.books.findByItem(input.organizationId, input.itemId, tx);
		if (!book || book.status !== 'active') return null;
		const kind = input.itemKind;
		const event = 'finance.asset_disposed';
		const net = input.acquisitionCost - input.accumulatedDepreciation;
		const gainLoss = input.proceeds - net;
		const lines = [
			{ accountId: await this.role(input.organizationId, event, 'accumulated_depreciation', kind, tx), debit: input.accumulatedDepreciation, credit: 0 },
			{ accountId: await this.role(input.organizationId, event, 'disposal_receivable', null, tx), debit: input.proceeds, credit: 0 },
			...(gainLoss < 0 ? [{ accountId: await this.role(input.organizationId, event, 'asset_disposal_loss', null, tx), debit: -gainLoss, credit: 0 }] : []),
			{ accountId: await this.role(input.organizationId, event, 'fixed_asset', kind, tx), debit: 0, credit: input.acquisitionCost },
			...(gainLoss > 0 ? [{ accountId: await this.role(input.organizationId, event, 'asset_disposal_gain', null, tx), debit: 0, credit: gainLoss }] : []),
		].filter((line) => line.debit > 0 || line.credit > 0);
		const { entry } = await this.posting.post(tx, {
			organizationId: input.organizationId,
			entryDate: input.disposalDate,
			sourceModule: 'inventory',
			sourceType: 'asset_disposal',
			sourceId: input.disposalId,
			idempotencyKey: `asset_disposal:${input.disposalId}`,
			eventType: event,
			description: `Disposal ${input.itemCode}`,
			actorUserId: input.actorUserId,
			lines,
		});
		await this.books.update(input.organizationId, book.id, { status: 'disposed', disposalEntryId: entry.id }, tx);
		return entry.id;
	}
}
