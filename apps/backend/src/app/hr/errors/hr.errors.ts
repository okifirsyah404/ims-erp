import { AppError } from '@http/errors';

/** The employee does not exist (or is soft-deleted). */
export class EmployeeNotFoundError extends AppError {
	constructor() {
		super(404, 'hr.employeeNotFound', 'Employee not found');
	}
}

/** The caller may not manage a company-level (organization_id NULL) employee. */
export class CompanyEmployeeForbiddenError extends AppError {
	constructor() {
		super(
			403,
			'hr.companyEmployeeForbidden',
			'Company-level employees are managed by application admins only',
		);
	}
}

/** The email already belongs to a live employee (1 user ↔ 1 employee). */
export class EmployeeEmailTakenError extends AppError {
	constructor() {
		super(
			409,
			'hr.employeeEmailTaken',
			'Another employee already uses this login email',
		);
	}
}

/** The invitation part of the employee creation failed. */
export class EmployeeInviteError extends AppError {
	constructor(message: string) {
		super(422, 'hr.employeeInvite', message);
	}
}

// M08 stage 1 records ------------------------------------------------------

/** The record does not exist. */
export class HrNotFoundError extends AppError {
	constructor(kind: 'employee' | 'leaveType' | 'leave' | 'overtime' | 'task' | 'salary') {
		const messages = {
			employee: 'Employee not found',
			leaveType: 'Leave type not found',
			leave: 'Leave request not found',
			overtime: 'Overtime record not found',
			task: 'Task not found',
			salary: 'Salary summary not found',
		};
		super(404, `hr.notFound.${kind}` as const, messages[kind]);
	}
}

/** The employee is not in the state a new record needs. */
export class EmployeeStateError extends AppError {
	constructor(kind: 'inactive') {
		const messages = { inactive: 'The employee is not active' };
		super(422, `hr.employeeState.${kind}` as const, messages[kind]);
	}
}

/** A leave request does not fit (dates, quota, overlap, type). */
export class LeaveInvalidError extends AppError {
	constructor(kind: 'dates' | 'noWorkingDays' | 'typeInactive' | 'overlap' | 'quota', params?: Record<string, string | number>) {
		const messages = {
			dates: 'The end date is before the start date',
			noWorkingDays: 'The range has no working day (Sundays are not counted)',
			typeInactive: 'This leave type is not active',
			overlap: 'The employee already has leave in these dates',
			quota: 'Not enough leave left this year',
		};
		super(kind === 'overlap' ? 409 : 422, `hr.leave.${kind}` as const, messages[kind], params);
	}
}

/** The request is not in the state the action needs. */
export class RequestStateError extends AppError {
	constructor(action: 'decide' | 'cancel') {
		const messages = {
			decide: 'Only a submitted request can be approved or rejected',
			cancel: 'This request is already rejected or cancelled',
		};
		super(422, `hr.requestState.${action}` as const, messages[action]);
	}
}

/** Whoever recorded a request cannot approve or reject it. */
export class SelfDecisionError extends AppError {
	constructor() {
		super(403, 'hr.selfDecision', 'Someone other than the person who recorded it must decide');
	}
}

/** An approved salary summary is locked; or a period has nothing to approve. */
export class SalaryStateError extends AppError {
	constructor(kind: 'locked' | 'nothingToApprove' | 'netNegative') {
		const messages = {
			locked: 'This salary summary is approved and locked',
			nothingToApprove: 'This period has no draft summary to approve',
			netNegative: 'Deductions are larger than the pay',
		};
		super(kind === 'locked' ? 409 : 422, `hr.salary.${kind}` as const, messages[kind]);
	}
}

/** The uploaded file cannot be read. */
export class ImportFileError extends AppError {
	constructor(kind: 'type' | 'size' | 'empty' | 'tooMany') {
		const messages = {
			type: 'Upload an .xlsx or .csv file',
			size: 'The file is larger than 2 MB',
			empty: 'The file has no data rows',
			tooMany: 'The file has more than 2000 rows',
		};
		super(422, `hr.import.${kind}` as const, messages[kind]);
	}
}

/** The check-out time is before the check-in time. */
export class AttendanceTimeError extends AppError {
	constructor() {
		super(422, 'hr.attendanceTimes', 'The check-out time is before the check-in time');
	}
}
