import { inject, injectable } from 'tsyringe';
import { HR_SETTINGS_REPOSITORY_TOKEN, SALARY_REPOSITORY_TOKEN } from '../constants/di';
import type { ISalaryRepository } from '../contracts/hr-records.repository.interface';
import { type IHrSettingsRepository, PAY_DAY_KEY, PAYROLL_SETTING_GROUP } from '../contracts/payroll-settings.contract';

/** What finance's cash forecast needs from payroll (ERP-0149). */
export type TPayrollEstimate = {
	/** The latest approved period, `YYYY-MM`. */
	period: string;
	/** Net pay paid out on payday. */
	net: number;
	/** PPh 21 plus both BPJS shares, paid the following month. */
	statutory: number;
	/** Day of the month (1-31); `null` when no payday is set. */
	payDay: number | null;
};

/**
 * Repository-only payroll facade for finance (ERP-0149): the latest approved
 * month as the run-rate of the cash forecast, and the payday. Repository-only
 * so finance can read it while HR posts through finance.
 */
@injectable()
export class ExportedPayrollService {
	constructor(
		@inject(SALARY_REPOSITORY_TOKEN) private readonly salaries: Pick<ISalaryRepository, 'latestApprovedTotals'>,
		@inject(HR_SETTINGS_REPOSITORY_TOKEN) private readonly settings: Pick<IHrSettingsRepository, 'find'>,
	) {}

	async payrollEstimate(): Promise<TPayrollEstimate | null> {
		const totals = await this.salaries.latestApprovedTotals();
		if (!totals) return null;
		const row = await this.settings.find(PAYROLL_SETTING_GROUP, PAY_DAY_KEY);
		const day = row?.settingValue ? Number(row.settingValue) : Number.NaN;
		return {
			period: totals.period,
			net: totals.net,
			statutory: totals.pph21 + totals.bpjsEmployee + totals.bpjsCompany,
			payDay: Number.isInteger(day) && day >= 1 && day <= 31 ? day : null,
		};
	}
}
