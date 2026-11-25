import { inject, injectable } from 'tsyringe';
import { HR_SETTINGS_REPOSITORY_TOKEN } from '../constants/di';
import {
	type IHrSettingsRepository,
	PAYROLL_SETTING_GROUP,
	STATUTORY_DEFAULTS,
	STATUTORY_KEYS,
	type TPayrollStatutory,
} from '../contracts/payroll-settings.contract';

/**
 * Statutory payroll settings (ERP-0138): PPh 21 and BPJS toggles plus the
 * BPJS parameters, company-wide in `human_resource.settings` (`payroll`).
 * Application admins only, like the payday.
 */
@injectable()
export class PayrollStatutoryService {
	constructor(@inject(HR_SETTINGS_REPOSITORY_TOKEN) private readonly settings: IHrSettingsRepository) {}

	private async value(key: string): Promise<string | null | undefined> {
		const row = await this.settings.find(PAYROLL_SETTING_GROUP, key);
		return row ? row.settingValue : undefined;
	}

	async get(): Promise<TPayrollStatutory> {
		const [pph21, health, employment, jkk, healthCap, pensionCap] = await Promise.all([
			this.value(STATUTORY_KEYS.pph21Enabled),
			this.value(STATUTORY_KEYS.bpjsHealthEnabled),
			this.value(STATUTORY_KEYS.bpjsEmploymentEnabled),
			this.value(STATUTORY_KEYS.jkkRate),
			this.value(STATUTORY_KEYS.healthWageCap),
			this.value(STATUTORY_KEYS.pensionWageCap),
		]);
		const amount = (raw: string | null | undefined, fallback: number | null) => {
			if (raw === undefined) return fallback;
			const parsed = raw === null ? Number.NaN : Number(raw);
			return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
		};
		return {
			pph21Enabled: pph21 === 'true',
			bpjsHealthEnabled: health === 'true',
			bpjsEmploymentEnabled: employment === 'true',
			jkkRate: jkk ?? STATUTORY_DEFAULTS.jkkRate,
			healthWageCap: amount(healthCap, STATUTORY_DEFAULTS.healthWageCap) ?? STATUTORY_DEFAULTS.healthWageCap,
			pensionWageCap: amount(pensionCap, null),
		};
	}

	async save(actorUserId: string, body: TPayrollStatutory): Promise<TPayrollStatutory> {
		const writes: [string, string | null, 'boolean' | 'string' | 'number'][] = [
			[STATUTORY_KEYS.pph21Enabled, String(body.pph21Enabled), 'boolean'],
			[STATUTORY_KEYS.bpjsHealthEnabled, String(body.bpjsHealthEnabled), 'boolean'],
			[STATUTORY_KEYS.bpjsEmploymentEnabled, String(body.bpjsEmploymentEnabled), 'boolean'],
			[STATUTORY_KEYS.jkkRate, body.jkkRate, 'string'],
			[STATUTORY_KEYS.healthWageCap, String(body.healthWageCap), 'number'],
			[STATUTORY_KEYS.pensionWageCap, body.pensionWageCap === null ? null : String(body.pensionWageCap), 'number'],
		];
		for (const [key, value, type] of writes) await this.settings.upsert(PAYROLL_SETTING_GROUP, key, value, type, actorUserId);
		return this.get();
	}
}
