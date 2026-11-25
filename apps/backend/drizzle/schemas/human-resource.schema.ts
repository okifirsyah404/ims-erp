/**
 * Human resource module schema — owns the `human_resource` Postgres schema
 * (was `hr`).
 *
 * @remarks
 * Employees, their records, salary data (ADR-0024 Q39: salary stays here) and
 * the employee code series. The organization-structure columns are gone with the
 * `organization` schema (Q4). Money is bigint IDR minor units; business dates are
 * Jakarta `date` strings.
 *
 * `schedules` is built since ERP-0118 and `employee_addresses` since ERP-0121;
 * both were target-only before (Q22).
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { createCodeNumberingTable } from '@shared/numbering/table';
import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	bigint,
	boolean,
	check,
	date,
	index,
	integer,
	numeric,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const humanResourceSchema = pgSchema('human_resource');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

export const EMPLOYMENT_STATUSES = ['active', 'inactive', 'terminated'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const EMPLOYMENT_TYPES = [
	'permanent',
	'contract',
	'probation',
	'internship',
	'outsourced',
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const WORK_TYPES = ['onsite', 'remote', 'hybrid'] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const ATTENDANCE_STATUSES = [
	'present',
	'permit',
	'sick',
	'leave',
	'absent',
	'holiday',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_SOURCES = ['manual', 'import', 'leave'] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];

/** Attendance written for an approved leave of a type. */
export const LEAVE_ATTENDANCE_STATUSES = ['leave', 'sick', 'permit'] as const;
export type LeaveAttendanceStatus =
	(typeof LEAVE_ATTENDANCE_STATUSES)[number];

export const REQUEST_STATUSES = [
	'submitted',
	'approved',
	'rejected',
	'cancelled',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const TASK_STATUSES = ['open', 'done', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SALARY_STATUSES = ['draft', 'approved'] as const;
export type SalaryStatus = (typeof SALARY_STATUSES)[number];

const id = () =>
	uuid('id')
		.primaryKey()
		.default(sql`uuidv7()`);

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * human_resource.employees
 * ------------------------------------------------------------------------ */

/**
 * Employee master.
 *
 * @remarks
 * `organization_id` NULL is a valid company-level employee. `user_id` links the
 * portal login and is not a foreign key; a user is linked to at most one alive
 * employee (partial unique index).
 */
export const employees = humanResourceSchema.table(
	'employees',
	{
		id: id(),
		/** Logical reference to auth.organizations.id — cross-module FK omitted. */
		organizationId: text('organization_id'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		userId: text('user_id'),
		employeeCode: varchar('employee_code', { length: 32 }).notNull(),
		fullName: text('full_name').notNull(),
		nickname: text('nickname'),
		/** National identity number (NIK). */
		nationalId: varchar('national_id', { length: 32 }),
		/** NPWP (ERP-0138); optional. */
		taxId: varchar('tax_id', { length: 32 }),
		/** PTKP status TK/0..K/3 (ERP-0138); NULL counts as TK/0. */
		ptkpStatus: varchar('ptkp_status', { length: 5 }),
		bpjsHealthNumber: varchar('bpjs_health_number', { length: 32 }),
		bpjsEmploymentNumber: varchar('bpjs_employment_number', { length: 32 }),
		email: varchar('email', { length: 320 }),
		phone: varchar('phone', { length: 100 }),
		photoObjectKey: text('photo_object_key'),
		employmentStatus: text('employment_status').notNull().default('active'),
		employmentType: text('employment_type').notNull().default('permanent'),
		workType: text('work_type').notNull().default('onsite'),
		/** Unix milliseconds, not a business date (shipped that way in ERP-0034). */
		hireDate: unixTimestampNullable('hire_date'),
		terminationDate: unixTimestampNullable('termination_date'),
		/** Internal self-reference within the schema — FK allowed. */
		managerEmployeeId: uuid('manager_employee_id').references(
			(): AnyPgColumn => employees.id,
			{ onDelete: 'set null' },
		),
		...timestamps,
	},
	(table) => [
		uniqueIndex('employees_org_code_uq')
			.on(table.organizationId, table.employeeCode)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('employees_user_uq')
			.on(table.userId)
			.where(sql`user_id IS NOT NULL AND deleted_at IS NULL`),
		index('employees_manager_employee_id_idx').on(table.managerEmployeeId),
		index('employees_status_idx').on(table.employmentStatus),
		index('employees_national_id_idx').on(table.nationalId),
		index('employees_org_name_idx').on(table.organizationId, table.fullName),
		check(
			'employees_employment_status_check',
			sql`employment_status IN ('active', 'inactive', 'terminated')`,
		),
		check(
			'employees_employment_type_check',
			sql`employment_type IN ('permanent', 'contract', 'probation', 'internship', 'outsourced')`,
		),
		check(
			'employees_work_type_check',
			sql`work_type IN ('onsite', 'remote', 'hybrid')`,
		),
		check(
			'employees_ptkp_status_check',
			sql`ptkp_status IS NULL OR ptkp_status IN ('TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3')`,
		),
		check(
			'employees_termination_check',
			sql`termination_date IS NULL OR hire_date IS NULL OR termination_date >= hire_date`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * human_resource.attendances (was hr.attendance_records)
 * ------------------------------------------------------------------------ */

export const attendances = humanResourceSchema.table(
	'attendances',
	{
		id: id(),
		employeeId: uuid('employee_id')
			.notNull()
			.references(() => employees.id, { onDelete: 'restrict' }),
		attendanceDate: date('attendance_date').notNull(),
		status: text('status').$type<AttendanceStatus>().notNull(),
		checkInAt: unixTimestampNullable('check_in_at'),
		checkOutAt: unixTimestampNullable('check_out_at'),
		source: text('source')
			.$type<AttendanceSource>()
			.notNull()
			.default('manual'),
		leaveRequestId: uuid('leave_request_id').references(
			() => leaveRequests.id,
			{ onDelete: 'restrict' },
		),
		notes: text('notes'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		recordedBy: text('recorded_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('attendances_day_uq')
			.on(table.employeeId, table.attendanceDate)
			.where(sql`deleted_at IS NULL`),
		index('attendances_date_idx').on(table.attendanceDate),
		index('attendances_leave_request_id_idx').on(table.leaveRequestId),
		check(
			'attendances_status_check',
			sql`status IN ('present', 'permit', 'sick', 'leave', 'absent', 'holiday')`,
		),
		check('attendances_source_check', sql`source IN ('manual', 'import', 'leave')`),
		check(
			'attendances_times_check',
			sql`check_out_at IS NULL OR check_in_at IS NULL OR check_out_at >= check_in_at`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * human_resource.leave_types / leave_requests / overtime_requests
 * ------------------------------------------------------------------------ */

export const leaveTypes = humanResourceSchema.table(
	'leave_types',
	{
		id: id(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		attendanceStatus: text('attendance_status')
			.$type<LeaveAttendanceStatus>()
			.notNull()
			.default('leave'),
		usesQuota: boolean('uses_quota').notNull().default(false),
		annualQuotaDays: integer('annual_quota_days').notNull().default(0),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('leave_types_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		check(
			'leave_types_attendance_status_check',
			sql`attendance_status IN ('leave', 'sick', 'permit')`,
		),
		check('leave_types_quota_check', sql`annual_quota_days >= 0`),
	],
);

export const leaveRequests = humanResourceSchema.table(
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
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		recordedBy: text('recorded_by'),
		decidedBy: text('decided_by'),
		decidedAt: unixTimestampNullable('decided_at'),
		decisionNote: text('decision_note'),
		...timestamps,
	},
	(table) => [
		index('leave_requests_employee_id_idx').on(table.employeeId),
		index('leave_requests_status_idx').on(table.status),
		check(
			'leave_requests_status_check',
			sql`status IN ('submitted', 'approved', 'rejected', 'cancelled')`,
		),
		check('leave_requests_dates_check', sql`end_date >= start_date`),
		check('leave_requests_days_check', sql`days > 0`),
	],
);

export const overtimeRequests = humanResourceSchema.table(
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
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		recordedBy: text('recorded_by'),
		decidedBy: text('decided_by'),
		decidedAt: unixTimestampNullable('decided_at'),
		decisionNote: text('decision_note'),
		...timestamps,
	},
	(table) => [
		index('overtime_requests_employee_id_idx').on(table.employeeId),
		index('overtime_requests_work_date_idx').on(table.workDate),
		check(
			'overtime_requests_status_check',
			sql`status IN ('submitted', 'approved', 'rejected', 'cancelled')`,
		),
		check('overtime_requests_hours_check', sql`hours > 0 AND hours <= 24`),
	],
);

/* ------------------------------------------------------------------------ *
 * human_resource.employee_tasks
 * ------------------------------------------------------------------------ */

export const employeeTasks = humanResourceSchema.table(
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
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		index('employee_tasks_employee_id_idx').on(table.employeeId),
		index('employee_tasks_status_idx').on(table.status),
		check(
			'employee_tasks_status_check',
			sql`status IN ('open', 'done', 'cancelled')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * human_resource.employee_addresses (ERP-0121)
 * ------------------------------------------------------------------------ */

export const EMPLOYEE_ADDRESS_KINDS = ['residence', 'current', 'birth', 'other'] as const;
export type EmployeeAddressKind = (typeof EMPLOYEE_ADDRESS_KINDS)[number];

/**
 * Address of an employee (ADR-0024 Q10 address contract: only `village_id`
 * is stored; district, regency and province come from the location module).
 * The residence address is entered on the invitation claim form.
 */
export const employeeAddresses = humanResourceSchema.table(
	'employee_addresses',
	{
		id: id(),
		employeeId: uuid('employee_id')
			.notNull()
			.references(() => employees.id, { onDelete: 'restrict' }),
		kind: text('kind').$type<EmployeeAddressKind>().notNull().default('residence'),
		addressLine: text('address_line').notNull(),
		/** Logical reference to location.villages.id — cross-module FK omitted. */
		villageId: uuid('village_id'),
		postalCode: varchar('postal_code', { length: 10 }),
		isPrimary: boolean('is_primary').notNull().default(false),
		...timestamps,
	},
	(table) => [
		index('employee_addresses_employee_id_idx').on(table.employeeId),
		uniqueIndex('employee_addresses_primary_uq')
			.on(table.employeeId)
			.where(sql`is_primary AND deleted_at IS NULL`),
		check('employee_addresses_kind_check', sql`kind IN ('residence', 'current', 'birth', 'other')`),
	],
);

/* ------------------------------------------------------------------------ *
 * human_resource.schedules (ERP-0118)
 * ------------------------------------------------------------------------ */

/**
 * Work shift of one employee on one date (ADR-0024 Q20).
 *
 * @remarks
 * Entered per cell or filled from a weekly pattern by HR. A day off has no
 * times; a working day has both, and an end earlier than the start is an
 * overnight shift. One live row per employee and date.
 */
export const schedules = humanResourceSchema.table(
	'schedules',
	{
		id: id(),
		employeeId: uuid('employee_id')
			.notNull()
			.references(() => employees.id, { onDelete: 'restrict' }),
		workDate: date('work_date').notNull(),
		shiftStart: varchar('shift_start', { length: 5 }),
		shiftEnd: varchar('shift_end', { length: 5 }),
		shiftLabel: text('shift_label'),
		isDayOff: boolean('is_day_off').notNull().default(false),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('schedules_employee_date_uq')
			.on(table.employeeId, table.workDate)
			.where(sql`deleted_at IS NULL`),
		index('schedules_work_date_idx').on(table.workDate),
		check(
			'schedules_shift_check',
			sql`(is_day_off AND shift_start IS NULL AND shift_end IS NULL) OR (NOT is_day_off AND shift_start IS NOT NULL AND shift_end IS NOT NULL)`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * human_resource.employee_salaries
 * ------------------------------------------------------------------------ */

/**
 * Effective dated salary agreement of an employee (ADR-0024 Q39).
 *
 * @remarks
 * Base salary and fixed allowances per period. A new period closes the
 * previous one; only the active period is edited and only the latest is
 * deleted. The salary bank account moved to `finance.cash_bank_accounts`
 * (`employee_id`, ERP-0119).
 */
export const employeeSalaries = humanResourceSchema.table(
	'employee_salaries',
	{
		id: id(),
		employeeId: uuid('employee_id')
			.notNull()
			.references(() => employees.id, { onDelete: 'cascade' }),
		baseSalary: bigint('base_salary', { mode: 'number' }).notNull().default(0),
		fixedAllowances: bigint('fixed_allowances', { mode: 'number' })
			.notNull()
			.default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		effectiveFrom: date('effective_from').notNull(),
		effectiveTo: date('effective_to'),
		isActive: boolean('is_active').notNull().default(true),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('employee_salaries_period_uq')
			.on(table.employeeId, table.effectiveFrom)
			.where(sql`deleted_at IS NULL`),
		index('employee_salaries_employee_id_idx').on(table.employeeId),
		check('employee_salaries_base_check', sql`base_salary >= 0`),
		check('employee_salaries_allowances_check', sql`fixed_allowances >= 0`),
		check(
			'employee_salaries_range_check',
			sql`effective_to IS NULL OR effective_to >= effective_from`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * human_resource.employee_salary_records (was hr.salary_summaries)
 * ------------------------------------------------------------------------ */

export const employeeSalaryRecords = humanResourceSchema.table(
	'employee_salary_records',
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
		overtimePay: bigint('overtime_pay', { mode: 'number' })
			.notNull()
			.default(0),
		bonus: bigint('bonus', { mode: 'number' }).notNull().default(0),
		deductions: bigint('deductions', { mode: 'number' }).notNull().default(0),
		/** PPh 21 withheld (ERP-0138); negative only on an annual refund. */
		pph21Amount: bigint('pph21_amount', { mode: 'number' }).notNull().default(0),
		bpjsEmployeeAmount: bigint('bpjs_employee_amount', { mode: 'number' }).notNull().default(0),
		bpjsCompanyAmount: bigint('bpjs_company_amount', { mode: 'number' }).notNull().default(0),
		pensionEmployeeAmount: bigint('pension_employee_amount', { mode: 'number' }).notNull().default(0),
		taxableGross: bigint('taxable_gross', { mode: 'number' }).notNull().default(0),
		ptkpStatus: varchar('ptkp_status', { length: 5 }),
		terRate: numeric('ter_rate', { precision: 7, scale: 4 }),
		taxMethod: text('tax_method').$type<'ter' | 'annual'>(),
		/** Logical reference to finance.journal_entries.id — cross-module FK omitted. */
		journalEntryId: uuid('journal_entry_id'),
		netPay: bigint('net_pay', { mode: 'number' }).notNull(),
		notes: text('notes'),
		status: text('status').$type<SalaryStatus>().notNull().default('draft'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('employee_salary_records_period_uq')
			.on(table.period, table.employeeId)
			.where(sql`deleted_at IS NULL`),
		index('employee_salary_records_period_idx').on(table.period),
		index('employee_salary_records_employee_id_idx').on(table.employeeId),
		check(
			'employee_salary_records_status_check',
			sql`status IN ('draft', 'approved')`,
		),
		check(
			'employee_salary_records_amounts_check',
			sql`base_salary >= 0 AND allowances >= 0 AND overtime_pay >= 0 AND bonus >= 0 AND deductions >= 0`,
		),
		check(
			'employee_salary_records_net_check',
			sql`net_pay = base_salary + allowances + overtime_pay + bonus - deductions - pph21_amount - bpjs_employee_amount`,
		),
		check(
			'employee_salary_records_statutory_check',
			sql`bpjs_employee_amount >= 0 AND bpjs_company_amount >= 0 AND pension_employee_amount >= 0 AND taxable_gross >= 0`,
		),
		check(
			'employee_salary_records_tax_method_check',
			sql`tax_method IS NULL OR tax_method IN ('ter', 'annual')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * human_resource.settings / code_numberings
 * ------------------------------------------------------------------------ */

export const humanResourceSettings = humanResourceSchema.table(
	'settings',
	{
		id: id(),
		settingGroup: text('setting_group').notNull(),
		settingKey: text('setting_key').notNull(),
		settingValue: text('setting_value'),
		valueType: text('value_type').notNull().default('string'),
		description: text('description'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		updatedBy: text('updated_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('human_resource_settings_scope_uq')
			.on(table.settingGroup, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'human_resource_settings_value_type_check',
			sql`value_type IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

export const humanResourceCodeNumberings =
	createCodeNumberingTable(humanResourceSchema);

export type TEmployeeSelect = typeof employees.$inferSelect;
export type TEmployeeInsert = typeof employees.$inferInsert;
export type TAttendanceSelect = typeof attendances.$inferSelect;
export type TAttendanceInsert = typeof attendances.$inferInsert;
export type TLeaveTypeSelect = typeof leaveTypes.$inferSelect;
export type TLeaveTypeInsert = typeof leaveTypes.$inferInsert;
export type TLeaveRequestSelect = typeof leaveRequests.$inferSelect;
export type TLeaveRequestInsert = typeof leaveRequests.$inferInsert;
export type TOvertimeRequestSelect = typeof overtimeRequests.$inferSelect;
export type TOvertimeRequestInsert = typeof overtimeRequests.$inferInsert;
export type TEmployeeTaskSelect = typeof employeeTasks.$inferSelect;
export type TScheduleSelect = typeof schedules.$inferSelect;
export type TEmployeeAddressSelect = typeof employeeAddresses.$inferSelect;
export type TEmployeeAddressInsert = typeof employeeAddresses.$inferInsert;
export type TScheduleInsert = typeof schedules.$inferInsert;
export type TEmployeeTaskInsert = typeof employeeTasks.$inferInsert;
export type TEmployeeSalarySelect = typeof employeeSalaries.$inferSelect;
export type TEmployeeSalaryInsert = typeof employeeSalaries.$inferInsert;
export type TEmployeeSalaryRecordSelect =
	typeof employeeSalaryRecords.$inferSelect;
export type TEmployeeSalaryRecordInsert =
	typeof employeeSalaryRecords.$inferInsert;
export type THumanResourceSettingSelect =
	typeof humanResourceSettings.$inferSelect;
export type THumanResourceSettingInsert =
	typeof humanResourceSettings.$inferInsert;
export type THumanResourceCodeNumberingSelect =
	typeof humanResourceCodeNumberings.$inferSelect;
export type THumanResourceCodeNumberingInsert =
	typeof humanResourceCodeNumberings.$inferInsert;
