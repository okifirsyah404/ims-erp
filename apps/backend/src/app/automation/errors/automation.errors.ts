import { AppError } from '@http/errors';

/** The outbox event does not exist. */
export class OutboxNotFoundError extends AppError {
	constructor() {
		super(404, 'automation.outboxNotFound', 'Event not found');
	}
}

/** The WhatsApp conversation, message or FAQ entry does not exist. */
export class WhatsappNotFoundError extends AppError {
	constructor(what: 'conversation' | 'message' | 'faq') {
		super(404, `automation.whatsappNotFound.${what}`, 'Not found');
	}
}

/** The inbound webhook is refused: no secret configured (503) or a bad signature (401). */
export class WhatsappWebhookError extends AppError {
	constructor(problem: 'notConfigured' | 'badSignature') {
		super(problem === 'notConfigured' ? 503 : 401, `automation.whatsappWebhook.${problem}`, 'Webhook refused');
	}
}

/** Only a failed outbound message can be sent again. */
export class WhatsappRetryError extends AppError {
	constructor() {
		super(409, 'automation.whatsappRetry', 'Only a failed outbound message can be sent again');
	}
}
