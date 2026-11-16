/**
 * Domain errors surfaced by the signature service (ERP-0048 / ERP-0049).
 *
 * @remarks
 * Each error carries a locale **key** rather than translated prose; the
 * controller resolves it against the request's `Accept-Language`.
 */
import { AppError } from '@http/errors';

/** The request id does not resolve to a live row. */
export class SignatureRequestNotFoundError extends AppError {
	constructor() {
		super(404, 'document.signatureRequestNotFound', 'Signature request not found');
	}
}

/** The request is not in the state the action needs (not pending, expired, …). */
export class SignatureRequestStateError extends AppError {
	constructor() {
		super(409, 'document.signatureRequestState', 'This signature request cannot be acted on');
	}
}

/** The caller is not the signer the request is addressed to. */
export class NotRequestSignerError extends AppError {
	constructor() {
		super(403, 'document.notRequestSigner', 'This request is not addressed to you');
	}
}

/** The caller is not the requester who created the request. */
export class NotRequestOwnerError extends AppError {
	constructor() {
		super(403, 'document.notRequestOwner', 'Only the requester can cancel this request');
	}
}

/** The user has no live signature image. */
export class SignatureImageNotFoundError extends AppError {
	constructor() {
		super(404, 'document.signatureImageNotFound', 'No signature image uploaded');
	}
}
