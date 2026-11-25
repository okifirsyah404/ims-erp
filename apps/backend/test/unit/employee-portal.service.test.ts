/**
 * Employee portal self-service rules (Phase A).
 *
 * The guard already pins the employee, so what is worth testing here is what
 * the service still has to enforce on its own:
 *
 * 1. Self check-in writes a `self` row and is refused twice (409) or on a
 *    leave day.
 * 2. Check-out needs a check-in first.
 * 3. A task or leave request belonging to another employee is a 404, not a
 *    silent write.
 * 4. The profile update touches the whitelisted fields only.
 */
import { describe, expect, test } from 'bun:test';
import type { TAttendanceSelect, TEmployeeSelect } from '@drizzle/schemas/human-resource.schema';
import { EmployeePortalService } from '../../src/app/human-resource/services/employee-portal.service';
import { AttendanceStateError, HrNotFoundError } from '../../src/app/human-resource/errors/hr.errors';

const employee = {
	id: '11111111-1111-1111-1111-111111111111',
	organizationId: '22222222-2222-2222-2222-222222222222',
	employeeCode: 'EMP-0001',
	fullName: 'Budi',
	nickname: null,
	email: 'budi@example.com',
	phone: null,
	employmentStatus: 'active',
	employmentType: 'permanent',
	workType: 'onsite',
	hireDate: null,
} as unknown as TEmployeeSelect;

function attendance(overrides: Partial<TAttendanceSelect> = {}): TAttendanceSelect {
	return {
		id: 'att-1',
		employeeId: employee.id,
		attendanceDate: '2026-11-25',
		status: 'present',
		checkInAt: null,
		checkOutAt: null,
		source: 'manual',
		leaveRequestId: null,
		notes: null,
		recordedBy: null,
		...overrides,
	} as TAttendanceSelect;
}

function service(options: {
	day?: TAttendanceSelect | null;
	task?: { id: string; employeeId: string } | null;
	leave?: { id: string; employeeId: string; status: string } | null;
} = {}) {
	const writes: { inserted?: unknown; updated?: Record<string, unknown> } = {};
	const profileUpdates: Record<string, unknown>[] = [];
	const instance = new EmployeePortalService(
		{
			findById: async () => employee,
			update: async (_id: string, data: Record<string, unknown>) => {
				profileUpdates.push(data);
				return employee;
			},
		} as never,
		{
			findByDay: async () => options.day ?? null,
			insertOne: async (row: unknown) => {
				writes.inserted = row;
				return attendance(row as Partial<TAttendanceSelect>);
			},
			updateOne: async (_id: string, data: Record<string, unknown>) => {
				writes.updated = data;
				return attendance(data as Partial<TAttendanceSelect>);
			},
			listBetween: async () => [],
		} as never,
		{
			findLeave: async () => options.leave ?? null,
		} as never,
		{
			createLeave: async (_scope: unknown, _actor: string, body: Record<string, unknown>) => body,
			cancelLeave: async () => ({ status: 'cancelled' }),
			listTypes: async () => [],
			balances: async () => [],
			listLeave: async () => ({ meta: {}, data: [] }),
			listOvertime: async () => ({ meta: {}, data: [] }),
			createOvertime: async () => ({}),
		} as never,
		{
			findById: async () => options.task ?? null,
			update: async () => ({ id: 'task-1', employeeId: employee.id, status: 'done', employee: null }),
		} as never,
		{ listBetween: async () => [] } as never,
		{ findPrimary: async () => null, savePrimaryResidence: async () => ({}) } as never,
		{ listOrganizationsForUser: async () => [] } as never,
	);
	return { instance, writes, profileUpdates };
}

describe('EmployeePortalService attendance', () => {
	test('check-in writes a self row with a server timestamp', async () => {
		const { instance, writes } = service();
		const result = await instance.checkIn(employee.id, 'user-1');
		expect((writes.inserted as { source: string; recordedBy: string }).source).toBe('self');
		expect((writes.inserted as { recordedBy: string }).recordedBy).toBe('user-1');
		expect((writes.inserted as { checkInAt: Date }).checkInAt).toBeInstanceOf(Date);
		expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	test('a second check-in is refused', async () => {
		const { instance } = service({ day: attendance({ checkInAt: new Date(), source: 'self' }) });
		await expect(instance.checkIn(employee.id, 'user-1')).rejects.toThrow(AttendanceStateError);
	});

	test('a leave day cannot be checked in', async () => {
		const { instance } = service({ day: attendance({ source: 'leave' }) });
		await expect(instance.checkIn(employee.id, 'user-1')).rejects.toThrow(AttendanceStateError);
	});

	test('check-out needs a check-in', async () => {
		const { instance } = service({ day: null });
		await expect(instance.checkOut(employee.id)).rejects.toThrow(AttendanceStateError);
	});

	test('check-out stamps the open row', async () => {
		const { instance, writes } = service({ day: attendance({ checkInAt: new Date() }) });
		await instance.checkOut(employee.id);
		expect((writes.updated as { checkOutAt: Date }).checkOutAt).toBeInstanceOf(Date);
	});
});

describe('EmployeePortalService ownership', () => {
	test("another employee's task is a 404", async () => {
		const { instance } = service({ task: { id: 'task-1', employeeId: 'other' } });
		await expect(instance.setTaskStatus(employee.id, employee.organizationId!, 'task-1', 'done')).rejects.toThrow(
			HrNotFoundError,
		);
	});

	test("another employee's leave is a 404", async () => {
		const { instance } = service({ leave: { id: 'leave-1', employeeId: 'other', status: 'submitted' } });
		await expect(instance.cancelLeave(employee.id, employee.organizationId!, 'user-1', 'leave-1')).rejects.toThrow(
			HrNotFoundError,
		);
	});
});

describe('EmployeePortalService profile', () => {
	test('update writes the whitelisted fields only', async () => {
		const { instance, profileUpdates } = service();
		await instance.updateProfile(employee.id, { nickname: 'Bud', phone: '0812', address: null });
		expect(profileUpdates[0]).toEqual({ nickname: 'Bud', phone: '0812' });
	});
});
