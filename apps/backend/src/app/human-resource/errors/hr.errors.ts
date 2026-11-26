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
	constructor(kind: 'employee' | 'leaveType' | 'leave' | 'overtime' | 'task' | 'salary' | 'attendance' | 'schedule' | 'salaryPeriod' | 'document') {
		const messages = {
			document: 'Employee document not found',
			salaryPeriod: 'Salary period not found',
			schedule: 'Schedule not found',
			attendance: 'Attendance record not found',
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
	constructor(action: 'decide' | 'cancel' | 'edit') {
		const messages = {
			decide: 'Only a submitted request can be approved or rejected',
			edit: 'Only a submitted request can be edited',
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

/** A single attendance row cannot be written as asked. */
export class AttendanceStateError extends AppError {
	constructor(
		kind:
			| 'leaveOwned'
			| 'duplicate'
			| 'notActive'
			| 'alreadyCheckedIn'
			| 'alreadyCheckedOut'
			| 'notCheckedIn',
	) {
		const messages = {
			leaveOwned: 'This day was written by an approved leave request; cancel the leave instead',
			duplicate: 'The employee already has an attendance record on this date',
			notActive: 'The employee is not active',
			alreadyCheckedIn: 'You have already checked in today',
			alreadyCheckedOut: 'You have already checked out today',
			notCheckedIn: 'Check in before checking out',
		};
		const conflict = kind === 'duplicate' || kind === 'alreadyCheckedIn' || kind === 'alreadyCheckedOut';
		super(conflict ? 409 : 422, `hr.attendance.${kind}` as const, messages[kind]);
	}
}

/** A schedule cell cannot be written as asked (ERP-0118). */
export class ScheduleError extends AppError {
	constructor(kind: 'duplicate' | 'rangeTooLong', params?: Record<string, string | number>) {
		const messages = {
			duplicate: 'The employee already has a schedule on this date',
			rangeTooLong: 'A fill covers at most {{max}} days',
		};
		super(kind === 'duplicate' ? 409 : 422, `hr.schedule.${kind}` as const, messages[kind], params);
	}
}

/** A salary period cannot be written as asked (ERP-0119). */
export class SalaryPeriodError extends AppError {
	constructor(kind: 'overlap' | 'notActive' | 'notLatest', params?: Record<string, string | number>) {
		const messages = {
			overlap: 'A new period must start after {{after}}',
			notActive: 'Only the active salary period can be edited',
			notLatest: 'Only the latest salary period can be deleted',
		};
		super(422, `hr.salaryPeriod.${kind}` as const, messages[kind], params);
	}
}

/** The employee document cannot do what was asked (ERP-0121). */
export class EmployeeDocumentError extends AppError {
	constructor(kind: 'notAgreement') {
		const messages = { notAgreement: 'Only a live employment agreement has a generated PDF' };
		super(422, `hr.employeeDocument.${kind}` as const, messages[kind]);
	}
}

/** The payslip cannot be served yet (ERP-0122). */
export class PayslipError extends AppError {
	constructor(kind: 'notReady' | 'notApproved') {
		const messages = {
			notReady: 'The payslip PDF is not ready yet',
			notApproved: 'Only an approved salary record has a payslip',
		};
		super(kind === 'notReady' ? 409 : 422, `hr.payslip.${kind}` as const, messages[kind]);
	}
}

/** PPh 21 / BPJS cannot be calculated or exported (ERP-0138). */
export class PayrollStatutoryError extends AppError {
	constructor(
		kind:
			| 'pensionWageCapMissing'
			| 'ptkpMissing'
			| 'bracketsMissing'
			| 'terMissing'
			| 'bp21IdentityMissing'
			| 'bp21AnnualUnsupported'
			| 'bp21NothingToExport',
		params?: Record<string, string | number>,
	) {
		const messages = {
			pensionWageCapMissing: 'Enter the JP wage cap in the payroll settings before calculating BPJS Ketenagakerjaan',
			ptkpMissing: 'No PTKP table is in force for this month',
			bracketsMissing: 'No Pasal 17 table is in force for this month',
			terMissing: 'No TER table is in force for this month; import it under Finance > Tax > PPh 21 tables',
			bp21IdentityMissing: 'Employees without NIK or NPWP block the BP21 export',
			bp21AnnualUnsupported: 'The last tax month is reported on the annual slip, which this export does not build',
			bp21NothingToExport: 'This period has no approved record with PPh 21',
		};
		super(422, `hr.payroll.${kind}` as const, messages[kind], params);
	}
}
