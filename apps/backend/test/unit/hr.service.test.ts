/**
 * HR (M08 stage 1): pure rules; employees with private data masked; leave
 * with working days, quota (pending counted), overlap, no self-decision,
 * attendance written on approval and removed on cancel; overtime; the
 * attendance import (all rows or none, errors per row); salary summaries
 * (net computed, locked once approved, import in rupiah).
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	TAttendanceSelect,
	TEmployeeSelect,
	TLeaveRequestSelect,
	TLeaveTypeSelect,
	TOvertimeSelect,
	TSalarySummarySelect,
} from '@drizzle/schemas/hr.schema';
import { leaveBodySchema, salaryBodySchema } from '../../src/app/hr/contracts/hr.contract';
import type { TAttendanceUpsert } from '../../src/app/hr/contracts/hr.repository.interface';
import { EmployeeStateError, LeaveInvalidError, SalaryStateError, SelfDecisionError } from '../../src/app/hr/errors/hr.errors';
import { AttendanceService } from '../../src/app/hr/services/attendance.service';
import { EmployeeService } from '../../src/app/hr/services/employee.service';
import { LeaveService } from '../../src/app/hr/services/leave.service';
import { SalaryService } from '../../src/app/hr/services/salary.service';
import { isBusinessDate, jakartaTime, leaveDates, maskTail, netPay, periodRange, toJakartaTime } from '../../src/app/hr/utils/hr';

const E1 = '0190a1b2-0000-7000-8000-0000000000e1';
const E2 = '0190a1b2-0000-7000-8000-0000000000e2';
const ANNUAL = '0190a1b2-0000-7000-8000-0000000000a1';
const SICK = '0190a1b2-0000-7000-8000-0000000000a2';

let staff: TEmployeeSelect[];
let types: TLeaveTypeSelect[];
let leaves: TLeaveRequestSelect[];
let overtime: TOvertimeSelect[];
let attendance: TAttendanceSelect[];
let salaries: TSalarySummarySelect[];

const person = (id: string, code: string, extra: Partial<TEmployeeSelect> = {}) =>
	({
		id,
		employeeCode: code,
		fullName: `Person ${code}`,
		nationalId: '3201234567890123',
		position: 'Teknisi',
		employmentStatus: 'active',
		inactiveSince: null,
		hireDate: '2025-01-01',
		baseSalary: 5_000_000_00,
		userId: null,
		...extra,
	}) as TEmployeeSelect;

function employeeService() {
	return new EmployeeService(
		{
			paginate: async () => ({ meta: { page: 1, limit: 20, total: staff.length, totalPages: 1 }, data: staff }),
			findById: async (id) => staff.find((row) => row.id === id) ?? null,
			findByCodes: async (codes) => staff.filter((row) => codes.includes(row.employeeCode)),
			listActive: async () => staff.filter((row) => row.employmentStatus === 'active'),
			create: async (data) => {
				const row = { ...data, id: crypto.randomUUID() } as TEmployeeSelect;
				staff.push(row);
				return row;
			},
			update: async (id, data) => Object.assign(staff.find((row) => row.id === id)!, data),
			findBank: async () => ({ bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'Person' }) as never,
			saveBank: async () => ({}) as never,
		},
		{ next: async () => 'EMP-0099' },
		{ getUser: async () => null },
	);
}

const upsert = async (rows: TAttendanceUpsert[]) => {
	for (const row of rows) {
		const existing = attendance.find((item) => item.employeeId === row.employeeId && item.attendanceDate === row.attendanceDate);
		if (existing) Object.assign(existing, row);
		else attendance.push({ ...row, id: crypto.randomUUID() } as TAttendanceSelect);
	}
	return rows.length;
};

function leaveService() {
	return new LeaveService(
		{
			listTypes: async () => types,
			findType: async (id) => types.find((row) => row.id === id) ?? null,
			paginateLeave: async () => ({ meta: { page: 1, limit: 20, total: leaves.length, totalPages: 1 }, data: leaves }),
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
			paginateOvertime: async () => ({ meta: { page: 1, limit: 20, total: overtime.length, totalPages: 1 }, data: overtime }),
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
		employeeService(),
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
		employeeService(),
	);
}

function salaryService() {
	return new SalaryService(
		{
			listPeriod: async (period) => salaries.filter((row) => row.period === period),
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
			approvePeriod: async (period) => {
				const drafts = salaries.filter((row) => row.period === period && row.status === 'draft');
				for (const row of drafts) row.status = 'approved';
				return drafts.length;
			},
		},
		employeeService(),
		leaveService(),
		{ run: (work) => work({} as never) },
	);
}

const csv = (name: string, text: string) => new File([text], name, { type: 'text/csv' });

beforeEach(() => {
	staff = [person(E1, 'EMP-0001'), person(E2, 'EMP-0002')];
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
		expect(toJakartaTime(jakartaTime('2026-11-06', '08:30'))).toBe('08:30');
		expect(netPay({ baseSalary: 100, allowances: 20, overtimePay: 5, bonus: 10, deductions: 15 })).toBe(120);
		expect(maskTail('3201234567890123')).toBe('••••••••••••0123');
		expect([isBusinessDate('2026-02-28'), isBusinessDate('2026-11-31'), isBusinessDate('2026-2-1')]).toEqual([true, false, false]);
	});
});

describe('employees', () => {
	test('private data is masked without employee:read_private, and never written back masked', async () => {
		const service = employeeService();
		const masked = await service.get({ actorUserId: 'u', canReadPrivate: false }, E1);
		expect(masked).toMatchObject({ nationalId: '••••••••••••0123', baseSalary: null, masked: true, bankAccount: { accountNumber: '••••••7890' } });
		await service.update({ actorUserId: 'u', canReadPrivate: false }, E1, {
			fullName: 'Renamed',
			nationalId: '••••••••••••0123',
			position: null,
			email: null,
			phone: null,
			hireDate: null,
			baseSalary: 0,
			userId: null,
			notes: null,
		});
		expect(staff[0]).toMatchObject({ fullName: 'Renamed', nationalId: '3201234567890123', baseSalary: 5_000_000_00 });
		expect((await service.get({ actorUserId: 'u', canReadPrivate: true }, E1)).baseSalary).toBe(5_000_000_00);
	});

	test('an inactive employee cannot get new records', async () => {
		const service = employeeService();
		await service.deactivate({ actorUserId: 'u', canReadPrivate: true }, E2, '2026-11-01');
		await expect(service.requireActive(E2)).rejects.toBeInstanceOf(EmployeeStateError);
	});
});

describe('leave', () => {
	const record = (extra: Record<string, unknown>) =>
		leaveService().createLeave('hr', leaveBodySchema.parse({ employeeId: E1, leaveTypeId: ANNUAL, startDate: '2026-11-09', endDate: '2026-11-13', ...extra }));

	test('quota counts approved and pending days; overlap is refused', async () => {
		const first = await record({});
		expect(first.days).toBe(5);
		await expect(record({ startDate: '2026-11-12', endDate: '2026-11-12' })).rejects.toMatchObject({ key: 'hr.leave.overlap' });
		await record({ startDate: '2026-12-01', endDate: '2026-12-05' }); // 5 more, 2 left
		await expect(record({ startDate: '2026-12-14', endDate: '2026-12-16' })).rejects.toMatchObject({ key: 'hr.leave.quota', params: { remaining: 2, requested: 3 } });
		// Sick leave has no quota.
		expect((await record({ leaveTypeId: SICK, startDate: '2026-12-21', endDate: '2026-12-26' })).days).toBe(6);
		const [balance] = await leaveService().balances(E1, 2026);
		expect(balance).toMatchObject({ approved: 0, pending: 10, remaining: 2 });
	});

	test('only someone else decides; approval writes attendance, cancelling removes it', async () => {
		const leave = await record({ startDate: '2026-11-07', endDate: '2026-11-09' });
		await expect(leaveService().approveLeave('hr', leave.id, null)).rejects.toBeInstanceOf(SelfDecisionError);
		const approved = await leaveService().approveLeave('owner', leave.id, 'OK');
		expect(approved).toMatchObject({ status: 'approved', decidedBy: 'owner' });
		expect(attendance.map((row) => [row.attendanceDate, row.status, row.source])).toEqual([
			['2026-11-07', 'leave', 'leave'],
			['2026-11-09', 'leave', 'leave'],
		]);
		await leaveService().cancelLeave('hr', leave.id, 'Dibatalkan');
		expect(attendance).toHaveLength(0);
		expect(leaves[0]!.status).toBe('cancelled');
	});

	test('a weekend-only range has no working day', async () => {
		await expect(record({ startDate: '2026-11-08', endDate: '2026-11-08' })).rejects.toBeInstanceOf(LeaveInvalidError);
	});

	test('overtime: recorded, decided by someone else, hours summed for the month', async () => {
		const service = leaveService();
		const row = await service.createOvertime('hr', { employeeId: E1, workDate: '2026-11-05', hours: 2.5, reason: null });
		expect(row.hours).toBe('2.50');
		await expect(service.approveOvertime('hr', row.id, null)).rejects.toBeInstanceOf(SelfDecisionError);
		await service.approveOvertime('owner', row.id, null);
		expect((await service.approvedHours('2026-11')).find((item) => item.employeeId === E1)?.hours).toBe(2.5);
	});
});

describe('attendance', () => {
	test('the day sheet saves manual rows but keeps leave days', async () => {
		attendance.push({ id: 'x', employeeId: E2, attendanceDate: '2026-11-06', status: 'leave', source: 'leave', leaveRequestId: 'l' } as TAttendanceSelect);
		const result = await attendanceService().saveDay('hr', '2026-11-06', [
			{ employeeId: E1, status: 'present', checkIn: '08:00', checkOut: '17:00', notes: null },
			{ employeeId: E2, status: 'absent', checkIn: null, checkOut: null, notes: null },
		]);
		expect(result).toEqual({ saved: 1, skipped: 1 });
		expect(attendance.find((row) => row.employeeId === E2)?.status).toBe('leave');
		const day = await attendanceService().day('2026-11-06');
		expect(day.find((row) => row.employee.id === E1)?.record).toMatchObject({ status: 'present', checkIn: '08:00', checkOut: '17:00' });
	});

	test('an import with one bad row imports nothing and reports every problem by row', async () => {
		const bad = csv('absen.csv', 'kode_karyawan,tanggal,status,jam_masuk,jam_pulang,catatan\nEMP-0001,2026-11-02,hadir,08:00,17:00,\nEMP-0009,2026-11-02,hadir,,,\nEMP-0002,2026-13-40,terbang,9,,\n');
		const result = await attendanceService().import('hr', bad);
		expect(result.imported).toBe(0);
		expect(result.errors.map((error) => [error.row, error.code])).toEqual([
			[3, 'employeeUnknown'],
			[4, 'dateInvalid'],
			[4, 'statusInvalid'],
			[4, 'timeInvalid'],
		]);
		expect(attendance).toHaveLength(0);
		const good = csv('absen.csv', 'kode;tanggal;status;masuk;pulang;catatan\nEMP-0001;2026-11-02;Hadir;08:00;17:00;\nEMP-0002;2026-11-02;sakit;;;Surat dokter\n');
		expect(await attendanceService().import('hr', good)).toEqual({ imported: 2, errors: [] });
		expect(attendance.map((row) => [row.status, row.source])).toEqual([
			['present', 'import'],
			['sick', 'import'],
		]);
	});
});

describe('salary summaries', () => {
	test('net pay is computed; approval locks the period', async () => {
		const service = salaryService();
		const saved = await service.save('hr', salaryBodySchema.parse({ period: '2026-11', employeeId: E1, baseSalary: 5_000_000_00, allowances: 500_000_00, deductions: 100_000_00 }));
		expect(saved.netPay).toBe(5_400_000_00);
		await expect(
			service.save('hr', salaryBodySchema.parse({ period: '2026-11', employeeId: E1, baseSalary: 0, deductions: 1 })),
		).rejects.toMatchObject({ key: 'hr.salary.netNegative' });
		const generated = await service.generate('hr', '2026-11');
		expect(generated.rows).toHaveLength(2);
		expect(generated.totals.netPay).toBe(5_400_000_00 + 5_000_000_00);
		expect((await service.approve('owner', '2026-11')).state).toBe('approved');
		await expect(service.approve('owner', '2026-11')).rejects.toBeInstanceOf(SalaryStateError);
		await expect(service.save('hr', salaryBodySchema.parse({ period: '2026-11', employeeId: E1, baseSalary: 1 }))).rejects.toMatchObject({ key: 'hr.salary.locked' });
	});

	test('import reads rupiah, all rows or none', async () => {
		const service = salaryService();
		const bad = csv('gaji.csv', 'kode,pokok,tunjangan,lembur,bonus,potongan,catatan\nEMP-0001,5.000.000,500000,0,0,0,\nEMP-0002,abc,0,0,0,0,\n');
		expect((await service.import('hr', '2026-11', bad)).errors).toEqual([{ row: 3, code: 'amountInvalid', value: 'abc' }]);
		expect(salaries).toHaveLength(0);
		const good = csv('gaji.csv', 'kode,pokok,tunjangan,lembur,bonus,potongan,catatan\nEMP-0001,5.000.000,500000,250000,0,"100000",Catatan\nEMP-0002,4500000,0,0,1000000,0,\n');
		expect(await service.import('hr', '2026-11', good)).toEqual({ imported: 2, errors: [] });
		expect(salaries[0]).toMatchObject({ baseSalary: 5_000_000_00, netPay: 5_650_000_00, notes: 'Catatan' });
	});
});
