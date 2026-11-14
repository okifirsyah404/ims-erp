/**
 * Domain errors surfaced by the document service.
 *
 * @remarks
 * Each error carries a locale **key** rather than translated prose; the
 * controller resolves it against the request's `Accept-Language`.
 */
import { AppError } from '@http/errors';

/** The document id does not resolve to a live row. */
export class DocumentNotFoundError extends AppError {
	constructor() {
		super(404, 'document.notFound', 'Document not found');
	}
}

/** Only a live, non-void document can be voided. */
export class DocumentNotVoidableError extends AppError {
	constructor() {
		super(409, 'document.notVoidable', 'This document cannot be voided');
	}
}

/** The file id does not resolve to a live file of that document. */
export class DocumentFileNotFoundError extends AppError {
	constructor() {
		super(404, 'document.fileNotFound', 'File not found');
	}
}

/** The share link is unknown, expired or revoked. */
export class DocumentShareNotFoundError extends AppError {
	constructor() {
		super(404, 'document.shareNotFound', 'This link is invalid or has expired');
	}
}

/** Files can only be attached to a live, non-void document. */
export class DocumentFileStateError extends AppError {
	constructor() {
		super(409, 'document.fileNotAllowed', 'A void document cannot take files');
	}
}
