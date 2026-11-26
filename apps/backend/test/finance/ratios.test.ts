/**
 * Financial ratios (ERP-0151), hand-computed over a 30-day range:
 * current assets 1,200 (cash 300, AR 500, inventory 400), fixed assets 800,
 * current liabilities 600 (AP 450), long-term loan 400, equity 600 + result 400;
 * revenue 3,000, COGS 1,800, other expenses 800.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { RatioService } from '../../src/app/finance/services/ratio.service';

const acc = (id: string, code: string, accountType: string) => [id, { id, code, accountType }] as const;
const accounts = new Map([
	acc('cash', '1-1120', 'asset'),
	acc('ar', '1-1310', 'asset'),
	acc('inv', '1-1410', 'asset'),
	acc('fa', '1-2120', 'asset'),
	acc('ap', '2-1100', 'liability'),
	acc('tax', '2-1420', 'liability'),
	acc('loan', '2-2100', 'liability'),
	acc('eq', '3-1000', 'equity'),
	acc('rev', '4-1100', 'revenue'),
	acc('cogs', '5-1100', 'expense'),
	acc('opex', '6-1100', 'expense'),
]);
const pl = [
	{ accountId: 'rev', debit: 0, credit: 3_000 },
	{ accountId: 'cogs', debit: 1_800, credit: 0 },
	{ accountId: 'opex', debit: 800, credit: 0 },
];
const balances = [
	{ accountId: 'cash', debit: 300, credit: 0 },
	{ accountId: 'ar', debit: 500, credit: 0 },
	{ accountId: 'inv', debit: 400, credit: 0 },
	{ accountId: 'fa', debit: 800, credit: 0 },
	{ accountId: 'ap', debit: 0, credit: 450 },
	{ accountId: 'tax', debit: 0, credit: 150 },
	{ accountId: 'loan', debit: 0, credit: 400 },
	{ accountId: 'eq', debit: 0, credit: 600 },
	...pl,
];

describe('RatioService', () => {
	test('liquidity, profitability, leverage, efficiency', async () => {
		const service = new RatioService(
			{ cashAccountIds: async () => ['cash'], activity: async (_o: string, from: string) => (from === '0001-01-01' ? balances : pl) },
			{ listAccountsMap: async () => accounts as never },
			{ resolveAccountId: async (_o: string, lookup: { role: string }) => ({ receivable: 'ar', payable: 'ap', inventory: 'inv' })[lookup.role] as string },
		);
		const r = await service.ratios('org-1', '2026-11-01', '2026-11-30');
		expect(r.days).toBe(30);
		expect(r.components).toMatchObject({ currentAssets: 1_200, totalAssets: 2_000, currentLiabilities: 600, totalLiabilities: 1_000, equity: 1_000, netIncome: 400, grossProfit: 1_200 });
		expect(r.liquidity).toEqual({ current: 2, quick: 1.3333, cash: 0.5 });
		expect(r.profitability).toEqual({ grossMargin: 0.4, netMargin: 0.1333, returnOnAssets: 0.2, returnOnEquity: 0.4 });
		expect(r.leverage).toEqual({ debtToEquity: 1 });
		expect(r.efficiency).toEqual({ dso: 5, dpo: 7.5, dio: 6.7 });
	});
});
