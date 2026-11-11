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
