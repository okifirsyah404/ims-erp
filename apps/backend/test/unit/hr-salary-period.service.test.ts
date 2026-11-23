/**
 * ERP-0119 salary periods: a new period must start after the latest one and
 * closes it the day before; only the active period is edited; only the
 * latest is deleted, reopening the previous one; employees outside the
 * ERP-0034 scope are not found; payroll amounts come from the period in
 * force at the month's end.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TEmployeeSalarySelect, TEmployeeSelect } from '@drizzle/schemas/human-resource.schema';
import type { THrScope } from '../../src/app/human-resource/contracts/hr-records.contract';
import type { IHrPeopleRepository } from '../../src/app/human-resource/contracts/hr-records.repository.interface';
import { type ISalaryPeriodRepository, salaryPeriodCreateSchema } from '../../src/app/human-resource/contracts/salary-period.contract';
import { HrNotFoundError, SalaryPeriodError } from '../../src/app/human-resource/errors/hr.errors';
import { HrPeopleService } from '../../src/app/human-resource/services/people.service';
import { SalaryPeriodService } from '../../src/app/human-resource/services/salary-period.service';

const E1 = '0190a1b2-0000-7000-8000-0000000000e1';
const E3 = '0190a1b2-0000-7000-8000-0000000000e3';
const scope: THrScope = { organizationId: 'org-sales', all: false };

let staff: TEmployeeSelect[];
let rows: TEmployeeSalarySelect[];

const live = () => rows.filter((row) => !row.deletedAt);
const byStartDesc = (a: TEmployeeSalarySelect, b: TEmployeeSalarySelect) => b.effectiveFrom.localeCompare(a.effectiveFrom);

const people: IHrPeopleRepository = {
	findVisible: async (id, scoped) =>
		staff.find((row) => row.id === id && (row.organizationId === null || row.organizationId === scoped.organizationId)) ?? null,
	listVisible: async () => staff,
	findByCodes: async () => [],
};

const repository: ISalaryPeriodRepository = {
	listForEmployee: async (employeeId) => live().filter((row) => row.employeeId === employeeId).sort(byStartDesc),
	findById: async (id) => live().find((row) => row.id === id) ?? null,
	findLatest: async (employeeId) => live().filter((row) => row.employeeId === employeeId).sort(byStartDesc)[0] ?? null,
	listOverlapping: async (start, end) =>
		live()
			.filter((row) => row.effectiveFrom <= end && (row.effectiveTo === null || row.effectiveTo >= start))
			.sort(byStartDesc),
	insert: async (row) => {
		const created = { ...row, id: crypto.randomUUID(), deletedAt: null, currencyCode: 'IDR' } as TEmployeeSalarySelect;
		rows.push(created);
		return created;
	},
	update: async (id, data) => {
		const row = live().find((item) => item.id === id);
		return row ? Object.assign(row, data) : null;
	},
	softDelete: async (id) => {
		const row = live().find((item) => item.id === id);
		if (row) row.deletedAt = new Date();
		return !!row;
	},
};

const service = () => new SalaryPeriodService(repository, new HrPeopleService(people), { run: (work) => work({} as never) });
const period = (effectiveFrom: string, baseSalary: number) => salaryPeriodCreateSchema.parse({ effectiveFrom, baseSalary, fixedAllowances: 50_000_00 });

beforeEach(() => {
	staff = [
		{ id: E1, organizationId: 'org-sales', employmentStatus: 'active' } as TEmployeeSelect,
		{ id: E3, organizationId: 'org-other', employmentStatus: 'active' } as TEmployeeSelect,
	];
	rows = [];
});

describe('salary periods', () => {
	test('a new period closes the previous one the day before; it must start later', async () => {
		const first = await service().create(scope, 'hr', E1, period('2026-01-01', 5_000_000_00));
		const second = await service().create(scope, 'hr', E1, period('2026-07-01', 5_500_000_00));
		const list = await service().list(scope, E1);
		expect(list.map((row) => [row.effectiveFrom, row.effectiveTo, row.isActive])).toEqual([
			['2026-07-01', null, true],
			['2026-01-01', '2026-06-30', false],
		]);
		expect(second.isActive).toBe(true);
		expect(first.id).toBe(list[1]!.id);
		await expect(service().create(scope, 'hr', E1, period('2026-07-01', 1))).rejects.toMatchObject({ key: 'hr.salaryPeriod.overlap' });
		await expect(service().create(scope, 'hr', E1, period('2026-03-01', 1))).rejects.toBeInstanceOf(SalaryPeriodError);
	});

	test('only the active period is edited; only the latest is deleted and the previous reopens', async () => {
		const first = await service().create(scope, 'hr', E1, period('2026-01-01', 5_000_000_00));
		const second = await service().create(scope, 'hr', E1, period('2026-07-01', 5_500_000_00));
		await expect(service().update(scope, first.id, { baseSalary: 1, fixedAllowances: 0 })).rejects.toMatchObject({
			key: 'hr.salaryPeriod.notActive',
		});
		expect((await service().update(scope, second.id, { baseSalary: 6_000_000_00, fixedAllowances: 0 })).baseSalary).toBe(6_000_000_00);
		await expect(service().remove(scope, first.id)).rejects.toMatchObject({ key: 'hr.salaryPeriod.notLatest' });
		expect(await service().remove(scope, second.id)).toEqual({ removed: true });
		expect((await service().list(scope, E1)).map((row) => [row.effectiveFrom, row.effectiveTo, row.isActive])).toEqual([['2026-01-01', null, true]]);
	});

	test('employees outside the scope are not found', async () => {
		await expect(service().create(scope, 'hr', E3, period('2026-01-01', 1))).rejects.toBeInstanceOf(HrNotFoundError);
		await expect(service().list(scope, E3)).rejects.toBeInstanceOf(HrNotFoundError);
	});

	test('payroll amounts: the period in force at the end of the month', async () => {
		await service().create(scope, 'hr', E1, period('2026-01-01', 5_000_000_00));
		await service().create(scope, 'hr', E1, period('2026-11-15', 5_500_000_00));
		expect((await service().amountsFor('2026-11-01', '2026-11-30')).get(E1)).toEqual({ baseSalary: 5_500_000_00, allowances: 50_000_00 });
		expect((await service().amountsFor('2026-10-01', '2026-10-31')).get(E1)).toEqual({ baseSalary: 5_000_000_00, allowances: 50_000_00 });
	});
});
