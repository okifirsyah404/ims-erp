/**
 * M08 employee records on top of ERP-0034 employees: pure rules; the
 * employee scope (company-level + the caller's organization); bank account
 * masked without employee:read_private; leave with working days, quota
 * (pending counted), overlap, no self-decision, attendance written on
 * approval and removed on cancel; overtime; the attendance import (all rows
 * or none, errors per row, ambiguous codes); salary summaries (net computed,
 * generated from last month, locked once approved, import in rupiah).
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	TAttendanceSelect,
	TBankAccountSelect,
	TEmployeeSelect,
	TLeaveRequestSelect,
	TLeaveTypeSelect,
	TOvertimeSelect,
	TSalarySummarySelect,
} from '@drizzle/schemas/hr.schema';
import { leaveBodySchema, salaryBodySchema, type THrScope } from '../../src/app/hr/contracts/hr-records.contract';
import type { IHrPeopleRepository, TAttendanceUpsert } from '../../src/app/hr/contracts/hr-records.repository.interface';
import { EmployeeStateError, HrNotFoundError, LeaveInvalidError, SalaryStateError, SelfDecisionError } from '../../src/app/hr/errors/hr.errors';
import { AttendanceService } from '../../src/app/hr/services/attendance.service';
import { EmployeeService } from '../../src/app/hr/services/employee.service';
import { LeaveService } from '../../src/app/hr/services/leave.service';
import { HrPeopleService, worksOn } from '../../src/app/hr/services/people.service';
import { SalaryService } from '../../src/app/hr/services/salary.service';
import { isBusinessDate, jakartaTime, leaveDates, maskTail, netPay, periodRange, previousPeriod, toJakartaTime } from '../../src/app/hr/utils/hr';

const E1 = '0190a1b2-0000-7000-8000-0000000000e1';
const E2 = '0190a1b2-0000-7000-8000-0000000000e2';
const E3 = '0190a1b2-0000-7000-8000-0000000000e3';
const ANNUAL = '0190a1b2-0000-7000-8000-0000000000a1';
const SICK = '0190a1b2-0000-7000-8000-0000000000a2';
const ORG = 'org-sales';
const OTHER_ORG = 'org-other';
const scope: THrScope = { organizationId: ORG, all: false };

let staff: TEmployeeSelect[];
let banks: Map<string, TBankAccountSelect>;
let types: TLeaveTypeSelect[];
let leaves: TLeaveRequestSelect[];
let overtime: TOvertimeSelect[];
let attendance: TAttendanceSelect[];
let salaries: TSalarySummarySelect[];

/** Jakarta midnight of a business date, as ERP-0034 stores dates. */
const day = (value: string) => new Date(`${value}T00:00:00+07:00`);

const person = (id: string, code: string, extra: Partial<TEmployeeSelect> = {}) =>
	({
		id,
		organizationId: ORG,
		employeeCode: code,
		fullName: `Person ${code}`,
		nationalId: '3201234567890123',
		employmentStatus: 'active',
		hireDate: day('2025-01-01'),
		terminationDate: null,
		userId: null,
		deletedAt: null,
		...extra,
	}) as TEmployeeSelect;

const visible = (employee: TEmployeeSelect, scoped: THrScope) =>
	scoped.all || employee.organizationId === null || employee.organizationId === scoped.organizationId;

const peopleRepository: IHrPeopleRepository = {
	findVisible: async (id, scoped) => staff.find((row) => row.id === id && visible(row, scoped)) ?? null,
	listVisible: async (scoped) => staff.filter((row) => visible(row, scoped)),
	findByCodes: async (codes, scoped) => staff.filter((row) => codes.includes(row.employeeCode.toUpperCase()) && visible(row, scoped)),
	findBank: async (employeeId) => banks.get(employeeId) ?? null,
	saveBank: async (employeeId, data) => {
		const row = { ...data, employeeId, id: crypto.randomUUID() } as TBankAccountSelect;
		banks.set(employeeId, row);
		return row;
	},
};

const people = () => new HrPeopleService(peopleRepository);

const upsert = async (rows: TAttendanceUpsert[]) => {
	for (const row of rows) {
		const existing = attendance.find((item) => item.employeeId === row.employeeId && item.attendanceDate === row.attendanceDate);
		if (existing) Object.assign(existing, row);
		else attendance.push({ ...row, id: crypto.randomUUID() } as TAttendanceSelect);
	}
	return rows.length;
};

const inScope = (scoped: THrScope) => (row: { employeeId: string }) => {
	const employee = staff.find((item) => item.id === row.employeeId);
	return !!employee && visible(employee, scoped);
};

function leaveService() {
	return new LeaveService(
		{
			listTypes: async () => types,
			findType: async (id) => types.find((row) => row.id === id) ?? null,
			paginateLeave: async (_query, scoped) => {
				const data = leaves.filter(inScope(scoped));
				return { meta: { page: 1, limit: 20, total: data.length, totalPages: 1 }, data };
			},
			findLeave: async (id) => leaves.find((row) => row.id === id) ?? null,
			createLeave: async (data) => {
				const row = { ...data, id: crypto.randomUUID() } as TLeaveRequestSelect;
				leaves.push(row);
				return row;
			},
			transitionLeave: async (id, from, data) => {
				const row = leaves.find((item) => item.id === id);
				return row && from.includes(row.status) ? Object.assign(row, data) : null;
			},
			usedDays: async (employeeId, typeId, year, excludeId) => {
				const rows = leaves.filter(
					(row) => row.employeeId === employeeId && row.leaveTypeId === typeId && row.startDate.startsWith(String(year)) && row.id !== excludeId,
				);
				const sum = (status: string) => rows.filter((row) => row.status === status).reduce((total, row) => total + row.days, 0);
				return { approved: sum('approved'), pending: sum('submitted') };
			},
			overlapping: async (employeeId, start, end) =>
				leaves.filter(
					(row) => row.employeeId === employeeId && ['submitted', 'approved'].includes(row.status) && row.startDate <= end && row.endDate >= start,
				),
			paginateOvertime: async (_query, scoped) => {
				const data = overtime.filter(inScope(scoped));
				return { meta: { page: 1, limit: 20, total: data.length, totalPages: 1 }, data };
			},
			findOvertime: async (id) => overtime.find((row) => row.id === id) ?? null,
			createOvertime: async (data) => {
				const row = { ...data, id: crypto.randomUUID() } as TOvertimeSelect;
				overtime.push(row);
				return row;
			},
			transitionOvertime: async (id, from, data) => {
				const row = overtime.find((item) => item.id === id);
				return row && from.includes(row.status) ? Object.assign(row, data) : null;
			},
			approvedHours: async () =>
				[E1, E2].map((employeeId) => ({
					employeeId,
					hours: overtime.filter((row) => row.employeeId === employeeId && row.status === 'approved').reduce((sum, row) => sum + Number(row.hours), 0),
				})),
		},
		{
			upsertMany: upsert,
			removeForLeave: async (leaveRequestId) => {
				const before = attendance.length;
				attendance = attendance.filter((row) => row.leaveRequestId !== leaveRequestId);
				return before - attendance.length;
			},
		},
		people(),
		{ run: (work) => work({} as never) },
	);
}

function attendanceService() {
	return new AttendanceService(
		{
			listByDate: async (date) => attendance.filter((row) => row.attendanceDate === date),
			listBetween: async (start, end) => attendance.filter((row) => row.attendanceDate >= start && row.attendanceDate <= end),
			upsertMany: upsert,
			removeForLeave: async () => 0,
		},
		people(),
	);
}

function salaryService() {
	return new SalaryService(
		{
			listPeriod: async (period, scoped) => salaries.filter((row) => row.period === period).filter(inScope(scoped)),
			findById: async (id) => salaries.find((row) => row.id === id) ?? null,
			upsertDraft: async (data) => {
				const existing = salaries.find((row) => row.period === data.period && row.employeeId === data.employeeId);
				if (existing?.status === 'approved') return null;
				if (existing) return Object.assign(existing, data);
				const row = { ...data, id: crypto.randomUUID(), status: 'draft' } as TSalarySummarySelect;
				salaries.push(row);
				return row;
			},
			removeDraft: async (id) => {
				const row = salaries.find((item) => item.id === id && item.status === 'draft');
				if (!row) return false;
				salaries = salaries.filter((item) => item !== row);
				return true;
			},
			approvePeriod: async (period, _actor, scoped) => {
				const drafts = salaries.filter((row) => row.period === period && row.status === 'draft').filter(inScope(scoped));
				for (const row of drafts) row.status = 'approved';
				return drafts.length;
			},
		},
		people(),
		leaveService(),
		{ run: (work) => work({} as never) },
	);
}

const csv = (name: string, text: string) => new File([text], name, { type: 'text/csv' });

beforeEach(() => {
	staff = [person(E1, 'EMP-0001'), person(E2, 'EMP-0002', { organizationId: null }), person(E3, 'EMP-0003', { organizationId: OTHER_ORG })];
	banks = new Map();
	types = [
		{ id: ANNUAL, code: 'ANNUAL', name: 'Cuti tahunan', attendanceStatus: 'leave', usesQuota: true, annualQuotaDays: 12, isActive: true } as TLeaveTypeSelect,
		{ id: SICK, code: 'SICK', name: 'Sakit', attendanceStatus: 'sick', usesQuota: false, annualQuotaDays: 0, isActive: true } as TLeaveTypeSelect,
	];
	leaves = [];
	overtime = [];
	attendance = [];
	salaries = [];
});

describe('HR rules', () => {
	test('leave days skip Sundays; periods, times and masks', () => {
		// 2026-11-07 is a Saturday, 2026-11-08 a Sunday.
		expect(leaveDates('2026-11-06', '2026-11-09')).toEqual(['2026-11-06', '2026-11-07', '2026-11-09']);
		expect(periodRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
		expect([previousPeriod('2026-01'), previousPeriod('2026-11')]).toEqual(['2025-12', '2026-10']);
		expect(toJakartaTime(jakartaTime('2026-11-06', '08:30'))).toBe('08:30');
		expect(netPay({ baseSalary: 100, allowances: 20, overtimePay: 5, bonus: 10, deductions: 15 })).toBe(120);
		expect(maskTail('3201234567890123')).toBe('••••••••••••0123');
		expect([isBusinessDate('2026-02-28'), isBusinessDate('2026-11-31'), isBusinessDate('2026-2-1')]).toEqual([true, false, false]);
	});

	test('an employee works from the hire date until the termination date', () => {
		const leaving = person(E1, 'X', { employmentStatus: 'terminated', terminationDate: day('2026-11-10') });
		expect([worksOn(leaving, '2026-11-09'), worksOn(leaving, '2026-11-10')]).toEqual([true, false]);
		expect(worksOn(person(E1, 'X', { hireDate: day('2026-12-01') }), '2026-11-30')).toBe(false);
	});
});

describe('employee scope and bank account', () => {
	test('records reach company-level and own-organization employees only; an admin sees all', async () => {
		expect((await people().listActive(scope)).map((row) => row.employeeCode)).toEqual(['EMP-0001', 'EMP-0002']);
		await expect(people().require(scope, E3)).rejects.toBeInstanceOf(HrNotFoundError);
		expect((await people().require({ organizationId: ORG, all: true }, E3)).id).toBe(E3);
		await expect(
			leaveService().createLeave(scope, 'hr', leaveBodySchema.parse({ employeeId: E3, leaveTypeId: SICK, startDate: '2026-11-09', endDate: '2026-11-09' })),
		).rejects.toBeInstanceOf(HrNotFoundError);
	});

	test('the bank account number is masked without employee:read_private', async () => {
		const ctx = { actorUserId: 'hr', scope, canReadPrivate: true };
		await people().saveBank(ctx, E1, { bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'Person' });
		expect(await people().bank({ ...ctx, canReadPrivate: false }, E1)).toMatchObject({ accountNumber: '••••••7890', masked: true });
		expect((await people().bank(ctx, E1))?.accountNumber).toBe('1234567890');
	});

	test('ERP-0034 employee reads mask the NIK without employee:read_private and never write it back', async () => {
		const updates: Record<string, unknown>[] = [];
		const service = new EmployeeService(
			{
				findById: async (id: string) => staff.find((row) => row.id === id) ?? null,
				list: async () => ({ meta: { page: 1, limit: 20, total: 1, totalPages: 1 }, data: [staff[0]!] }),
				codeTaken: async () => false,
				managerExists: async () => true,
				update: async (_id: string, patch: Record<string, unknown>) => {
					updates.push(patch);
					return staff[0]!;
				},
			} as never,
			{} as never,
			{} as never,
		);
		const base = { actor: { userId: 'u', email: 'u@x' }, organizationId: ORG, isPlatformAdmin: false, canManage: true };
		expect((await service.get({ ...base, canReadPrivate: false }, E1)).nationalId).toBe('••••••••••••0123');
		expect((await service.list({ ...base, canReadPrivate: false }, { page: 1, limit: 20 } as never)).data[0]!.nationalId).toBe('••••••••••••0123');
		expect((await service.get({ ...base, canReadPrivate: true }, E1)).nationalId).toBe('3201234567890123');
		await service.update({ ...base, canReadPrivate: false }, E1, { fullName: 'Renamed', nationalId: '••••••••••••0123' } as never);
		expect(updates[0]).toMatchObject({ fullName: 'Renamed' });
		expect(updates[0]).not.toHaveProperty('nationalId');
	});

	test('an employee who is not active cannot get new records', async () => {
		staff[0]!.employmentStatus = 'inactive';
		await expect(people().requireActive(scope, E1)).rejects.toBeInstanceOf(EmployeeStateError);
	});
});

describe('leave', () => {
	const record = (extra: Record<string, unknown>) =>
		leaveService().createLeave(scope, 'hr', leaveBodySchema.parse({ employeeId: E1, leaveTypeId: ANNUAL, startDate: '2026-11-09', endDate: '2026-11-13', ...extra }));

	test('quota counts approved and pending days; overlap is refused', async () => {
		const first = await record({});
		expect(first.days).toBe(5);
		await expect(record({ startDate: '2026-11-12', endDate: '2026-11-12' })).rejects.toMatchObject({ key: 'hr.leave.overlap' });
		await record({ startDate: '2026-12-01', endDate: '2026-12-05' }); // 5 more, 2 left
		await expect(record({ startDate: '2026-12-14', endDate: '2026-12-16' })).rejects.toMatchObject({ key: 'hr.leave.quota', params: { remaining: 2, requested: 3 } });
		// Sick leave has no quota.
		expect((await record({ leaveTypeId: SICK, startDate: '2026-12-21', endDate: '2026-12-26' })).days).toBe(6);
		const [balance] = await leaveService().balances(scope, E1, 2026);
		expect(balance).toMatchObject({ approved: 0, pending: 10, remaining: 2 });
	});

	test('only someone else decides; approval writes attendance, cancelling removes it', async () => {
		const leave = await record({ startDate: '2026-11-07', endDate: '2026-11-09' });
		await expect(leaveService().approveLeave(scope, 'hr', leave.id, null)).rejects.toBeInstanceOf(SelfDecisionError);
		const approved = await leaveService().approveLeave(scope, 'owner', leave.id, 'OK');
		expect(approved).toMatchObject({ status: 'approved', decidedBy: 'owner', employee: { employeeCode: 'EMP-0001' } });
		expect(attendance.map((row) => [row.attendanceDate, row.status, row.source])).toEqual([
			['2026-11-07', 'leave', 'leave'],
			['2026-11-09', 'leave', 'leave'],
		]);
		await leaveService().cancelLeave(scope, 'hr', leave.id, 'Dibatalkan');
		expect(attendance).toHaveLength(0);
		expect(leaves[0]!.status).toBe('cancelled');
	});

	test('a request of an employee outside the scope cannot be decided or listed', async () => {
		const leave = await leaveService().createLeave(
			{ organizationId: OTHER_ORG, all: false },
			'hr',
			leaveBodySchema.parse({ employeeId: E3, leaveTypeId: SICK, startDate: '2026-11-09', endDate: '2026-11-09' }),
		);
		await expect(leaveService().approveLeave(scope, 'owner', leave.id, null)).rejects.toBeInstanceOf(HrNotFoundError);
		expect((await leaveService().listLeave(scope, { page: 1, limit: 20 })).data).toHaveLength(0);
	});

	test('a weekend-only range has no working day', async () => {
		await expect(record({ startDate: '2026-11-08', endDate: '2026-11-08' })).rejects.toBeInstanceOf(LeaveInvalidError);
	});

	test('overtime: recorded, decided by someone else, hours summed for the month', async () => {
		const service = leaveService();
		const row = await service.createOvertime(scope, 'hr', { employeeId: E1, workDate: '2026-11-05', hours: 2.5, reason: null });
		expect(row.hours).toBe('2.50');
		await expect(service.approveOvertime(scope, 'hr', row.id, null)).rejects.toBeInstanceOf(SelfDecisionError);
		await service.approveOvertime(scope, 'owner', row.id, null);
		expect((await service.approvedHours('2026-11')).find((item) => item.employeeId === E1)?.hours).toBe(2.5);
	});
});

describe('attendance', () => {
	test('the day sheet saves manual rows but keeps leave days, for visible employees', async () => {
		attendance.push({ id: 'x', employeeId: E2, attendanceDate: '2026-11-06', status: 'leave', source: 'leave', leaveRequestId: 'l' } as TAttendanceSelect);
		const result = await attendanceService().saveDay(scope, 'hr', '2026-11-06', [
			{ employeeId: E1, status: 'present', checkIn: '08:00', checkOut: '17:00', notes: null },
			{ employeeId: E2, status: 'absent', checkIn: null, checkOut: null, notes: null },
		]);
		expect(result).toEqual({ saved: 1, skipped: 1 });
		expect(attendance.find((row) => row.employeeId === E2)?.status).toBe('leave');
		const sheet = await attendanceService().day(scope, '2026-11-06');
		expect(sheet.map((row) => row.employee.employeeCode)).toEqual(['EMP-0001', 'EMP-0002']);
		expect(sheet.find((row) => row.employee.id === E1)?.record).toMatchObject({ status: 'present', checkIn: '08:00', checkOut: '17:00' });
		await expect(
			attendanceService().saveDay(scope, 'hr', '2026-11-06', [{ employeeId: E3, status: 'present', checkIn: null, checkOut: null, notes: null }]),
		).rejects.toBeInstanceOf(HrNotFoundError);
	});

	test('an import with one bad row imports nothing and reports every problem by row', async () => {
		const bad = csv(
			'absen.csv',
			'kode_karyawan,tanggal,status,jam_masuk,jam_pulang,catatan\nEMP-0001,2026-11-02,hadir,08:00,17:00,\nEMP-0003,2026-11-02,hadir,,,\nEMP-0002,2026-13-40,terbang,9,,\n',
		);
		const result = await attendanceService().import(scope, 'hr', bad);
		expect(result.imported).toBe(0);
		// EMP-0003 belongs to another organization: unknown to this caller.
		expect(result.errors.map((error) => [error.row, error.code])).toEqual([
			[3, 'employeeUnknown'],
			[4, 'dateInvalid'],
			[4, 'statusInvalid'],
			[4, 'timeInvalid'],
		]);
		expect(attendance).toHaveLength(0);
		const good = csv('absen.csv', 'kode;tanggal;status;masuk;pulang;catatan\nEMP-0001;2026-11-02;Hadir;08:00;17:00;\nEMP-0002;2026-11-02;sakit;;;Surat dokter\n');
		expect(await attendanceService().import(scope, 'hr', good)).toEqual({ imported: 2, errors: [] });
		expect(attendance.map((row) => [row.status, row.source])).toEqual([
			['present', 'import'],
			['sick', 'import'],
		]);
	});

	test('a code used in two visible organizations is reported, not guessed', async () => {
		staff.push(person(crypto.randomUUID(), 'EMP-0001', { organizationId: null }));
		const file = csv('absen.csv', 'kode;tanggal;status;masuk;pulang;catatan\nEMP-0001;2026-11-02;hadir;;;\n');
		expect((await attendanceService().import(scope, 'hr', file)).errors).toEqual([{ row: 2, code: 'employeeAmbiguous', value: 'EMP-0001' }]);
	});
});

describe('salary summaries', () => {
	test('net pay is computed; generate copies last month; approval locks the period', async () => {
		const service = salaryService();
		salaries.push({ id: 'prev', period: '2026-10', employeeId: E2, employeeName: 'Person EMP-0002', baseSalary: 4_000_000_00, allowances: 300_000_00, status: 'approved' } as TSalarySummarySelect);
		const saved = await service.save(scope, 'hr', salaryBodySchema.parse({ period: '2026-11', employeeId: E1, baseSalary: 5_000_000_00, allowances: 500_000_00, deductions: 100_000_00 }));
		expect(saved.netPay).toBe(5_400_000_00);
		await expect(
			service.save(scope, 'hr', salaryBodySchema.parse({ period: '2026-11', employeeId: E1, baseSalary: 0, deductions: 1 })),
		).rejects.toMatchObject({ key: 'hr.salary.netNegative' });
		const generated = await service.generate(scope, 'hr', '2026-11');
		// E3 is outside the scope; E2 gets last month's base and allowances.
		expect(generated.rows.map((row) => row.employeeId).sort()).toEqual([E1, E2].sort());
		expect(generated.rows.find((row) => row.employeeId === E2)).toMatchObject({ baseSalary: 4_000_000_00, allowances: 300_000_00, netPay: 4_300_000_00 });
		expect((await service.approve(scope, 'owner', '2026-11')).state).toBe('approved');
		await expect(service.approve(scope, 'owner', '2026-11')).rejects.toBeInstanceOf(SalaryStateError);
		await expect(service.save(scope, 'hr', salaryBodySchema.parse({ period: '2026-11', employeeId: E1, baseSalary: 1 }))).rejects.toMatchObject({ key: 'hr.salary.locked' });
	});

	test('import reads rupiah, all rows or none', async () => {
		const service = salaryService();
		const bad = csv('gaji.csv', 'kode,pokok,tunjangan,lembur,bonus,potongan,catatan\nEMP-0001,5.000.000,500000,0,0,0,\nEMP-0002,abc,0,0,0,0,\n');
		expect((await service.import(scope, 'hr', '2026-11', bad)).errors).toEqual([{ row: 3, code: 'amountInvalid', value: 'abc' }]);
		expect(salaries).toHaveLength(0);
		const good = csv('gaji.csv', 'kode,pokok,tunjangan,lembur,bonus,potongan,catatan\nEMP-0001,5.000.000,500000,250000,0,"100000",Catatan\nEMP-0002,4500000,0,0,1000000,0,\n');
		expect(await service.import(scope, 'hr', '2026-11', good)).toEqual({ imported: 2, errors: [] });
		expect(salaries[0]).toMatchObject({ baseSalary: 5_000_000_00, netPay: 5_650_000_00, notes: 'Catatan' });
	});
});
