import type { THumanResourceSettingSelect } from '@drizzle/schemas/human-resource.schema';
import { z } from 'zod';

/**
 * Payroll settings (ERP-0120, grill-me Q17/Q28/Q31): the company-wide payday,
 * stored in `human_resource.settings` (`payroll` / `pay_day`). Application
 * admins only. `null` switches the daily draft run off.
 */
export const PAYROLL_SETTING_GROUP = 'payroll';
export const PAY_DAY_KEY = 'pay_day';

export const payrollSettingsSchema = z.object({
	payDay: z.number().int().min(1).max(31).nullable(),
});

export type TPayrollSettingsBody = z.output<typeof payrollSettingsSchema>;

export type TPayrollSettings = {
	/** Day of the month (1-31); a shorter month uses its last day. */
	payDay: number | null;
	/** The next run date (Asia/Jakarta business date), `null` when off. */
	nextRunDate: string | null;
};

/**
 * Statutory payroll toggles and parameters (ERP-0138, grill Q30): PPh 21 and
 * the two BPJS programmes are switched on per company in settings. Wage caps
 * are minor units; the JKK rate is a percentage string by risk class.
 */
export const STATUTORY_KEYS = {
	pph21Enabled: 'pph21_enabled',
	bpjsHealthEnabled: 'bpjs_health_enabled',
	bpjsEmploymentEnabled: 'bpjs_employment_enabled',
	jkkRate: 'bpjs_jkk_rate',
	healthWageCap: 'bpjs_health_wage_cap',
	pensionWageCap: 'bpjs_pension_wage_cap',
} as const;

const minor = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const payrollStatutorySchema = z.object({
	pph21Enabled: z.boolean(),
	bpjsHealthEnabled: z.boolean(),
	bpjsEmploymentEnabled: z.boolean(),
	/** JKK percentage, 0.24 (very low risk) to 1.74 (very high risk). */
	jkkRate: z.string().trim().regex(/^\d(\.\d{1,4})?$/),
	healthWageCap: minor,
	/** JP wage cap, announced yearly by BPJS; `null` until finance enters it. */
	pensionWageCap: minor.nullable(),
});

export type TPayrollStatutory = z.output<typeof payrollStatutorySchema>;

/** Defaults before anything is saved: everything off. */
export const STATUTORY_DEFAULTS: TPayrollStatutory = {
	pph21Enabled: false,
	bpjsHealthEnabled: false,
	bpjsEmploymentEnabled: false,
	jkkRate: '0.24',
	/** Perpres 64/2020: BPJS Kesehatan contributions stop at a Rp12.000.000 wage. */
	healthWageCap: 12_000_000 * 100,
	pensionWageCap: null,
};

/** Persistence port of `human_resource.settings`. */
export interface IHrSettingsRepository {
	find(group: string, key: string): Promise<THumanResourceSettingSelect | null>;
	/** Inserts or replaces the live value of (group, key). */
	upsert(group: string, key: string, value: string | null, valueType: 'number' | 'string' | 'boolean', updatedBy: string | null): Promise<void>;
}
