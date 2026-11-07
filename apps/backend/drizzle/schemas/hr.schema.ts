/**
 * HR domain schema — owns the `hr` Postgres schema (M08 stage 1: employees,
 * attendance, leave, overtime, tasks and the monthly salary summary).
 *
 * House rules honoured here:
 * - **Company-wide, no `organization_id`** (ADR-0012).
 * - Money is bigint IDR minor units (ADR-0002); business dates are Jakarta
 *   `date` strings; operational timestamps are unix ms.
 * - References to other modules (`auth`) are plain id columns.
 * - Rows are soft deleted; uniqueness is partial on `deleted_at IS NULL`.
 */
import { sql } from 'drizzle-orm';
import { bigint, boolean, check, date, index, integer, numeric, pgSchema, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';

export const hrSchema = pgSchema('hr');

export const EMPLOYMENT_STATUSES = ['active', 'inactive'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const ATTENDANCE_STATUSES = ['present', 'permit', 'sick', 'leave', 'absent', 'holiday'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_SOURCES = ['manual', 'import', 'leave'] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];

/** Attendance written for an approved leave of a type. */
export const LEAVE_ATTENDANCE_STATUSES = ['leave', 'sick', 'permit'] as const;
export type LeaveAttendanceStatus = (typeof LEAVE_ATTENDANCE_STATUSES)[number];

export const REQUEST_STATUSES = ['submitted', 'approved', 'rejected', 'cancelled'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const TASK_STATUSES = ['open', 'done', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SALARY_STATUSES = ['draft', 'approved'] as const;
export type SalaryStatus = (typeof SALARY_STATUSES)[number];

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

const id = () =>
	uuid('id')
		.primaryKey()
		.default(sql`uuidv7()`);

/* ------------------------------------------------------------------------ *
 * hr.employees
 * ------------------------------------------------------------------------ */

export const employees = hrSchema.table(
	'employees',
	{
		id: id(),
		employeeCode: varchar('employee_code', { length: 32 }).notNull(),
		fullName: text('full_name').notNull(),
		/** NIK — personal data, masked without `employee:read_private`. */
		nationalId: varchar('national_id', { length: 32 }),
		position: text('position'),
		email: text('email'),
		phone: varchar('phone', { length: 32 }),
		hireDate: date('hire_date'),
		employmentStatus: text('employment_status').$type<EmploymentStatus>().notNull().default('active'),
		inactiveSince: date('inactive_since'),
		/** Default of the monthly salary summary; `employee:read_private` only. */
		baseSalary: bigint('base_salary', { mode: 'number' }).notNull().default(0),
		/** Logical reference to auth.users.id (optional login). */
		userId: text('user_id'),
		notes: text('notes'),
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('employees_code_uq').on(table.employeeCode).where(sql`deleted_at IS NULL`),
		uniqueIndex('employees_national_id_uq').on(table.nationalId).where(sql`deleted_at IS NULL AND national_id IS NOT NULL`),
		uniqueIndex('employees_user_id_uq').on(table.userId).where(sql`deleted_at IS NULL AND user_id IS NOT NULL`),
		index('employees_status_idx').on(table.employmentStatus),
		index('employees_name_idx').on(table.fullName),
		check('employees_status_check', sql`${table.employmentStatus} IN ('active', 'inactive')`),
		check('employees_base_salary_check', sql`${table.baseSalary} >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * hr.bank_accounts
 * ------------------------------------------------------------------------ */

export const bankAccounts = hrSchema.table(
	'bank_accounts',
	{
		id: id(),
		employeeId: uuid('employee_id')
			.notNull()
			.references(() => employees.id, { onDelete: 'restrict' }),
		bankName: varchar('bank_name', { length: 100 }).notNull(),
		accountNumber: varchar('account_number', { length: 50 }).notNull(),
		accountHolder: varchar('account_holder', { length: 200 }).notNull(),
		...timestamps,
	},
	(table) => [uniqueIndex('bank_accounts_employee_uq').on(table.employeeId).where(sql`deleted_at IS NULL`)],
);

/* ------------------------------------------------------------------------ *
 * hr.leave_types / hr.leave_requests
 * ------------------------------------------------------------------------ */

export const leaveTypes = hrSchema.table(
	'leave_types',
	{
		id: id(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		attendanceStatus: text('attendance_status').$type<LeaveAttendanceStatus>().notNull().default('leave'),
		usesQuota: boolean('uses_quota').notNull().default(false),
		annualQuotaDays: integer('annual_quota_days').notNull().default(0),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('leave_types_code_uq').on(table.code).where(sql`deleted_at IS NULL`),
		check('leave_types_attendance_status_check', sql`${table.attendanceStatus} IN ('leave', 'sick', 'permit')`),
		check('leave_types_quota_check', sql`${table.annualQuotaDays} >= 0`),
	],
);

export const leaveRequests = hrSchema.table(
	'leave_requests',
	{
		id: id(),
		employeeId: uuid('employee_id')
			.notNull()
			.references(() => employees.id, { onDelete: 'restrict' }),
		leaveTypeId: uuid('leave_type_id')
			.notNull()
			.references(() => leaveTypes.id, { onDelete: 'restrict' }),
		startDate: date('start_date').notNull(),
		endDate: date('end_date').notNull(),
		days: integer('days').notNull(),
		reason: text('reason'),
		status: text('status').$type<RequestStatus>().notNull().default('submitted'),
		recordedBy: text('recorded_by').notNull(),
		decidedBy: text('decided_by'),
		decidedAt: unixTimestampNullable('decided_at'),
		decisionNote: text('decision_note'),
		...timestamps,
	},
	(table) => [
		index('leave_requests_employee_id_idx').on(table.employeeId),
		index('leave_requests_status_idx').on(table.status),
		check('leave_requests_status_check', sql`${table.status} IN ('submitted', 'approved', 'rejected', 'cancelled')`),
		check('leave_requests_dates_check', sql`${table.endDate} >= ${table.startDate}`),
		check('leave_requests_days_check', sql`${table.days} > 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * hr.attendance_records
 * ------------------------------------------------------------------------ */

export const attendanceRecords = hrSchema.table(
	'attendance_records',
	{
		id: id(),
		employeeId: uuid('employee_id')
			.notNull()
			.references(() => employees.id, { onDelete: 'restrict' }),
		attendanceDate: date('attendance_date').notNull(),
		status: text('status').$type<AttendanceStatus>().notNull(),
		checkInAt: unixTimestampNullable('check_in_at'),
		checkOutAt: unixTimestampNullable('check_out_at'),
		source: text('source').$type<AttendanceSource>().notNull().default('manual'),
		leaveRequestId: uuid('leave_request_id').references(() => leaveRequests.id, { onDelete: 'restrict' }),
		notes: text('notes'),
		recordedBy: text('recorded_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('attendance_records_day_uq').on(table.employeeId, table.attendanceDate).where(sql`deleted_at IS NULL`),
		index('attendance_records_date_idx').on(table.attendanceDate),
		index('attendance_records_leave_request_id_idx').on(table.leaveRequestId),
		check(
			'attendance_records_status_check',
			sql`${table.status} IN ('present', 'permit', 'sick', 'leave', 'absent', 'holiday')`,
		),
		check('attendance_records_source_check', sql`${table.source} IN ('manual', 'import', 'leave')`),
		check(
			'attendance_records_times_check',
			sql`${table.checkOutAt} IS NULL OR ${table.checkInAt} IS NULL OR ${table.checkOutAt} >= ${table.checkInAt}`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * hr.overtime_requests
 * ------------------------------------------------------------------------ */

export const overtimeRequests = hrSchema.table(
	'overtime_requests',
	{
		id: id(),
		employeeId: uuid('employee_id')
			.notNull()
			.references(() => employees.id, { onDelete: 'restrict' }),
		workDate: date('work_date').notNull(),
		hours: numeric('hours', { precision: 5, scale: 2 }).notNull(),
		reason: text('reason'),
		status: text('status').$type<RequestStatus>().notNull().default('submitted'),
		recordedBy: text('recorded_by').notNull(),
		decidedBy: text('decided_by'),
		decidedAt: unixTimestampNullable('decided_at'),
		decisionNote: text('decision_note'),
		...timestamps,
	},
	(table) => [
		index('overtime_requests_employee_id_idx').on(table.employeeId),
		index('overtime_requests_work_date_idx').on(table.workDate),
		check('overtime_requests_status_check', sql`${table.status} IN ('submitted', 'approved', 'rejected', 'cancelled')`),
		check('overtime_requests_hours_check', sql`${table.hours} > 0 AND ${table.hours} <= 24`),
	],
);

/* ------------------------------------------------------------------------ *
 * hr.employee_tasks
 * ------------------------------------------------------------------------ */

export const employeeTasks = hrSchema.table(
	'employee_tasks',
	{
		id: id(),
		employeeId: uuid('employee_id')
			.notNull()
			.references(() => employees.id, { onDelete: 'restrict' }),
		title: varchar('title', { length: 200 }).notNull(),
		description: text('description'),
		dueDate: date('due_date'),
		status: text('status').$type<TaskStatus>().notNull().default('open'),
		doneAt: unixTimestampNullable('done_at'),
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		index('employee_tasks_employee_id_idx').on(table.employeeId),
		index('employee_tasks_status_idx').on(table.status),
		check('employee_tasks_status_check', sql`${table.status} IN ('open', 'done', 'cancelled')`),
	],
);

/* ------------------------------------------------------------------------ *
 * hr.salary_summaries
 * ------------------------------------------------------------------------ */

export const salarySummaries = hrSchema.table(
	'salary_summaries',
	{
		id: id(),
		/** `YYYY-MM`. */
		period: varchar('period', { length: 7 }).notNull(),
		employeeId: uuid('employee_id')
			.notNull()
			.references(() => employees.id, { onDelete: 'restrict' }),
		employeeName: text('employee_name').notNull(),
		baseSalary: bigint('base_salary', { mode: 'number' }).notNull().default(0),
		allowances: bigint('allowances', { mode: 'number' }).notNull().default(0),
		overtimePay: bigint('overtime_pay', { mode: 'number' }).notNull().default(0),
		bonus: bigint('bonus', { mode: 'number' }).notNull().default(0),
		deductions: bigint('deductions', { mode: 'number' }).notNull().default(0),
		netPay: bigint('net_pay', { mode: 'number' }).notNull(),
		notes: text('notes'),
		status: text('status').$type<SalaryStatus>().notNull().default('draft'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('salary_summaries_period_employee_uq').on(table.period, table.employeeId).where(sql`deleted_at IS NULL`),
		index('salary_summaries_period_idx').on(table.period),
		index('salary_summaries_employee_id_idx').on(table.employeeId),
		check('salary_summaries_status_check', sql`${table.status} IN ('draft', 'approved')`),
		check(
			'salary_summaries_amounts_check',
			sql`${table.baseSalary} >= 0 AND ${table.allowances} >= 0 AND ${table.overtimePay} >= 0 AND ${table.bonus} >= 0 AND ${table.deductions} >= 0`,
		),
		check(
			'salary_summaries_net_check',
			sql`${table.netPay} = ${table.baseSalary} + ${table.allowances} + ${table.overtimePay} + ${table.bonus} - ${table.deductions}`,
		),
	],
);

export type TEmployeeSelect = typeof employees.$inferSelect;
export type TEmployeeInsert = typeof employees.$inferInsert;
export type TBankAccountSelect = typeof bankAccounts.$inferSelect;
export type TLeaveTypeSelect = typeof leaveTypes.$inferSelect;
export type TLeaveRequestSelect = typeof leaveRequests.$inferSelect;
export type TLeaveRequestInsert = typeof leaveRequests.$inferInsert;
export type TAttendanceSelect = typeof attendanceRecords.$inferSelect;
export type TAttendanceInsert = typeof attendanceRecords.$inferInsert;
export type TOvertimeSelect = typeof overtimeRequests.$inferSelect;
export type TOvertimeInsert = typeof overtimeRequests.$inferInsert;
export type TEmployeeTaskSelect = typeof employeeTasks.$inferSelect;
export type TEmployeeTaskInsert = typeof employeeTasks.$inferInsert;
export type TSalarySummarySelect = typeof salarySummaries.$inferSelect;
export type TSalarySummaryInsert = typeof salarySummaries.$inferInsert;
