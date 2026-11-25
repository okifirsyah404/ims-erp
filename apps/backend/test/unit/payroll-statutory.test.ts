/**
 * Payroll PPh 21 and BPJS (ERP-0138 part 2): the statutory calculation on a
 * salary record, the payroll journal, approval posting and the BP21 file.
 *
 * TER rates below are synthetic test values, not the official table.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { calculateStatutory, withoutStatutory } from '../../src/app/human-resource/utils/payroll-statutory';
import { PayrollStatutoryError, SalaryStateError } from '../../src/app/human-resource/errors/hr.errors';
import { PayrollLedgerService } from '../../src/app/finance/services/payroll-ledger.service';
import { buildBp21Xml } from '../../src/app/tax/utils/coretax-xml';

const rp = (rupiah: number) => rupiah * 100;
const ON = {
	pph21Enabled: true,
	bpjsHealthEnabled: true,
	bpjsEmploymentEnabled: true,
	jkkRate: '0.24',
	healthWageCap: rp(12_000_000),
	pensionWageCap: rp(10_000_000),
};
const TABLES = {
	ptkp: [{ statusCode: 'TK/0', annualAmount: rp(54_000_000), terCategory: 'A' }],
	ptkpEffectiveFrom: '2024-01-01',
	ter: [
		{ category: 'A', lowerBound: 0, rate: '0.0000' },
		{ category: 'A', lowerBound: rp(10_000_000), rate: '7.0000' },
	],
	terEffectiveFrom: '2024-01-01',
	brackets: [
		{ lowerBound: 0, rate: '5.0000' },
		{ lowerBound: rp(60_000_000), rate: '15.0000' },
		{ lowerBound: rp(250_000_000), rate: '25.0000' },
	],
	bracketsEffectiveFrom: '2022-01-01',
};
const AMOUNTS = { baseSalary: rp(10_000_000), allowances: rp(2_000_000), overtimePay: 0, bonus: 0, deductions: rp(100_000) };

describe('calculateStatutory', () => {
	test('a TER month: BPJS shares, taxable benefits in the TER base, net pay', () => {
		const result = calculateStatutory({ amounts: AMOUNTS, ptkpStatus: null, lastTaxMonth: false, history: [], settings: ON, tables: TABLES });
		expect(result).toEqual({
			pph21Amount: rp(878_136),
			bpjsEmployeeAmount: rp(460_000),
			bpjsCompanyAmount: rp(1_188_800),
			pensionEmployeeAmount: rp(340_000),
			taxableGross: rp(12_544_800),
			ptkpStatus: null,
			terRate: '7.0000',
			taxMethod: 'ter',
			netPay: rp(10_561_864),
		});
	});

	test('the last tax month reconciles the year and may refund', () => {
		const history = Array.from({ length: 11 }, () => ({
			taxableGross: rp(12_544_800),
			pph21Amount: rp(878_136),
			pensionEmployeeAmount: rp(340_000),
		}));
		const result = calculateStatutory({ amounts: AMOUNTS, ptkpStatus: 'TK/0', lastTaxMonth: true, history, settings: ON, tables: TABLES });
		expect(result.taxMethod).toBe('annual');
		expect(result.terRate).toBeNull();
		expect(result.pph21Amount).toBe(rp(7_220_550 - 11 * 878_136));
		expect(result.netPay).toBe(rp(12_000_000 - 100_000 + 2_438_946 - 460_000));
	});

	test('switches: off means no statutory amounts; BPJS only means no PPh 21', () => {
		expect(withoutStatutory(AMOUNTS, 'K/1')).toMatchObject({ pph21Amount: 0, bpjsEmployeeAmount: 0, netPay: rp(11_900_000), ptkpStatus: 'K/1' });
		const healthOnly = calculateStatutory({
			amounts: AMOUNTS,
			ptkpStatus: null,
			lastTaxMonth: false,
			history: [],
			settings: { ...ON, pph21Enabled: false, bpjsEmploymentEnabled: false },
			tables: null,
		});
		expect(healthOnly).toMatchObject({ pph21Amount: 0, bpjsEmployeeAmount: rp(120_000), bpjsCompanyAmount: rp(480_000), taxMethod: null });
	});

	test('missing JP cap, missing TER, negative net are refused', () => {
		const base = { amounts: AMOUNTS, ptkpStatus: null, lastTaxMonth: false, history: [] };
		expect(() => calculateStatutory({ ...base, settings: { ...ON, pensionWageCap: null }, tables: TABLES })).toThrow(PayrollStatutoryError);
		expect(() => calculateStatutory({ ...base, settings: ON, tables: { ...TABLES, ter: [] } })).toThrow(PayrollStatutoryError);
		expect(() => calculateStatutory({ ...base, settings: ON, tables: null })).toThrow(PayrollStatutoryError);
		expect(() =>
			calculateStatutory({ ...base, amounts: { ...AMOUNTS, deductions: rp(12_000_000) }, settings: ON, tables: TABLES }),
		).toThrow(SalaryStateError);
	});
});

describe('PayrollLedgerService', () => {
	function harness() {
		const posted: Array<{ lines: Array<{ role: string; debit: number; credit: number }>; idempotencyKey: string; sourceModule: string }> = [];
		const service = new PayrollLedgerService({
			postBusinessEvent: async (_tx: unknown, input: never) => {
				posted.push(input);
				return { entry: { id: 'je-payroll' } } as never;
			},
		});
		return { service, posted };
	}
	const input = (pph21: number) => ({
		organizationId: 'org-1',
		actorUserId: 'owner',
		period: '2026-11',
		entryDate: '2026-11-30',
		recordIds: ['b', 'a'],
		totals: {
			pay: rp(12_000_000),
			deductions: rp(100_000),
			pph21,
			bpjsEmployee: rp(460_000),
			bpjsCompany: rp(1_188_800),
			net: rp(12_000_000 - 100_000 - 460_000) - pph21,
		},
	});

	test('balanced payroll journal by posting role', async () => {
		const h = harness();
		expect(await h.service.postPayroll({} as never, input(rp(878_136)))).toBe('je-payroll');
		const { lines, idempotencyKey, sourceModule } = h.posted[0]!;
		expect(lines).toEqual([
			{ role: 'salary_expense', debit: rp(12_000_000), credit: 0 },
			{ role: 'bpjs_expense', debit: rp(1_188_800), credit: 0 },
			{ role: 'salary_payable', debit: 0, credit: rp(10_561_864) },
			{ role: 'pph21_payable', debit: 0, credit: rp(878_136) },
			{ role: 'bpjs_payable', debit: 0, credit: rp(1_648_800) },
			{ role: 'employee_receivable', debit: 0, credit: rp(100_000) },
		]);
		const debit = lines.reduce((sum, line) => sum + line.debit, 0);
		const credit = lines.reduce((sum, line) => sum + line.credit, 0);
		expect(debit).toBe(credit);
		expect(idempotencyKey).toBe('payroll:2026-11:a');
		expect(sourceModule).toBe('human_resource');
	});

	test('a December refund debits Utang PPh 21', async () => {
		const h = harness();
		await h.service.postPayroll({} as never, input(-rp(500_000)));
		expect(h.posted[0]!.lines.find((line) => line.role === 'pph21_payable')).toEqual({ role: 'pph21_payable', debit: rp(500_000), credit: 0 });
	});
});

describe('BP21 XML', () => {
	test('one MmPayroll per employee with PTKP, gross and TER rate', () => {
		const xml = buildBp21Xml('0012345678901000', [
			{
				periodYear: 2026,
				periodMonth: 11,
				counterpartyTin: '3201234567890001',
				ptkpStatus: 'K/1',
				taxObjectCode: '21-100-01',
				gross: rp(12_544_800),
				ratePercent: '7',
				withholdingDate: '2026-11-30',
			},
		]);
		expect(xml).toContain('<MmPayrollBulk');
		expect(xml).toContain('<CounterpartTin>3201234567890001</CounterpartTin>');
		expect(xml).toContain('<StatusTaxExemption>K/1</StatusTaxExemption>');
		expect(xml).toContain('<Gross>12544800.00</Gross>');
		expect(xml).toContain('<TaxObjectCode>21-100-01</TaxObjectCode>');
	});
});

describe('SalaryService approval (ERP-0138)', () => {
	test('drafts are recalculated, approved and posted as one stamped journal', async () => {
		const { SalaryService } = await import('../../src/app/human-resource/services/salary.service');
		const rows: Array<Record<string, unknown>> = [
			{ id: 'r1', period: '2026-11', employeeId: 'e1', employeeName: 'Ani', status: 'draft', notes: null, createdBy: 'hr', ...AMOUNTS, pph21Amount: 0, bpjsEmployeeAmount: 0, bpjsCompanyAmount: 0, netPay: rp(11_900_000) },
		];
		const stamped: Array<[string[], string]> = [];
		const totals: unknown[] = [];
		const service = new SalaryService(
			{
				listPeriod: async () => rows as never,
				findById: async () => null,
				upsertDraft: async (data: Record<string, unknown>) => Object.assign(rows[0]!, data) as never,
				removeDraft: async () => false,
				approvePeriod: async () => {
					rows[0]!.status = 'approved';
					return ['r1'];
				},
				listApprovedForEmployee: async () => [],
				listEmployeeYear: async () => [],
				listByIds: async () => rows as never,
				latestApprovedTotals: async () => null,
				setJournalEntry: async (ids: string[], id: string) => {
					stamped.push([ids, id]);
				},
			},
			{ require: async () => ({}) as never, listVisible: async () => [{ id: 'e1', ptkpStatus: null, terminationDate: null }] as never, findByCodes: async () => [] },
			{ approvedHours: async () => [] },
			{ run: <T>(work: (tx: never) => Promise<T>) => work({} as never) } as never,
			{ amountsFor: async () => new Map() },
			undefined,
			{
				month: async () => ({ period: '2026-11', settings: ON, tables: TABLES }),
				calculate: async () => calculateStatutory({ amounts: AMOUNTS, ptkpStatus: null, lastTaxMonth: false, history: [], settings: ON, tables: TABLES }),
			},
			{
				postPayroll: async (_tx: unknown, input: { totals: unknown }) => {
					totals.push(input.totals);
					return 'je-1';
				},
			},
		);
		await service.approve({ organizationId: 'org-1', all: false }, 'owner', '2026-11');
		expect(rows[0]!.pph21Amount).toBe(rp(878_136));
		expect(totals[0]).toEqual({
			pay: rp(12_000_000),
			deductions: rp(100_000),
			pph21: rp(878_136),
			bpjsEmployee: rp(460_000),
			bpjsCompany: rp(1_188_800),
			net: rp(10_561_864),
		});
		expect(stamped).toEqual([[['r1'], 'je-1']]);
	});
});
