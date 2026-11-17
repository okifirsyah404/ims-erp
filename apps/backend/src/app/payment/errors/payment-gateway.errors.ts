import { AppError } from '@http/errors';

/** Online payment is off: no provider configured (or `fake` in production). */
export class GatewayNotConfiguredError extends AppError {
	constructor() {
		super(409, 'sales.gatewayNotConfigured', 'Online payment is not configured');
	}
}

/** A webhook for a provider that has no credentials here. */
export class GatewayProviderUnknownError extends AppError {
	constructor() {
		super(404, 'sales.gatewayProviderUnknown', 'Unknown payment provider');
	}
}

/** The provider refused or could not be reached when opening a checkout. */
export class GatewayProviderError extends AppError {
	constructor() {
		super(502, 'sales.gatewayProvider', 'The payment provider did not accept the request');
	}
}

/** A webhook whose token or signature does not verify. */
export class GatewayWebhookUnauthorizedError extends AppError {
	constructor() {
		super(401, 'sales.gatewayWebhookUnauthorized', 'Invalid webhook signature');
	}
}
