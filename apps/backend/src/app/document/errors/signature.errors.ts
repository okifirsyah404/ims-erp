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

/** The uploaded file is not a PDF, or the source PDF is not this document's. */
export class SignaturePdfInvalidError extends AppError {
	constructor() {
		super(422, 'document.signaturePdfInvalid', 'Pick a PDF of this document and upload a PDF');
	}
}

/** The signed PDF artifact is absent, or placement already happened. */
export class SignaturePdfStateError extends AppError {
	constructor() {
		super(409, 'document.signaturePdfState', 'This signature has no signed PDF yet, or it is final');
	}
}
