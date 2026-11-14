import type {
	TAttendanceInsert,
	TAttendanceSelect,
	TBankAccountSelect,
	TEmployeeSelect,
	TEmployeeTaskInsert,
	TEmployeeTaskSelect,
	TLeaveRequestInsert,
	TLeaveRequestSelect,
	TLeaveTypeSelect,
	TOvertimeInsert,
	TOvertimeSelect,
	TSalarySummaryInsert,
	TSalarySummarySelect,
} from '@drizzle/schemas/hr.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { TBankAccountBody, THrScope, TRequestListQuery, TTaskListQuery } from './hr-records.contract';

type TNew<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/**
 * Read port over ERP-0034 `hr.employees` for the M08 records, plus
 * `hr.bank_accounts`. Every read is limited to the caller's scope.
 */
export interface IHrPeopleRepository {
	findVisible(id: string, scope: THrScope): Promise<TEmployeeSelect | null>;
	/** Employees that can still have records: active, inactive or terminated (not archived). */
	listVisible(scope: THrScope): Promise<TEmployeeSelect[]>;
	findByCodes(codes: string[], scope: THrScope): Promise<TEmployeeSelect[]>;
	findBank(employeeId: string): Promise<TBankAccountSelect | null>;
	saveBank(employeeId: string, data: TBankAccountBody): Promise<TBankAccountSelect>;
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
	/** Live submitted / approved requests of an employee overlapping a range. */
	overlapping(employeeId: string, start: string, end: string): Promise<TLeaveRequestSelect[]>;

	paginateOvertime(query: TRequestListQuery, scope: THrScope): Promise<TPaginationResult<TOvertimeSelect>>;
	findOvertime(id: string): Promise<TOvertimeSelect | null>;
	createOvertime(data: TNew<TOvertimeInsert>): Promise<TOvertimeSelect>;
	transitionOvertime(id: string, from: TOvertimeSelect['status'][], data: Partial<TOvertimeInsert>): Promise<TOvertimeSelect | null>;
	/** Approved overtime hours per employee in a date range. */
	approvedHours(start: string, end: string): Promise<{ employeeId: string; hours: number }[]>;
}

/** Persistence port of `hr.employee_tasks`. */
export interface ITaskRepository {
	paginate(query: TTaskListQuery, scope: THrScope): Promise<TPaginationResult<TEmployeeTaskSelect>>;
	findById(id: string): Promise<TEmployeeTaskSelect | null>;
	create(data: TNew<TEmployeeTaskInsert>): Promise<TEmployeeTaskSelect>;
	update(id: string, data: Partial<TEmployeeTaskInsert>): Promise<TEmployeeTaskSelect | null>;
}

/** Persistence port of `hr.salary_summaries`. */
export interface ISalaryRepository {
	listPeriod(period: string, scope: THrScope): Promise<TSalarySummarySelect[]>;
	findById(id: string): Promise<TSalarySummarySelect | null>;
	/** Inserts or replaces the draft of (period, employee); `null` = it is approved. */
	upsertDraft(data: TNew<TSalarySummaryInsert>, tx?: TTx): Promise<TSalarySummarySelect | null>;
	removeDraft(id: string): Promise<boolean>;
	/** Approves every draft of a period; returns how many. */
	approvePeriod(period: string, actorUserId: string, scope: THrScope): Promise<number>;
}
