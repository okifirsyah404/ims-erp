import { EXPORTED_NOTIFICATION_SERVICE_TOKEN } from '@app/notification/constants/di';
import type { ExportedNotificationService } from '@app/notification/services/exported-notification.service';
import { EXPORTED_ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { ExportedOrganizationService } from '@app/organization/services/exported-organization.service';
import { type IPermissionResolver, PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import { parseRoleList } from '@ims-erp/common';
import { pinoLogger } from '@providers/logger/logger';
import { businessDateOf } from '@utils/business-date.util';
import { inject, injectable } from 'tsyringe';
import { HR_SETTINGS_REPOSITORY_TOKEN, SALARY_SERVICE_TOKEN } from '../constants/di';
import type { THrScope } from '../contracts/hr-records.contract';
import {
	type IHrSettingsRepository,
	PAY_DAY_KEY,
	PAYROLL_SETTING_GROUP,
	type TPayrollSettings,
	type TPayrollSettingsBody,
} from '../contracts/payroll-settings.contract';
import { nextPayDay, payDayOf } from '../utils/hr';
import type { SalaryService } from './salary.service';

/** The draft run is company-wide: every employee, whatever the organization. */
const COMPANY_SCOPE: THrScope = { organizationId: '', all: true };

export type TPayrollRunResult =
	| { ran: false; reason: 'off' | 'notPayDay'; today: string }
	| { ran: true; today: string; period: string; created: number; notified: number };

/**
 * The payday and its daily draft run (ERP-0120, grill-me Q17/Q18/Q28/Q31).
 *
 * @remarks
 * Application admins set the day of the month; a shorter month uses its last
 * day. The daily job calls {@link PayrollScheduleService.runDaily}: on payday
 * it creates the month's draft payroll for every employee through
 * `SalaryService.generate` (existing rows are kept, so a rerun writes
 * nothing) and, when it created drafts, notifies in-app every member holding
 * `payroll:approve`. Approval stays manual; overtime pay stays 0.
 */
@injectable()
export class PayrollScheduleService {
	constructor(
		@inject(HR_SETTINGS_REPOSITORY_TOKEN) private readonly settings: IHrSettingsRepository,
		@inject(SALARY_SERVICE_TOKEN) private readonly salaries: Pick<SalaryService, 'generate' | 'period'>,
		@inject(EXPORTED_ORGANIZATION_SERVICE_TOKEN) private readonly organizations: Pick<ExportedOrganizationService, 'listMemberRoles'>,
		@inject(PERMISSION_RESOLVER_TOKEN) private readonly permissions: Pick<IPermissionResolver, 'hasPermission'>,
		@inject(EXPORTED_NOTIFICATION_SERVICE_TOKEN) private readonly notifications: Pick<ExportedNotificationService, 'notify'>,
	) {}

	private async payDay(): Promise<number | null> {
		const row = await this.settings.find(PAYROLL_SETTING_GROUP, PAY_DAY_KEY);
		const value = row?.settingValue ? Number(row.settingValue) : NaN;
		return Number.isInteger(value) && value >= 1 && value <= 31 ? value : null;
	}

	async get(today: string = businessDateOf()): Promise<TPayrollSettings> {
		const payDay = await this.payDay();
		return { payDay, nextRunDate: payDay ? nextPayDay(today, payDay) : null };
	}

	async save(actorUserId: string, body: TPayrollSettingsBody, today: string = businessDateOf()): Promise<TPayrollSettings> {
		await this.settings.upsert(
			PAYROLL_SETTING_GROUP,
			PAY_DAY_KEY,
			body.payDay === null ? null : String(body.payDay),
			'number',
			actorUserId,
		);
		return this.get(today);
	}

	/** Members of any live organization whose roles grant `payroll:approve`. */
	private async approvers(): Promise<string[]> {
		const holders = new Set<string>();
		for (const member of await this.organizations.listMemberRoles()) {
			if (holders.has(member.userId)) continue;
			if (await this.permissions.hasPermission(member.organizationId, parseRoleList(member.role), { payroll: ['approve'] })) {
				holders.add(member.userId);
			}
		}
		return [...holders];
	}

	/** One daily tick (Asia/Jakarta). Never throws for "nothing to do". */
	async runDaily(today: string = businessDateOf()): Promise<TPayrollRunResult> {
		const payDay = await this.payDay();
		if (!payDay) return { ran: false, reason: 'off', today };
		const period = today.slice(0, 7);
		if (payDayOf(period, payDay) !== today) return { ran: false, reason: 'notPayDay', today };

		const before = (await this.salaries.period(COMPANY_SCOPE, period)).rows.length;
		const after = (await this.salaries.generate(COMPANY_SCOPE, null, period)).rows.length;
		const created = after - before;
		let notified = 0;
		if (created > 0) {
			const userIds = await this.approvers();
			await this.notifications.notify({
				userIds,
				templateCode: 'hr.payroll_draft_ready',
				variables: { period, records: String(created) },
				sourceType: 'payroll_period',
				// Deterministic per period: a rerun on the same day never doubles the notice.
				sourceId: period,
				metadata: { href: `/hr/payroll?period=${period}` },
			});
			notified = userIds.length;
		}
		pinoLogger.info({ period, created, notified }, 'payroll draft run');
		return { ran: true, today, period, created, notified };
	}
}
