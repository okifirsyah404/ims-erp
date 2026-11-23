/**
 * ERP-0118 employee work schedule: the shift body rule (a day off has no
 * times, a working day both), the week grid limited to the ERP-0034 scope,
 * one cell per employee per date, the weekly-pattern fill that skips taken
 * cells and the employees' working days, and the fill range limit.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TEmployeeSelect, TScheduleSelect } from '@drizzle/schemas/human-resource.schema';
import type { THrScope } from '../../src/app/human-resource/contracts/hr-records.contract';
import type { IHrPeopleRepository } from '../../src/app/human-resource/contracts/hr-records.repository.interface';
import { scheduleBodySchema, scheduleFillSchema } from '../../src/app/human-resource/contracts/schedule.contract';
import type { IScheduleRepository } from '../../src/app/human-resource/contracts/schedule.repository.interface';
import { EmployeeStateError, HrNotFoundError, ScheduleError } from '../../src/app/human-resource/errors/hr.errors';
import { HrPeopleService } from '../../src/app/human-resource/services/people.service';
import { ScheduleService } from '../../src/app/human-resource/services/schedule.service';
import { addDays, weekdayIndex } from '../../src/app/human-resource/utils/hr';

const E1 = '0190a1b2-0000-7000-8000-0000000000e1';
const E2 = '0190a1b2-0000-7000-8000-0000000000e2';
const E3 = '0190a1b2-0000-7000-8000-0000000000e3';
const ORG = 'org-sales';
const scope: THrScope = { organizationId: ORG, all: false };
// 2026-11-23 is a Monday.
const MONDAY = '2026-11-23';

const day = (value: string) => new Date(`${value}T00:00:00+07:00`);
const person = (id: string, code: string, extra: Partial<TEmployeeSelect> = {}) =>
	({
		id,
		organizationId: ORG,
		employeeCode: code,
		fullName: `Person ${code}`,
		employmentStatus: 'active',
		hireDate: day('2025-01-01'),
		terminationDate: null,
		deletedAt: null,
		...extra,
	}) as TEmployeeSelect;

let staff: TEmployeeSelect[];
let rows: TScheduleSelect[];

const visible = (employee: TEmployeeSelect, scoped: THrScope) =>
	scoped.all || employee.organizationId === null || employee.organizationId === scoped.organizationId;

const peopleRepository: IHrPeopleRepository = {
	findVisible: async (id, scoped) => staff.find((row) => row.id === id && visible(row, scoped)) ?? null,
	listVisible: async (scoped) => staff.filter((row) => visible(row, scoped)),
	findByCodes: async () => [],
	findBank: async () => null,
	saveBank: async () => {
		throw new Error('unused');
	},
};

const repository: IScheduleRepository = {
	listBetween: async (start, end, scoped) =>
		rows.filter((row) => row.workDate >= start && row.workDate <= end && visible(staff.find((item) => item.id === row.employeeId)!, scoped)),
	findById: async (id) => rows.find((row) => row.id === id) ?? null,
	findByDay: async (employeeId, workDate) => rows.find((row) => row.employeeId === employeeId && row.workDate === workDate) ?? null,
	insert: async (row) => {
		const created = { ...row, id: crypto.randomUUID() } as TScheduleSelect;
		rows.push(created);
		return created;
	},
	insertMissing: async (input) => {
		let written = 0;
		for (const row of input) {
			if (rows.some((item) => item.employeeId === row.employeeId && item.workDate === row.workDate)) continue;
			rows.push({ ...row, id: crypto.randomUUID() } as TScheduleSelect);
			written += 1;
		}
		return written;
	},
	update: async (id, data) => {
		const row = rows.find((item) => item.id === id);
		return row ? Object.assign(row, data) : null;
	},
	softDelete: async (id) => {
		const before = rows.length;
		rows = rows.filter((row) => row.id !== id);
		return rows.length < before;
	},
};

const service = () => new ScheduleService(repository, new HrPeopleService(peopleRepository));

const WORK = { isDayOff: false, shiftStart: '08:00', shiftEnd: '17:00', shiftLabel: 'Pagi' };
const OFF = { isDayOff: true };
const PATTERN = [WORK, WORK, WORK, WORK, WORK, WORK, OFF];

beforeEach(() => {
	staff = [person(E1, 'EMP-0001'), person(E2, 'EMP-0002', { organizationId: null }), person(E3, 'EMP-0003', { organizationId: 'org-other' })];
	rows = [];
});

describe('schedule rules', () => {
	test('date helpers: Monday-first weekday, calendar arithmetic across months', () => {
		expect([weekdayIndex(MONDAY), weekdayIndex('2026-11-29')]).toEqual([0, 6]);
		expect(addDays('2026-11-29', 3)).toBe('2026-12-02');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	test('a working day needs both times; a day off has none', () => {
		expect(scheduleBodySchema.safeParse({ employeeId: E1, workDate: MONDAY, ...WORK }).success).toBe(true);
		expect(scheduleBodySchema.safeParse({ employeeId: E1, workDate: MONDAY, isDayOff: true }).success).toBe(true);
		expect(scheduleBodySchema.safeParse({ employeeId: E1, workDate: MONDAY, shiftStart: '08:00' }).success).toBe(false);
		expect(scheduleBodySchema.safeParse({ employeeId: E1, workDate: MONDAY, isDayOff: true, shiftStart: '08:00', shiftEnd: '17:00' }).success).toBe(false);
		// Overnight shifts end before they start.
		expect(scheduleBodySchema.safeParse({ employeeId: E1, workDate: MONDAY, shiftStart: '22:00', shiftEnd: '06:00' }).success).toBe(true);
		expect(scheduleFillSchema.safeParse({ from: MONDAY, to: '2026-11-22', pattern: PATTERN }).success).toBe(false);
	});
});

describe('schedule cells', () => {
	test('one cell per employee per date; edit, move clash, delete; scope enforced', async () => {
		const cell = await service().create(scope, 'hr', scheduleBodySchema.parse({ employeeId: E1, workDate: MONDAY, ...WORK }));
		expect(cell).toMatchObject({ shiftStart: '08:00', shiftEnd: '17:00', isDayOff: false });
		await expect(service().create(scope, 'hr', scheduleBodySchema.parse({ employeeId: E1, workDate: MONDAY, ...OFF }))).rejects.toBeInstanceOf(ScheduleError);
		await expect(service().create(scope, 'hr', scheduleBodySchema.parse({ employeeId: E3, workDate: MONDAY, ...WORK }))).rejects.toBeInstanceOf(HrNotFoundError);

		const off = await service().update(scope, cell.id, scheduleBodySchema.parse({ employeeId: E1, workDate: MONDAY, ...OFF }));
		expect(off).toMatchObject({ isDayOff: true, shiftStart: null, shiftEnd: null });

		const tuesday = await service().create(scope, 'hr', scheduleBodySchema.parse({ employeeId: E1, workDate: addDays(MONDAY, 1), ...WORK }));
		await expect(
			service().update(scope, tuesday.id, scheduleBodySchema.parse({ employeeId: E1, workDate: MONDAY, ...WORK })),
		).rejects.toMatchObject({ key: 'hr.schedule.duplicate' });

		expect(await service().remove(scope, cell.id)).toEqual({ removed: true });
		await expect(service().remove(scope, cell.id)).rejects.toBeInstanceOf(HrNotFoundError);
	});

	test('a terminated employee gets no new cell', async () => {
		staff[0] = person(E1, 'EMP-0001', { employmentStatus: 'terminated', terminationDate: day('2026-11-01') });
		await expect(service().create(scope, 'hr', scheduleBodySchema.parse({ employeeId: E1, workDate: MONDAY, ...WORK }))).rejects.toBeInstanceOf(
			EmployeeStateError,
		);
	});
});

describe('week grid and fill', () => {
	test('fill writes the pattern on working days, skips taken cells, and the week shows only visible employees', async () => {
		// E2 starts on Wednesday; E1 already has Monday as a day off.
		staff[1] = person(E2, 'EMP-0002', { organizationId: null, hireDate: day('2026-11-25') });
		await service().create(scope, 'hr', scheduleBodySchema.parse({ employeeId: E1, workDate: MONDAY, ...OFF }));

		const result = await service().fill(scope, 'hr', scheduleFillSchema.parse({ from: MONDAY, to: addDays(MONDAY, 6), pattern: PATTERN }));
		// E1: 7 days, Monday taken (6 new); E2: Wed..Sun (5 new). E3 is outside the scope.
		expect(result).toEqual({ created: 11, skipped: 1 });
		expect(rows.find((row) => row.employeeId === E1 && row.workDate === MONDAY)?.isDayOff).toBe(true);
		expect(rows.find((row) => row.employeeId === E1 && row.workDate === '2026-11-29')).toMatchObject({ isDayOff: true, shiftStart: null });
		expect(rows.find((row) => row.employeeId === E1 && row.workDate === '2026-11-24')).toMatchObject({ shiftStart: '08:00', shiftLabel: 'Pagi' });

		const week = await service().week(scope, MONDAY);
		expect(week.dates).toHaveLength(7);
		expect(week.rows.map((row) => row.employee.employeeCode)).toEqual(['EMP-0001', 'EMP-0002']);
		expect(week.rows[1]!.cells[MONDAY]).toBeNull();
		expect(week.rows[1]!.cells['2026-11-25']).toMatchObject({ shiftStart: '08:00' });

		// A second identical fill writes nothing.
		expect(await service().fill(scope, 'hr', scheduleFillSchema.parse({ from: MONDAY, to: addDays(MONDAY, 6), pattern: PATTERN }))).toEqual({
			created: 0,
			skipped: 12,
		});
	});

	test('fill for chosen employees only, within the scope; long ranges are refused', async () => {
		const result = await service().fill(scope, 'hr', scheduleFillSchema.parse({ from: MONDAY, to: MONDAY, employeeIds: [E2], pattern: PATTERN }));
		expect(result).toEqual({ created: 1, skipped: 0 });
		expect(rows.map((row) => row.employeeId)).toEqual([E2]);
		await expect(
			service().fill(scope, 'hr', scheduleFillSchema.parse({ from: MONDAY, to: MONDAY, employeeIds: [E3], pattern: PATTERN })),
		).rejects.toBeInstanceOf(HrNotFoundError);
		await expect(
			service().fill(scope, 'hr', scheduleFillSchema.parse({ from: MONDAY, to: addDays(MONDAY, 62), pattern: PATTERN })),
		).rejects.toMatchObject({ key: 'hr.schedule.rangeTooLong' });
	});
});
