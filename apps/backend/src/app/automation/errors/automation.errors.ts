import { AppError } from '@http/errors';

/** The outbox event does not exist. */
export class OutboxNotFoundError extends AppError {
	constructor() {
		super(404, 'automation.outboxNotFound', 'Event not found');
	}
}
