/**
 * ERP-0120 payday: the day is clamped to the month's last day, the next run
 * date rolls into the next month, the daily tick does nothing when off or
 * not payday, and on payday it creates the drafts company-wide and notifies
 * every `payroll:approve` holder once — a rerun creates and notifies nothing.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { THumanResourceSettingSelect } from '@drizzle/schemas/human-resource.schema';
import type { THrScope } from '../../src/app/human-resource/contracts/hr-records.contract';
import { type IHrSettingsRepository, payrollSettingsSchema } from '../../src/app/human-resource/contracts/payroll-settings.contract';
import { PayrollScheduleService } from '../../src/app/human-resource/services/payroll-schedule.service';
import type { TSalaryPeriod } from '../../src/app/human-resource/services/salary.service';
import { nextPayDay, payDayOf } from '../../src/app/human-resource/utils/hr';

let stored: string | null;
let drafts: Set<string>;
let notices: { userIds: string[]; templateCode: string; variables?: Record<string, string>; sourceId?: string }[];
let scopes: THrScope[];

const settings: IHrSettingsRepository = {
	find: async () => (stored === null ? null : ({ settingValue: stored } as THumanResourceSettingSelect)),
	upsert: async (_group, _key, value) => {
		stored = value;
	},
};

const periodOf = (rows: number) => ({ rows: Array.from({ length: rows }) }) as unknown as TSalaryPeriod;

const service = () =>
	new PayrollScheduleService(
		settings,
		{
			period: async () => periodOf(drafts.size),
			generate: async (scope, actor, period) => {
				scopes.push(scope);
				expect(actor).toBeNull();
				for (const employee of ['e1', 'e2', 'e3']) drafts.add(`${period}|${employee}`);
				return periodOf(drafts.size);
			},
		},
		{
			listMemberRoles: async () => [
				{ organizationId: 'org-a', userId: 'owner-1', role: 'owner' },
				{ organizationId: 'org-a', userId: 'hr-1', role: 'hr' },
				{ organizationId: 'org-b', userId: 'owner-1', role: 'owner' },
				{ organizationId: 'org-b', userId: 'finance-1', role: 'member,finance' },
			],
		},
		{
			// Stand-in for the role grants: only owners and finance approve payroll here.
			hasPermission: async (_organizationId, roles) => roles.some((role) => role === 'owner' || role === 'finance'),
		},
		{
			notify: async (input) => {
				notices.push(input);
			},
		},
	);

beforeEach(() => {
	stored = null;
	drafts = new Set();
	notices = [];
	scopes = [];
});

describe('payday dates', () => {
	test('the payday is clamped to the last day of a shorter month', () => {
		expect(payDayOf('2026-02', 31)).toBe('2026-02-28');
		expect(payDayOf('2028-02', 30)).toBe('2028-02-29');
		expect(payDayOf('2026-04', 31)).toBe('2026-04-30');
		expect(payDayOf('2026-11', 25)).toBe('2026-11-25');
	});

	test('the next run date is today or later, rolling over months and years', () => {
		expect(nextPayDay('2026-11-23', 25)).toBe('2026-11-25');
		expect(nextPayDay('2026-11-25', 25)).toBe('2026-11-25');
		expect(nextPayDay('2026-11-26', 25)).toBe('2026-12-25');
		expect(nextPayDay('2026-12-31', 30)).toBe('2027-01-30');
		expect(nextPayDay('2026-01-31', 31)).toBe('2026-01-31');
		expect(nextPayDay('2026-02-01', 31)).toBe('2026-02-28');
	});

	test('the setting accepts 1-31 or null', () => {
		expect(payrollSettingsSchema.safeParse({ payDay: 0 }).success).toBe(false);
		expect(payrollSettingsSchema.safeParse({ payDay: 32 }).success).toBe(false);
		expect(payrollSettingsSchema.safeParse({ payDay: null }).success).toBe(true);
	});
});

describe('payroll settings and the daily run', () => {
	test('saving returns the next run date; null turns it off', async () => {
		expect(await service().save('admin', { payDay: 25 }, '2026-11-26')).toEqual({ payDay: 25, nextRunDate: '2026-12-25' });
		expect(await service().save('admin', { payDay: null }, '2026-11-26')).toEqual({ payDay: null, nextRunDate: null });
	});

	test('off or not payday: nothing happens', async () => {
		expect(await service().runDaily('2026-11-25')).toEqual({ ran: false, reason: 'off', today: '2026-11-25' });
		stored = '25';
		expect(await service().runDaily('2026-11-24')).toEqual({ ran: false, reason: 'notPayDay', today: '2026-11-24' });
		expect(scopes).toHaveLength(0);
		expect(notices).toHaveLength(0);
	});

	test('on payday: company-wide drafts, approvers notified once; a rerun writes and notifies nothing', async () => {
		stored = '31';
		// November has 30 days: payday 31 runs on the 30th.
		const first = await service().runDaily('2026-11-30');
		expect(first).toEqual({ ran: true, today: '2026-11-30', period: '2026-11', created: 3, notified: 2 });
		expect(scopes).toEqual([{ organizationId: '', all: true }]);
		expect(notices).toHaveLength(1);
		expect(notices[0]).toMatchObject({
			templateCode: 'hr.payroll_draft_ready',
			variables: { period: '2026-11', records: '3' },
			sourceId: '2026-11',
		});
		expect([...notices[0]!.userIds].sort()).toEqual(['finance-1', 'owner-1']);

		const again = await service().runDaily('2026-11-30');
		expect(again).toMatchObject({ ran: true, created: 0, notified: 0 });
		expect(notices).toHaveLength(1);
	});
});
