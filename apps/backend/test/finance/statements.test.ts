/**
 * Statements (ERP-0148): direct and indirect cash flow agree, the direct one
 * ties to the cash balance, changes in equity add up, comparatives.
 *
 * Ledger: capital 10,000 in cash; invoice 5,000 (AR / revenue); receipt 3,000;
 * equipment 4,000 paid in cash; depreciation 500.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { StatementService } from '../../src/app/finance/services/statement.service';

const accounts = new Map(
	[
		{ id: 'cash', code: '1-1120', name: 'Bank', accountType: 'asset', normalBalance: 'debit', cashFlowCategory: 'operating' },
		{ id: 'ar', code: '1-1310', name: 'Piutang', accountType: 'asset', normalBalance: 'debit', cashFlowCategory: 'operating' },
		{ id: 'fa', code: '1-2120', name: 'Kendaraan', accountType: 'asset', normalBalance: 'debit', cashFlowCategory: 'investing' },
		{ id: 'acc', code: '1-2220', name: 'Akumulasi', accountType: 'asset', normalBalance: 'credit', cashFlowCategory: 'investing' },
		{ id: 'eq', code: '3-1000', name: 'Modal', accountType: 'equity', normalBalance: 'credit', cashFlowCategory: 'financing' },
		{ id: 'rev', code: '4-1100', name: 'Penjualan', accountType: 'revenue', normalBalance: 'credit', cashFlowCategory: null },
		{ id: 'dep', code: '6-2500', name: 'Penyusutan', accountType: 'expense', normalBalance: 'debit', cashFlowCategory: null },
	].map((account) => [account.id, account]),
);
const period = [
	{ accountId: 'cash', debit: 13_000, credit: 4_000 },
	{ accountId: 'eq', debit: 0, credit: 10_000 },
	{ accountId: 'ar', debit: 5_000, credit: 3_000 },
	{ accountId: 'rev', debit: 0, credit: 5_000 },
	{ accountId: 'fa', debit: 4_000, credit: 0 },
	{ accountId: 'dep', debit: 500, credit: 0 },
	{ accountId: 'acc', debit: 0, credit: 500 },
];

function service() {
	return new StatementService(
		{
			cashAccountIds: async () => ['cash'],
			cashCounterparts: async () => [
				{ accountId: 'eq', inflow: 10_000 },
				{ accountId: 'ar', inflow: 3_000 },
				{ accountId: 'fa', inflow: -4_000 },
			],
			activity: async (_o: string, from: string, to: string) => (from === '0001-01-01' && to < '2026-11-01' ? [] : period),
		},
		{ listAccountsMap: async () => accounts as never },
	);
}

describe('StatementService', () => {
	test('direct cash flow by category, tied to the closing cash', async () => {
		const { current } = await service().statements('org-1', '2026-11-01', '2026-11-30', 'none');
		const direct = current.directCashFlow;
		expect([direct.operating.total, direct.investing.total, direct.financing.total]).toEqual([3_000, -4_000, 10_000]);
		expect(direct).toMatchObject({ netChange: 9_000, openingCash: 0, closingCash: 9_000, tieDifference: 0 });
	});

	test('indirect: net income, non-cash adjustment, working capital - equals the direct total', async () => {
		const { current } = await service().statements('org-1', '2026-11-01', '2026-11-30', 'none');
		const indirect = current.indirectCashFlow;
		expect(indirect.netIncome).toBe(4_500);
		expect(indirect.adjustments.lines).toEqual([{ accountId: 'acc', code: '1-2220', name: 'Akumulasi', amount: 500 }]);
		expect(indirect.workingCapital.total).toBe(-2_000);
		expect([indirect.operating, indirect.investing.total, indirect.financing.total, indirect.netChange]).toEqual([3_000, -4_000, 10_000, 9_000]);
	});

	test('changes in equity close at contributed capital plus the period result', async () => {
		const { current } = await service().statements('org-1', '2026-11-01', '2026-11-30', 'none');
		expect(current.changesInEquity).toEqual({
			lines: [{ accountId: 'eq', code: '3-1000', name: 'Modal', opening: 0, increase: 10_000, decrease: 0, closing: 10_000 }],
			unclosedPriorResult: 0,
			periodResult: 4_500,
			opening: 0,
			closing: 14_500,
		});
	});

	test('comparatives: whole months step back by months, other ranges by days, a year back', async () => {
		const s = service();
		expect((await s.statements('org-1', '2026-11-01', '2026-11-30', 'previous_period')).comparative).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
		expect((await s.statements('org-1', '2026-01-01', '2026-03-31', 'previous_period')).comparative).toMatchObject({ from: '2025-10-01', to: '2025-12-31' });
		expect((await s.statements('org-1', '2026-11-10', '2026-11-19', 'previous_period')).comparative).toMatchObject({ from: '2026-10-31', to: '2026-11-09' });
		expect((await s.statements('org-1', '2024-02-01', '2024-02-29', 'previous_year')).comparative).toMatchObject({ from: '2023-02-01', to: '2023-02-28' });
	});
});
