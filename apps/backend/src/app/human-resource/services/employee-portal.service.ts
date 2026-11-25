import type {
	TAttendanceSelect,
	TEmployeeSelect,
	TaskStatus,
} from '@drizzle/schemas/human-resource.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { businessDateOf } from '@utils/business-date.util';
import { inject, injectable } from 'tsyringe';
import type {
	IEmployeePortalResolver,
	TPortalOrganization,
} from '@authorization/employee-portal-resolver';
import { EMPLOYEE_PORTAL_RESOLVER_TOKEN } from '@authorization/employee-portal-resolver';
import {
	ATTENDANCE_REPOSITORY_TOKEN,
	EMPLOYEE_ADDRESS_REPOSITORY_TOKEN,
	EMPLOYEE_REPOSITORY_TOKEN,
	LEAVE_REPOSITORY_TOKEN,
	LEAVE_SERVICE_TOKEN,
	SCHEDULE_REPOSITORY_TOKEN,
	TASK_REPOSITORY_TOKEN,
} from '../constants/di';
import type { THrScope } from '../contracts/hr-records.contract';
import type {
	TMyLeaveBody,
	TMyLeaveListQuery,
	TMyOvertimeBody,
	TMyOvertimeListQuery,
	TMyProfileUpdate,
	TMyTaskListQuery,
} from '../contracts/employee-portal.contract';
import type { IAttendanceRepository, ILeaveRepository, ITaskRepository } from '../contracts/hr-records.repository.interface';
import type { IEmployeeRepository } from '../contracts/employee.repository.interface';
import type { IScheduleRepository } from '../contracts/schedule.repository.interface';
import type { IEmployeeAddressRepository } from '../contracts/employee-document.contract';
import {
	AttendanceStateError,
	HrNotFoundError,
	RequestStateError,
} from '../errors/hr.errors';
import { periodRange, toJakartaTime } from '../utils/hr';
import type { LeaveService, TLeaveBalance, TLeaveView, TOvertimeView } from './leave.service';
import type { TAttendanceMonthRow, TAttendanceView } from './attendance.service';
import type { TScheduleWeek } from './schedule.service';
import type { TTaskView } from './task.service';

/** Today's attendance as the portal's home card needs it. */
export type TMyToday = {
	date: string;
	record: (TAttendanceView & { id: string }) | null;
};

/** The portal identity: who the caller is and where they may use the portal. */
export type TMyPortalContext = {
	employeeId: string;
	employeeCode: string;
	fullName: string;
	organizationId: string;
	organizations: TPortalOrganization[];
};

/** Own-profile projection: editable fields plus the read-only HR facts. */
export type TMyProfile = {
	id: string;
	employeeCode: string;
	fullName: string;
	nickname: string | null;
	email: string | null;
	phone: string | null;
	employmentStatus: string;
	employmentType: string;
	workType: string;
	hireDate: string | null;
	photoUrl: string | null;
	address: { addressLine: string; villageId: string | null; postalCode: string | null } | null;
};

const attendanceView = (record: TAttendanceSelect) => ({
	id: record.id,
	status: record.status,
	checkIn: toJakartaTime(record.checkInAt),
	checkOut: toJakartaTime(record.checkOutAt),
	notes: record.notes,
	source: record.source,
	leaveRequestId: record.leaveRequestId,
});

/**
 * Employee self-service use cases (Phase A: profile, attendance, schedule,
 * leave, overtime, tasks).
 *
 * @remarks
 * Every method takes the employee id resolved by the guard, never one from the
 * request. Reads reuse the existing HR repositories; writes reuse the HR
 * services where they already enforce the business rules (leave quota and
 * overlap, overtime, schedule), after pinning the row to the caller.
 */
@injectable()
export class EmployeePortalService {
	constructor(
		@inject(EMPLOYEE_REPOSITORY_TOKEN) private readonly employees: IEmployeeRepository,
		@inject(ATTENDANCE_REPOSITORY_TOKEN) private readonly attendance: IAttendanceRepository,
		@inject(LEAVE_REPOSITORY_TOKEN) private readonly leave: ILeaveRepository,
		@inject(LEAVE_SERVICE_TOKEN) private readonly leaveService: LeaveService,
		@inject(TASK_REPOSITORY_TOKEN) private readonly tasks: ITaskRepository,
		@inject(SCHEDULE_REPOSITORY_TOKEN) private readonly schedules: IScheduleRepository,
		@inject(EMPLOYEE_ADDRESS_REPOSITORY_TOKEN) private readonly addresses: IEmployeeAddressRepository,
		@inject(EMPLOYEE_PORTAL_RESOLVER_TOKEN) private readonly portal: IEmployeePortalResolver,
	) {}

	private scope(organizationId: string): THrScope {
		return { organizationId, all: false };
	}

	private async employee(employeeId: string): Promise<TEmployeeSelect> {
		const employee = await this.employees.findById(employeeId);
		if (!employee) throw new HrNotFoundError('employee');
		return employee;
	}

	async context(userId: string, employeeId: string, organizationId: string): Promise<TMyPortalContext> {
		const employee = await this.employee(employeeId);
		return {
			employeeId: employee.id,
			employeeCode: employee.employeeCode,
			fullName: employee.fullName,
			organizationId,
			organizations: await this.portal.listOrganizationsForUser(userId),
		};
	}

	// Profile -----------------------------------------------------------------

	async profile(employeeId: string): Promise<TMyProfile> {
		const employee = await this.employee(employeeId);
		const address = await this.addresses.findPrimary(employeeId);
		return {
			id: employee.id,
			employeeCode: employee.employeeCode,
			fullName: employee.fullName,
			nickname: employee.nickname,
			email: employee.email,
			phone: employee.phone,
			employmentStatus: employee.employmentStatus,
			employmentType: employee.employmentType,
			workType: employee.workType,
			hireDate: employee.hireDate ? businessDateOf(employee.hireDate) : null,
			photoUrl: null,
			address: address
				? { addressLine: address.addressLine, villageId: address.villageId, postalCode: address.postalCode }
				: null,
		};
	}

	/**
	 * Updates the whitelisted self-service fields only. NIK, NPWP, BPJS, email,
	 * position, salary and bank stay HR-owned and are not reachable here.
	 */
	async updateProfile(employeeId: string, body: TMyProfileUpdate): Promise<TMyProfile> {
		await this.employee(employeeId);
		await this.employees.update(employeeId, { nickname: body.nickname, phone: body.phone });
		if (body.address) await this.addresses.savePrimaryResidence(employeeId, body.address);
		return this.profile(employeeId);
	}

	// Attendance ---------------------------------------------------------------

	async today(employeeId: string): Promise<TMyToday> {
		const date = businessDateOf();
		const record = await this.attendance.findByDay(employeeId, date);
		return { date, record: record ? attendanceView(record) : null };
	}

	async attendanceMonth(employeeId: string, period: string): Promise<TAttendanceMonthRow> {
		const employee = await this.employee(employeeId);
		const { start, end } = periodRange(period);
		const records = (await this.attendance.listBetween(start, end)).filter(
			(record) => record.employeeId === employeeId,
		);
		const counts = Object.fromEntries(
			['present', 'permit', 'sick', 'leave', 'absent', 'holiday'].map((status) => [status, 0]),
		) as TAttendanceMonthRow['counts'];
		for (const record of records) counts[record.status] += 1;
		return {
			employee: { id: employee.id, employeeCode: employee.employeeCode, fullName: employee.fullName },
			counts,
		};
	}

	async attendanceList(employeeId: string, period?: string): Promise<TPaginationResult<TAttendanceView & { id: string; attendanceDate: string }>> {
		const range = period ? periodRange(period) : null;
		const rows = (await this.attendance.listBetween(range?.start ?? '1970-01-01', range?.end ?? '2999-12-31')).filter(
			(record) => record.employeeId === employeeId,
		);
		const data = rows
			.sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate))
			.map((record) => ({ ...attendanceView(record), attendanceDate: record.attendanceDate }));
		return {
			meta: { page: 1, limit: data.length || 1, total: data.length, totalPages: 1 },
			data,
		};
	}

	/** Self check-in for today; a leave day or a second check-in is refused. */
	async checkIn(employeeId: string, userId: string): Promise<TMyToday> {
		const employee = await this.employee(employeeId);
		if (employee.employmentStatus !== 'active') throw new AttendanceStateError('notActive');
		const date = businessDateOf();
		const existing = await this.attendance.findByDay(employeeId, date);
		if (existing?.source === 'leave') throw new AttendanceStateError('leaveOwned');
		if (existing?.checkInAt) throw new AttendanceStateError('alreadyCheckedIn');
		const now = new Date();
		if (existing) {
			await this.attendance.updateOne(existing.id, {
				status: 'present',
				checkInAt: now,
				source: 'self',
				recordedBy: userId,
			});
		} else {
			await this.attendance.insertOne({
				employeeId,
				attendanceDate: date,
				status: 'present',
				checkInAt: now,
				checkOutAt: null,
				source: 'self',
				leaveRequestId: null,
				notes: null,
				recordedBy: userId,
			});
		}
		return this.today(employeeId);
	}

	/** Self check-out for today; needs a check-in and no earlier check-out. */
	async checkOut(employeeId: string): Promise<TMyToday> {
		const date = businessDateOf();
		const existing = await this.attendance.findByDay(employeeId, date);
		if (!existing || !existing.checkInAt) throw new AttendanceStateError('notCheckedIn');
		if (existing.checkOutAt) throw new AttendanceStateError('alreadyCheckedOut');
		await this.attendance.updateOne(existing.id, { checkOutAt: new Date() });
		return this.today(employeeId);
	}

	// Schedule ----------------------------------------------------------------

	/** The caller's own cells of a seven-day window (the grid, one row). */
	async schedule(employeeId: string, start: string): Promise<TScheduleWeek> {
		const employee = await this.employee(employeeId);
		const dates = Array.from({ length: 7 }, (_, index) => {
			const date = new Date(`${start}T00:00:00Z`);
			date.setUTCDate(date.getUTCDate() + index);
			return date.toISOString().slice(0, 10);
		});
		const rows = (await this.schedules.listBetween(start, dates[6]!, this.scope(employee.organizationId ?? ''))).filter(
			(row) => row.employeeId === employeeId,
		);
		const byDate = new Map(rows.map((row) => [row.workDate, row]));
		return {
			start,
			dates,
			rows: [
				{
					employee: { id: employee.id, employeeCode: employee.employeeCode, fullName: employee.fullName },
					cells: Object.fromEntries(
						dates.map((date) => {
							const row = byDate.get(date);
							return [
								date,
								row
									? {
											id: row.id,
											employeeId: row.employeeId,
											workDate: row.workDate,
											shiftStart: row.shiftStart,
											shiftEnd: row.shiftEnd,
											shiftLabel: row.shiftLabel,
											isDayOff: row.isDayOff,
										}
									: null,
							];
						}),
					),
				},
			],
		};
	}

	// Leave -------------------------------------------------------------------

	listLeaveTypes() {
		return this.leaveService.listTypes();
	}

	async leaveBalances(employeeId: string, organizationId: string): Promise<TLeaveBalance[]> {
		return this.leaveService.balances(this.scope(organizationId), employeeId, new Date().getUTCFullYear());
	}

	async leaveList(employeeId: string, organizationId: string, query: TMyLeaveListQuery): Promise<TPaginationResult<TLeaveView>> {
		return this.leaveService.listLeave(this.scope(organizationId), { ...query, employeeId });
	}

	requestLeave(employeeId: string, organizationId: string, userId: string, body: TMyLeaveBody): Promise<TLeaveView> {
		return this.leaveService.createLeave(this.scope(organizationId), userId, { ...body, employeeId });
	}

	/** Cancels only the caller's own request; someone else's is a 404. */
	async cancelLeave(employeeId: string, organizationId: string, userId: string, id: string): Promise<TLeaveView> {
		const row = await this.leave.findLeave(id);
		if (!row || row.employeeId !== employeeId) throw new HrNotFoundError('leave');
		if (row.status !== 'submitted' && row.status !== 'approved') throw new RequestStateError('cancel');
		return this.leaveService.cancelLeave(this.scope(organizationId), userId, id, null);
	}

	// Overtime ----------------------------------------------------------------

	async overtimeList(employeeId: string, organizationId: string, query: TMyOvertimeListQuery): Promise<TPaginationResult<TOvertimeView>> {
		return this.leaveService.listOvertime(this.scope(organizationId), { ...query, employeeId });
	}

	requestOvertime(employeeId: string, organizationId: string, userId: string, body: TMyOvertimeBody): Promise<TOvertimeView> {
		return this.leaveService.createOvertime(this.scope(organizationId), userId, { ...body, employeeId });
	}

	// Tasks -------------------------------------------------------------------

	async taskList(employeeId: string, organizationId: string, query: TMyTaskListQuery): Promise<TPaginationResult<TTaskView>> {
		const result = await this.tasks.paginate({ ...query, employeeId }, this.scope(organizationId));
		return { meta: result.meta, data: result.data.map((row) => ({ ...row, employee: null })) };
	}

	/** Marks only the caller's own task; someone else's is a 404. */
	async setTaskStatus(employeeId: string, organizationId: string, id: string, status: TaskStatus): Promise<TTaskView> {
		const row = await this.tasks.findById(id);
		if (!row || row.employeeId !== employeeId) throw new HrNotFoundError('task');
		const updated = await this.tasks.update(id, { status, doneAt: status === 'done' ? new Date() : null });
		if (!updated) throw new HrNotFoundError('task');
		return { ...updated, employee: null };
	}
}
