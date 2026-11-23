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

/** Persistence port of `human_resource.settings`. */
export interface IHrSettingsRepository {
	find(group: string, key: string): Promise<THumanResourceSettingSelect | null>;
	/** Inserts or replaces the live value of (group, key). */
	upsert(group: string, key: string, value: string | null, valueType: 'number' | 'string', updatedBy: string | null): Promise<void>;
}
