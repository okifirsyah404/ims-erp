/**
 * Closed-period profit contract (ERP-0153): locked periods only, profit split
 * into before and after income tax by the `income_tax_expense` rule account.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { PeriodNotFoundError, ProfitPeriodNotLockedError } from '../../src/app/finance/errors/ledger.errors';
import { ExportedProfitService } from '../../src/app/finance/services/exported-profit.service';

const period = (status: string) => ({ code: '2026-10', status, startDate: '2026-10-01', endDate: '2026-10-31' });
const pl = {
	startDate: '2026-10-01',
	endDate: '2026-10-31',
	revenue: [{ accountId: 'rev', code: '4-1100', name: 'Sales', accountType: 'revenue', amount: 10_000 }],
	expenses: [
		{ accountId: 'cogs', code: '5-1100', name: 'COGS', accountType: 'expense', amount: 6_000 },
		{ accountId: 'tax', code: '8-3000', name: 'Income tax', accountType: 'expense', amount: 1_100 },
	],
	totalRevenue: 10_000,
	totalExpenses: 7_100,
	netIncome: 2_900,
};

const service = (status: string | null, taxAccount: string | null = 'tax') => {
	const calls: string[] = [];
	const instance = new ExportedProfitService(
		{ findPeriodByMonth: async () => (status ? (period(status) as never) : null) },
		{ profitAndLoss: async (_c: unknown, from: string, to: string) => (calls.push(`${from}..${to}`), pl as never) },
		{ resolveAccountId: async () => (taxAccount ? taxAccount : Promise.reject(new Error('no rule'))) as never },
	);
	return { instance, calls };
};

describe('ExportedProfitService', () => {
	test('a locked month answers with profit before and after tax', async () => {
		const { instance, calls } = service('locked');
		const result = await instance.closedPeriodProfit('org-1', 2026, 10);
		expect(calls).toEqual(['2026-10-01..2026-10-31']);
		expect(result).toEqual({
			organizationId: 'org-1',
			periodYear: 2026,
			periodMonth: 10,
			periodCode: '2026-10',
			startDate: '2026-10-01',
			endDate: '2026-10-31',
			revenue: 10_000,
			expenses: 7_100,
			incomeTaxExpense: 1_100,
			profitBeforeTax: 4_000,
			profitAfterTax: 2_900,
			incomeTaxAccountConfigured: true,
		});
	});

	test('open and closed months are refused, a missing period is not found', async () => {
		await expect(service('open').instance.closedPeriodProfit('org-1', 2026, 10)).rejects.toBeInstanceOf(ProfitPeriodNotLockedError);
		await expect(service('closed').instance.closedPeriodProfit('org-1', 2026, 10)).rejects.toBeInstanceOf(ProfitPeriodNotLockedError);
		await expect(service(null).instance.closedPeriodProfit('org-1', 2026, 10)).rejects.toBeInstanceOf(PeriodNotFoundError);
	});

	test('without an income tax rule before tax equals after tax and says so', async () => {
		const result = await service('locked', null).instance.closedPeriodProfit('org-1', 2026, 10);
		expect(result).toMatchObject({ incomeTaxExpense: 0, profitBeforeTax: 2_900, profitAfterTax: 2_900, incomeTaxAccountConfigured: false });
	});
});
