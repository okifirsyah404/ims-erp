import { AppError } from '@http/errors';

/** Online payment is off: no default gateway configured (or none active). */
export class GatewayNotConfiguredError extends AppError {
	constructor() {
		super(409, 'sales.gatewayNotConfigured', 'Online payment is not configured');
	}
}

/** A webhook for a provider that has no active gateway here. */
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

/** The gateway row does not exist in this organization. */
export class GatewayNotFoundError extends AppError {
	constructor() {
		super(404, 'payment.gatewayNotFound', 'Payment gateway not found');
	}
}

/**
 * The gateway cannot be used because its secret is missing or unreadable.
 *
 * @remarks
 * Also the answer when `PAYMENT_SECRET_KEY` is absent or the key changed after
 * the secret was sealed: the row is there, the credential is not.
 */
export class GatewaySecretKeyMissingError extends AppError {
	constructor() {
		super(409, 'payment.gatewaySecretUnavailable', 'The payment gateway secret is not available');
	}
}
