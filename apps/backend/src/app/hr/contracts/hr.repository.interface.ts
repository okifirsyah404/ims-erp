import type {
	TAttendanceInsert,
	TAttendanceSelect,
	TBankAccountSelect,
	TEmployeeInsert,
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
import type { TBankAccountBody, TEmployeeListQuery, TRequestListQuery, TTaskListQuery } from './hr.contract';

type TNew<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** Persistence port of `hr.employees` and `hr.bank_accounts` (live rows). */
export interface IEmployeeRepository {
	paginate(query: TEmployeeListQuery): Promise<TPaginationResult<TEmployeeSelect>>;
	findById(id: string): Promise<TEmployeeSelect | null>;
	findByCodes(codes: string[]): Promise<TEmployeeSelect[]>;
	listActive(): Promise<TEmployeeSelect[]>;
	create(data: TNew<TEmployeeInsert>): Promise<TEmployeeSelect>;
	update(id: string, data: Partial<TEmployeeInsert>): Promise<TEmployeeSelect | null>;
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

	paginateLeave(query: TRequestListQuery): Promise<TPaginationResult<TLeaveRequestSelect>>;
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

	paginateOvertime(query: TRequestListQuery): Promise<TPaginationResult<TOvertimeSelect>>;
	findOvertime(id: string): Promise<TOvertimeSelect | null>;
	createOvertime(data: TNew<TOvertimeInsert>): Promise<TOvertimeSelect>;
	transitionOvertime(id: string, from: TOvertimeSelect['status'][], data: Partial<TOvertimeInsert>): Promise<TOvertimeSelect | null>;
	/** Approved overtime hours per employee in a date range. */
	approvedHours(start: string, end: string): Promise<{ employeeId: string; hours: number }[]>;
}

/** Persistence port of `hr.employee_tasks`. */
export interface ITaskRepository {
	paginate(query: TTaskListQuery): Promise<TPaginationResult<TEmployeeTaskSelect>>;
	findById(id: string): Promise<TEmployeeTaskSelect | null>;
	create(data: TNew<TEmployeeTaskInsert>): Promise<TEmployeeTaskSelect>;
	update(id: string, data: Partial<TEmployeeTaskInsert>): Promise<TEmployeeTaskSelect | null>;
}

/** Persistence port of `hr.salary_summaries`. */
export interface ISalaryRepository {
	listPeriod(period: string): Promise<TSalarySummarySelect[]>;
	findById(id: string): Promise<TSalarySummarySelect | null>;
	/** Inserts or replaces the draft of (period, employee); `null` = it is approved. */
	upsertDraft(data: TNew<TSalarySummaryInsert>, tx?: TTx): Promise<TSalarySummarySelect | null>;
	removeDraft(id: string): Promise<boolean>;
	/** Approves every draft of a period; returns how many. */
	approvePeriod(period: string, actorUserId: string): Promise<number>;
}
