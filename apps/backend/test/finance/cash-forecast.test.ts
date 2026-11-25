/**
 * 13-week cash forecast (ERP-0149). Today is 2026-11-25; week k starts on
 * today + 7(k - 1): week 3 = 9-15 Dec, week 4 = 16-22 Dec, week 5 = 23-29 Dec,
 * week 7 = 6-12 Jan, week 9 = 20-26 Jan, week 12 = 10-16 Feb.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { CashForecastService } from '../../src/app/finance/services/cash-forecast.service';

function service(payroll = true) {
	return new CashForecastService(
		{
			openReceivables: async () => [
				{ dueDate: '2026-11-20', outstanding: 1_000 },
				{ dueDate: '2026-12-10', outstanding: 2_000 },
				{ dueDate: '2027-06-01', outstanding: 9_999 },
			],
			openPayables: async () => [{ dueDate: null, outstanding: 500 }],
			listLines: async () => [{ expectedDate: '2026-12-20', direction: 'in', amount: 300 }] as never,
			insertLine: async () => ({}) as never,
			removeLine: async () => true,
		},
		{ cashAccountIds: async () => ['cash'], activity: async () => [{ accountId: 'cash', debit: 6_000, credit: 1_000 }] },
		{ payrollEstimate: async () => (payroll ? { period: '2026-10', net: 800, statutory: 100, payDay: 25 } : null) },
		{ renewalsDue: async () => [{ id: 'c-1', code: 'LIC-1', customerName: 'PT A', endDate: '2027-01-31', billingCycle: 'annual' }] },
	);
}

describe('CashForecastService', () => {
	test('places receivables, payables, payroll, statutory and manual lines in their weeks', async () => {
		const result = await service().forecast('org-1', '2026-11-25');
		expect(result.openingCash).toBe(5_000);
		const week = (n: number) => result.weeks[n - 1]!;
		expect(week(1)).toMatchObject({ start: '2026-11-25', end: '2026-12-01', receivables: 1_000, payables: 500, payroll: 800, inflow: 1_000, outflow: 1_300, closing: 4_700 });
		expect(week(3)).toMatchObject({ receivables: 2_000, statutory: 100 });
		expect(week(4).manualIn).toBe(300);
		expect(week(5).payroll).toBe(800);
		expect(week(7).statutory).toBe(100);
		expect(week(9).payroll).toBe(800);
		expect(week(12).statutory).toBe(100);
		expect(week(13).end).toBe('2027-02-23');
		expect(week(13).closing).toBe(5_000 + 3_300 - 500 - 2_400 - 300);
		expect(result.weeks.reduce((sum, row) => sum + row.receivables, 0)).toBe(3_000);
		expect(result.lowestWeek.closing).toBe(Math.min(...result.weeks.map((row) => row.closing)));
		expect(result.renewalsDue).toHaveLength(1);
	});

	test('without an approved payroll there is no payroll run-rate', async () => {
		const result = await service(false).forecast('org-1', '2026-11-25');
		expect(result.payrollBasis).toBeNull();
		expect(result.weeks.every((row) => row.payroll === 0 && row.statutory === 0)).toBe(true);
	});
});
