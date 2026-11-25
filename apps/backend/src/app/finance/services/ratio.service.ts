import type { TChartOfAccountSelect } from '@drizzle/schemas/finance.schema';
import { inject, injectable } from 'tsyringe';
import { CHART_OF_ACCOUNT_REPOSITORY_TOKEN, POSTING_RULE_SERVICE_TOKEN, STATEMENT_REPOSITORY_TOKEN } from '../constants/di';
import type { IChartOfAccountRepository } from '../contracts/chart-of-account.repository.interface';
import type { IStatementRepository } from '../contracts/statement.contract';
import type { PostingRuleService } from './posting-rule.service';

const DAY = 86_400_000;
const round = (value: number) => Math.round(value * 10_000) / 10_000;
const ratio = (numerator: number, denominator: number) => (denominator === 0 ? null : round(numerator / denominator));
const days = (numerator: number, denominator: number, period: number) => (denominator === 0 ? null : Math.round((numerator / denominator) * period * 10) / 10);

/**
 * Financial ratios (ERP-0151): liquidity, profitability, leverage and
 * efficiency for a date range.
 *
 * @remarks
 * Balance-sheet figures are at the end date, P&L figures over the range, all
 * from posted journal lines with contra accounts signed against their section
 * (as in the corrected statements). Current items are the 1-1xxx assets and
 * 2-1xxx liabilities; cash is the statement cash; receivables, payables and
 * inventory are the accounts the `'*'` posting rules give for those roles;
 * cost of goods is the 5-xxxx expense accounts. A ratio whose denominator is
 * zero is `null`. ROA and ROE use the closing balances (not averages).
 */
@injectable()
export class RatioService {
	constructor(
		@inject(STATEMENT_REPOSITORY_TOKEN) private readonly statements: Pick<IStatementRepository, 'cashAccountIds' | 'activity'>,
		@inject(CHART_OF_ACCOUNT_REPOSITORY_TOKEN) private readonly accounts: Pick<IChartOfAccountRepository, 'listAccountsMap'>,
		@inject(POSTING_RULE_SERVICE_TOKEN) private readonly rules: Pick<PostingRuleService, 'resolveAccountId'>,
	) {}

	async ratios(organizationId: string, from: string, to: string) {
		const accounts = (await this.accounts.listAccountsMap(organizationId)) as Map<string, TChartOfAccountSelect>;
		const role = (name: string) => this.rules.resolveAccountId(organizationId, { eventType: '*', role: name }).catch(() => null);
		const [cashIds, receivable, payable, inventory] = await Promise.all([
			this.statements.cashAccountIds(organizationId),
			role('receivable'),
			role('payable'),
			role('inventory'),
		]);
		const cash = new Set(cashIds);
		const balances = await this.statements.activity(organizationId, '0001-01-01', to);
		const period = await this.statements.activity(organizationId, from, to);

		const b = { cash: 0, currentAssets: 0, totalAssets: 0, currentLiabilities: 0, totalLiabilities: 0, equity: 0, receivables: 0, payables: 0, inventory: 0, unclosedResult: 0 };
		for (const row of balances) {
			const account = accounts.get(row.accountId);
			if (!account) continue;
			const debitSide = row.debit - row.credit;
			const creditSide = row.credit - row.debit;
			if (account.accountType === 'asset') {
				b.totalAssets += debitSide;
				if (account.code.startsWith('1-1')) b.currentAssets += debitSide;
				if (cash.has(account.id)) b.cash += debitSide;
				if (account.id === receivable) b.receivables += debitSide;
				if (account.id === inventory) b.inventory += debitSide;
			} else if (account.accountType === 'liability') {
				b.totalLiabilities += creditSide;
				if (account.code.startsWith('2-1')) b.currentLiabilities += creditSide;
				if (account.id === payable) b.payables += creditSide;
			} else if (account.accountType === 'equity') {
				b.equity += creditSide;
			} else {
				b.unclosedResult += creditSide;
			}
		}
		b.equity += b.unclosedResult;

		const p = { revenue: 0, costOfGoods: 0, expenses: 0 };
		for (const row of period) {
			const account = accounts.get(row.accountId);
			if (!account) continue;
			if (account.accountType === 'revenue') p.revenue += row.credit - row.debit;
			if (account.accountType === 'expense') {
				p.expenses += row.debit - row.credit;
				if (account.code.startsWith('5-')) p.costOfGoods += row.debit - row.credit;
			}
		}
		const netIncome = p.revenue - p.expenses;
		const grossProfit = p.revenue - p.costOfGoods;
		const periodDays = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;

		return {
			from,
			to,
			days: periodDays,
			components: { ...b, revenue: p.revenue, costOfGoods: p.costOfGoods, grossProfit, netIncome },
			liquidity: {
				current: ratio(b.currentAssets, b.currentLiabilities),
				quick: ratio(b.currentAssets - b.inventory, b.currentLiabilities),
				cash: ratio(b.cash, b.currentLiabilities),
			},
			profitability: {
				grossMargin: ratio(grossProfit, p.revenue),
				netMargin: ratio(netIncome, p.revenue),
				returnOnAssets: ratio(netIncome, b.totalAssets),
				returnOnEquity: ratio(netIncome, b.equity),
			},
			leverage: { debtToEquity: ratio(b.totalLiabilities, b.equity) },
			efficiency: {
				dso: days(b.receivables, p.revenue, periodDays),
				dpo: days(b.payables, p.costOfGoods, periodDays),
				dio: days(b.inventory, p.costOfGoods, periodDays),
			},
		};
	}
}
