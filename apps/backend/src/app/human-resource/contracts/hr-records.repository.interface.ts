import type {
	TAttendanceInsert,
	TAttendanceSelect,
	TEmployeeSalarySelect,
	TEmployeeSelect,
	TEmployeeTaskInsert,
	TEmployeeTaskSelect,
	TLeaveRequestInsert,
	TLeaveRequestSelect,
	TLeaveTypeSelect,
	TOvertimeRequestInsert,
	TOvertimeRequestSelect,
	TEmployeeSalaryRecordInsert,
	TEmployeeSalaryRecordSelect,
} from '@drizzle/schemas/human-resource.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { TAttendanceListQuery, TEmployeeSalaryBody, THrScope, TRequestListQuery, TTaskListQuery } from './hr-records.contract';

type TNew<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/**
 * Read port over ERP-0034 `hr.employees` for the M08 records, plus
 * `hr.employee_salaries`. Every read is limited to the caller's scope.
 */
export interface IHrPeopleRepository {
	findVisible(id: string, scope: THrScope): Promise<TEmployeeSelect | null>;
	/** Employees that can still have records: active, inactive or terminated (not archived). */
	listVisible(scope: THrScope): Promise<TEmployeeSelect[]>;
	findByCodes(codes: string[], scope: THrScope): Promise<TEmployeeSelect[]>;
	findBank(employeeId: string): Promise<TEmployeeSalarySelect | null>;
	saveBank(employeeId: string, data: TEmployeeSalaryBody): Promise<TEmployeeSalarySelect>;
}

export type TAttendanceUpsert = Omit<TNew<TAttendanceInsert>, 'recordedBy'> & { recordedBy: string | null };

/** Persistence port of `hr.attendance_records`. */
export interface IAttendanceRepository {
	listByDate(date: string): Promise<TAttendanceSelect[]>;
	listBetween(start: string, end: string): Promise<TAttendanceSelect[]>;
	/** Writes one row per (employee, date): inserts or replaces the live one. */
	upsertMany(rows: TAttendanceUpsert[], tx?: TTx): Promise<number>;
	/** Soft deletes the rows a leave request wrote. */
	removeForLeave(leaveRequestId: string, tx: TTx): Promise<number>;
	/** Live rows of the visible employees, newest date first. */
	paginate(query: TAttendanceListQuery, scope: THrScope): Promise<TPaginationResult<TAttendanceSelect>>;
	findById(id: string): Promise<TAttendanceSelect | null>;
	/** The live row of an employee on a date, if any. */
	findByDay(employeeId: string, date: string): Promise<TAttendanceSelect | null>;
	insertOne(row: TAttendanceUpsert): Promise<TAttendanceSelect>;
	updateOne(id: string, data: Partial<TAttendanceUpsert>): Promise<TAttendanceSelect | null>;
	softDelete(id: string): Promise<boolean>;
}

/** Persistence port of leave types, leave requests and overtime. */
export interface ILeaveRepository {
	listTypes(includeInactive: boolean): Promise<TLeaveTypeSelect[]>;
	findType(id: string): Promise<TLeaveTypeSelect | null>;

	paginateLeave(query: TRequestListQuery, scope: THrScope): Promise<TPaginationResult<TLeaveRequestSelect>>;
	findLeave(id: string): Promise<TLeaveRequestSelect | null>;
	createLeave(data: TNew<TLeaveRequestInsert>): Promise<TLeaveRequestSelect>;
	transitionLeave(
		id: string,
		from: TLeaveRequestSelect['status'][],
		data: Partial<TLeaveRequestInsert>,
		tx?: TTx,
	): Promise<TLeaveRequestSelect | null>;
	/** Days of submitted and approved requests of a type starting in a year. */
	usedDays(employeeId: string, leaveTypeId: string, year: number, excludeId?: string): Promise<{ approved: number; pending: number }>;
	/** Live submitted / approved requests of an employee overlapping a range, other than `excludeId`. */
	overlapping(employeeId: string, start: string, end: string, excludeId?: string): Promise<TLeaveRequestSelect[]>;

	paginateOvertime(query: TRequestListQuery, scope: THrScope): Promise<TPaginationResult<TOvertimeRequestSelect>>;
	findOvertime(id: string): Promise<TOvertimeRequestSelect | null>;
	createOvertime(data: TNew<TOvertimeRequestInsert>): Promise<TOvertimeRequestSelect>;
	transitionOvertime(id: string, from: TOvertimeRequestSelect['status'][], data: Partial<TOvertimeRequestInsert>): Promise<TOvertimeRequestSelect | null>;
	/** Approved overtime hours per employee in a date range. */
	approvedHours(start: string, end: string): Promise<{ employeeId: string; hours: number }[]>;
}

/** Persistence port of `hr.employee_tasks`. */
export interface ITaskRepository {
	paginate(query: TTaskListQuery, scope: THrScope): Promise<TPaginationResult<TEmployeeTaskSelect>>;
	findById(id: string): Promise<TEmployeeTaskSelect | null>;
	create(data: TNew<TEmployeeTaskInsert>): Promise<TEmployeeTaskSelect>;
	update(id: string, data: Partial<TEmployeeTaskInsert>): Promise<TEmployeeTaskSelect | null>;
	softDelete(id: string): Promise<boolean>;
}

/** Persistence port of `hr.salary_summaries`. */
export interface ISalaryRepository {
	listPeriod(period: string, scope: THrScope): Promise<TEmployeeSalaryRecordSelect[]>;
	findById(id: string): Promise<TEmployeeSalaryRecordSelect | null>;
	/** Inserts or replaces the draft of (period, employee); `null` = it is approved. */
	upsertDraft(data: TNew<TEmployeeSalaryRecordInsert>, tx?: TTx): Promise<TEmployeeSalaryRecordSelect | null>;
	removeDraft(id: string): Promise<boolean>;
	/** Approves every draft of a period; returns how many. */
	approvePeriod(period: string, actorUserId: string, scope: THrScope): Promise<number>;
}
