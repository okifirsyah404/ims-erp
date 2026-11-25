import { annualPph21, applyRate, ptkpFor, terRateFor, type TPph21Tables } from '@app/tax/services/exported-tax.service';
import type { TPayrollStatutory } from '../contracts/payroll-settings.contract';
import { PayrollStatutoryError, SalaryStateError } from '../errors/hr.errors';

/**
 * PPh 21 and BPJS on one salary record (ERP-0138). Pure: the caller loads
 * the settings, the tax tables and the employee's earlier months.
 *
 * @remarks
 * BPJS (when switched on): Kesehatan 4% company / 1% employee on the wage up
 * to the cap; JHT 3.7% / 2%; JP 2% / 1% up to the JP cap; JKK at the
 * configured rate and JKM 0.3%, both company. The wage is base salary plus
 * fixed allowances. The TER base adds the taxable company benefits (JKK, JKM,
 * Kesehatan) to the pay; company JHT and JP are not income. In the last tax
 * month (December, or the month employment ends) PPh 21 is the annual Pasal
 * 17 tax less what earlier months withheld, which may be negative (a refund).
 */

export type TSalaryAmounts = { baseSalary: number; allowances: number; overtimePay: number; bonus: number; deductions: number };

export type TStatutoryHistory = { taxableGross: number; pph21Amount: number; pensionEmployeeAmount: number };

export type TStatutoryResult = {
	pph21Amount: number;
	bpjsEmployeeAmount: number;
	bpjsCompanyAmount: number;
	pensionEmployeeAmount: number;
	taxableGross: number;
	ptkpStatus: string | null;
	terRate: string | null;
	taxMethod: 'ter' | 'annual' | null;
	netPay: number;
};

export function calculateStatutory(input: {
	amounts: TSalaryAmounts;
	ptkpStatus: string | null;
	lastTaxMonth: boolean;
	history: TStatutoryHistory[];
	settings: TPayrollStatutory;
	tables: TPph21Tables | null;
}): TStatutoryResult {
	const { amounts, settings } = input;
	const pay = amounts.baseSalary + amounts.allowances + amounts.overtimePay + amounts.bonus;
	const wage = amounts.baseSalary + amounts.allowances;

	let healthCompany = 0;
	let healthEmployee = 0;
	if (settings.bpjsHealthEnabled) {
		const base = Math.min(wage, settings.healthWageCap);
		healthCompany = applyRate(base, '4');
		healthEmployee = applyRate(base, '1');
	}
	let employmentCompany = 0;
	let taxableEmployment = 0;
	let pension = 0;
	if (settings.bpjsEmploymentEnabled) {
		if (settings.pensionWageCap === null) throw new PayrollStatutoryError('pensionWageCapMissing');
		const pensionBase = Math.min(wage, settings.pensionWageCap);
		const jkk = applyRate(wage, settings.jkkRate);
		const jkm = applyRate(wage, '0.3');
		employmentCompany = applyRate(wage, '3.7') + applyRate(pensionBase, '2') + jkk + jkm;
		taxableEmployment = jkk + jkm;
		pension = applyRate(wage, '2') + applyRate(pensionBase, '1');
	}
	const bpjsEmployeeAmount = healthEmployee + pension;
	const bpjsCompanyAmount = healthCompany + employmentCompany;
	const taxableGross = pay + healthCompany + taxableEmployment;

	let pph21Amount = 0;
	let terRate: string | null = null;
	let taxMethod: TStatutoryResult['taxMethod'] = null;
	if (settings.pph21Enabled) {
		const ptkp = input.tables ? ptkpFor(input.tables, input.ptkpStatus) : null;
		if (!input.tables || !ptkp) throw new PayrollStatutoryError('ptkpMissing');
		if (input.lastTaxMonth) {
			if (input.tables.brackets.length === 0) throw new PayrollStatutoryError('bracketsMissing');
			const sum = (pick: (row: TStatutoryHistory) => number) => input.history.reduce((total, row) => total + pick(row), 0);
			const annual = annualPph21({
				annualGross: sum((row) => row.taxableGross) + taxableGross,
				months: input.history.length + 1,
				pensionContribution: sum((row) => row.pensionEmployeeAmount) + pension,
				ptkpAnnual: ptkp.annualAmount,
				brackets: input.tables.brackets,
			});
			pph21Amount = annual.annualTax - sum((row) => row.pph21Amount);
			taxMethod = 'annual';
		} else {
			terRate = terRateFor(input.tables, ptkp.terCategory, taxableGross);
			if (terRate === null) throw new PayrollStatutoryError('terMissing');
			pph21Amount = applyRate(taxableGross, terRate);
			taxMethod = 'ter';
		}
	}

	const netPay = pay - amounts.deductions - pph21Amount - bpjsEmployeeAmount;
	if (netPay < 0) throw new SalaryStateError('netNegative');
	return {
		pph21Amount,
		bpjsEmployeeAmount,
		bpjsCompanyAmount,
		pensionEmployeeAmount: pension,
		taxableGross,
		ptkpStatus: input.ptkpStatus,
		terRate,
		taxMethod,
		netPay,
	};
}

/** Zero statutory amounts: everything switched off. */
export function withoutStatutory(amounts: TSalaryAmounts, ptkpStatus: string | null): TStatutoryResult {
	const pay = amounts.baseSalary + amounts.allowances + amounts.overtimePay + amounts.bonus;
	return {
		pph21Amount: 0,
		bpjsEmployeeAmount: 0,
		bpjsCompanyAmount: 0,
		pensionEmployeeAmount: 0,
		taxableGross: pay,
		ptkpStatus,
		terRate: null,
		taxMethod: null,
		netPay: pay - amounts.deductions,
	};
}
