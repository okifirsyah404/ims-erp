import { AppError } from '@http/errors';

/** The ticket does not exist or is not visible to the caller. */
export class TicketNotFoundError extends AppError {
	constructor() {
		super(404, 'aftersales.ticketNotFound', 'Service ticket not found');
	}
}

/** The customer, project or serial does not fit the ticket. */
export class TicketReferenceError extends AppError {
	constructor(kind: 'customer' | 'project' | 'serial') {
		const messages = {
			customer: 'The customer is missing or inactive',
			project: 'The project does not belong to this customer',
			serial: 'This serial number was delivered to another customer',
		};
		super(422, `aftersales.ticketRef.${kind}` as const, messages[kind]);
	}
}

/** The ticket is not in the state the action needs. */
export class TicketStateError extends AppError {
	constructor(action: 'assign' | 'start' | 'resolve' | 'reopen' | 'close') {
		const messages = {
			assign: 'Only a new or in-progress ticket can be assigned',
			start: 'Only a new ticket can be started',
			resolve: 'Only a new or in-progress ticket can be resolved',
			reopen: 'Only a resolved ticket can be reopened',
			close: 'Only a resolved ticket can be closed',
		};
		super(422, `aftersales.ticketState.${action}` as const, messages[action]);
	}
}

/** Only the assignee (or someone who assigns tickets) works the ticket. */
export class TicketForbiddenError extends AppError {
	constructor() {
		super(403, 'aftersales.ticketForbidden', 'Only the assignee or a ticket manager can work this ticket');
	}
}

/** The assignee cannot work tickets. */
export class TicketAssigneeError extends AppError {
	constructor() {
		super(422, 'aftersales.ticketAssignee', 'Tickets can only go to members who can work on tickets');
	}
}
