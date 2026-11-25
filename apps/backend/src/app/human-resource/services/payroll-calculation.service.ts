import { EXPORTED_TAX_SERVICE_TOKEN } from '@app/tax/constants/di';
import type { ExportedTaxService, TPph21Tables } from '@app/tax/services/exported-tax.service';
import type { TEmployeeSelect } from '@drizzle/schemas/human-resource.schema';
import type { TTx } from '@drizzle/types';
import { inject, injectable } from 'tsyringe';
import { PAYROLL_STATUTORY_SERVICE_TOKEN, SALARY_REPOSITORY_TOKEN } from '../constants/di';
import type { TPayrollStatutory } from '../contracts/payroll-settings.contract';
import type { ISalaryRepository } from '../contracts/hr-records.repository.interface';
import { periodRange } from '../utils/hr';
import { calculateStatutory, type TSalaryAmounts, type TStatutoryResult, withoutStatutory } from '../utils/payroll-statutory';
import type { PayrollStatutoryService } from './payroll-statutory.service';

/** Settings and tables of one payroll month, loaded once per run. */
export type TPayrollMonth = { period: string; settings: TPayrollStatutory; tables: TPph21Tables | null };

/** The Jakarta business date of a unix-ms instant. */
const jakartaDay = (value: Date) => new Date(value.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

/**
 * Loads what {@link calculateStatutory} needs (ERP-0138): the statutory
 * settings, the PPh 21 tables in force on the month's last day (from the tax
 * module) and the employee's earlier records of the same year.
 */
@injectable()
export class PayrollCalculationService {
	constructor(
		@inject(SALARY_REPOSITORY_TOKEN) private readonly repository: Pick<ISalaryRepository, 'listEmployeeYear'>,
		@inject(PAYROLL_STATUTORY_SERVICE_TOKEN) private readonly statutory: Pick<PayrollStatutoryService, 'get'>,
		@inject(EXPORTED_TAX_SERVICE_TOKEN) private readonly taxes: Pick<ExportedTaxService, 'pph21Tables'>,
	) {}

	async month(period: string): Promise<TPayrollMonth> {
		const settings = await this.statutory.get();
		const tables = settings.pph21Enabled ? await this.taxes.pph21Tables(periodRange(period).end) : null;
		return { period, settings, tables };
	}

	async calculate(month: TPayrollMonth, employee: TEmployeeSelect, amounts: TSalaryAmounts, tx?: TTx): Promise<TStatutoryResult> {
		const { settings } = month;
		if (!settings.pph21Enabled && !settings.bpjsHealthEnabled && !settings.bpjsEmploymentEnabled) {
			return withoutStatutory(amounts, employee.ptkpStatus);
		}
		const { start, end } = periodRange(month.period);
		const leaving = employee.terminationDate ? jakartaDay(employee.terminationDate) : null;
		const lastTaxMonth = month.period.endsWith('-12') || (leaving !== null && leaving >= start && leaving <= end);
		const history = settings.pph21Enabled && lastTaxMonth ? await this.repository.listEmployeeYear(employee.id, month.period, tx) : [];
		return calculateStatutory({
			amounts,
			ptkpStatus: employee.ptkpStatus,
			lastTaxMonth,
			history,
			settings,
			tables: month.tables,
		});
	}
}
