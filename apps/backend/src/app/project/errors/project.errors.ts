import { AppError } from '@http/errors';

/** The project does not exist or is not visible to the caller. */
export class ProjectNotFoundError extends AppError {
	constructor() {
		super(404, 'projects.notFound', 'Project not found');
	}
}

/** Only an active project changes. */
export class ProjectNotActiveError extends AppError {
	constructor() {
		super(422, 'projects.notActive', 'The project is closed or cancelled');
	}
}

/** The deal is missing, cancelled, or already has a live project. */
export class ProjectDealError extends AppError {
	constructor(kind: 'notFound' | 'taken') {
		const messages = { notFound: 'Active sales order not found', taken: 'This deal already has a project' };
		super(kind === 'taken' ? 409 : 404, `projects.deal.${kind}` as const, messages[kind]);
	}
}

/** The chosen person cannot lead projects or work tasks. */
export class ProjectStaffError extends AppError {
	constructor(kind: 'pic' | 'assignee') {
		const messages = {
			pic: 'The PIC must be a member who can manage projects',
			assignee: 'Tasks can only go to members who can work on tasks',
		};
		super(422, `projects.staff.${kind}` as const, messages[kind]);
	}
}

/** Target end before target start. */
export class ProjectDatesError extends AppError {
	constructor() {
		super(422, 'projects.dates', 'The target end date is before the start date');
	}
}

/** Closing needs the function-test, training and signed-BAST evidence. */
export class ProjectEvidenceMissingError extends AppError {
	constructor(missing: string[]) {
		super(422, 'projects.evidenceMissing', `Closing needs evidence: ${missing.join(', ')}`, { missing: missing.join(', ') });
	}
}

/** A task, evidence file or cost that is not part of this project. */
export class ProjectChildNotFoundError extends AppError {
	constructor(kind: 'task' | 'evidence' | 'cost') {
		super(404, `projects.childNotFound.${kind}` as const, `${kind} not found`);
	}
}

/** Only the assignee (or `task:assign`) moves a task; only the uploader (or a manager) removes a file. */
export class ProjectForbiddenError extends AppError {
	constructor(kind: 'task' | 'evidence' | 'pic') {
		const messages = {
			task: 'Only the assignee or a project manager can update this task',
			evidence: 'Only the uploader or a project manager can remove this file',
			pic: 'Only the project person in charge can do this',
		};
		super(403, `projects.forbidden.${kind}` as const, messages[kind]);
	}
}

/** Not a JPG, PNG, WebP or PDF, empty, or over 15 MB. */
export class ProjectFileError extends AppError {
	constructor(kind: 'type' | 'size' | 'empty') {
		const messages = {
			type: 'Use a JPG, PNG, WebP or PDF file',
			size: 'Each file must be 15 MB or smaller',
			empty: 'The file is empty',
		};
		super(kind === 'size' ? 413 : 422, `projects.file.${kind}` as const, messages[kind]);
	}
}

/** The cost is already voided. */
export class ProjectCostVoidedError extends AppError {
	constructor() {
		super(422, 'projects.costVoided', 'This cost is already voided');
	}
}

/** The BAST is not part of this project, or it is cancelled. */
export class BastNotFoundError extends AppError {
	constructor() {
		super(404, 'projects.bastNotFound', 'BAST not found');
	}
}

/** Sales side: an order with a live project cannot be cancelled. */
export class SalesOrderHasProjectError extends AppError {
	constructor() {
		super(422, 'sales.orderHasProject', 'This sales order has a project; cancel the project first');
	}
}

// Field attendance (employee portal Phase B) -------------------------------

/** The project has no site coordinates, so no radius can be checked. */
export class ProjectSiteCoordinatesError extends AppError {
	constructor() {
		super(
			422,
			'projects.siteCoordinates' as const,
			'This project has no site coordinates; ask an administrator to fill its site address',
		);
	}
}

/** The selfie is missing or not an accepted image. */
export class SiteSelfieError extends AppError {
	constructor(kind: 'missing' | 'type' | 'size' | 'empty') {
		const messages = {
			missing: 'A selfie is required to check in at a project site',
			type: 'The selfie must be a JPG, PNG or WebP image',
			size: 'The selfie must be 5 MB or smaller',
			empty: 'The selfie file is empty',
		};
		super(kind === 'size' ? 413 : 422, `projects.selfie.${kind}` as const, messages[kind]);
	}
}

/** A site check-in/out cannot be written as asked. */
export class SiteAttendanceStateError extends AppError {
	constructor(kind: 'alreadyCheckedIn' | 'notCheckedIn' | 'alreadyCheckedOut') {
		const messages = {
			alreadyCheckedIn: 'You already checked in on this project today',
			notCheckedIn: 'Check in before checking out',
			alreadyCheckedOut: 'This site visit is already checked out',
		};
		super(kind === 'notCheckedIn' ? 422 : 409, `projects.siteAttendance.${kind}` as const, messages[kind]);
	}
}

