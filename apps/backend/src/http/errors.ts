/**
 * The API's domain-error contract and its HTTP translation.
 *
 * @remarks
 * A domain error carries a **status** and a locale **key** - never translated
 * prose. Services have no request context and must not know about
 * presentation; the controller resolves the key against the request's
 * `Accept-Language` when it writes the envelope.
 *
 * The string passed to `super()` stays English and is for logs and stack
 * traces only - it is never sent to clients.
 *
 * `UserManagementError` (the largest family) extends {@link AppError}, and
 * the smaller module errors extend it too, so one `onError` arm maps them
 * all. Before this existed, `user`, `organization` and `user-management` each
 * declared its own private `NotGlobalAdminError` and mapped it separately.
 */
import type { TApiErrorMessage, TApiResponse } from '@ims-erp/common';
import type { ApiKey } from '@providers/i18n/translator';
import { errorEnvelope } from './response';

/** Base class for every error that maps onto a specific HTTP status. */
export class AppError extends Error {
	/** The catalogue key for this error, resolved per request by the controller. */
	key: ApiKey;

	constructor(
		readonly status: number,
		key: ApiKey,
		message: string,
		readonly params?: Record<string, string | number>,
	) {
		super(message);
		this.name = new.target.name;
		this.key = key;
	}

	/**
	 * Returns this error retargeted at a different catalogue key.
	 *
	 * @remarks
	 * Subclasses whose single status code covers several distinct messages
	 * (e.g. an expired vs. already-used claim token) expose static factories
	 * built on this. Mutating in place keeps the stack trace pointing at the
	 * original `throw`.
	 */
	protected withKey(
		key: ApiKey,
		message: string,
		params?: Record<string, string | number>,
	): this {
		this.key = key;
		this.message = message;
		(this as { params?: Record<string, string | number> }).params = params;
		return this;
	}
}

/**
 * A domain error whose message is already user-facing text rather than a
 * catalogue key.
 *
 * @remarks
 * Used where the message is composed at runtime from validated input (sales
 * state transitions). Prefer {@link AppError} with a real key for anything
 * with a fixed meaning - it is the only variant that survives translation.
 */
export class DomainHttpError extends Error {
	constructor(
		readonly status: 400 | 403 | 404 | 409 | 422,
		message: string,
	) {
		super(message);
		this.name = new.target.name;
	}
}

/** Resolves an error into a finished response envelope, or `null` if unknown. */
export function toErrorResponse(
	error: unknown,
	translate: (key: ApiKey, options?: object) => string,
): TApiResponse<null> | null {
	if (error instanceof AppError) {
		const message = translate(error.key, error.params);
		const errors: TApiErrorMessage[] = [{ field: null, message }];
		return errorEnvelope(error.status, message, errors);
	}
	if (error instanceof DomainHttpError) {
		const errors: TApiErrorMessage[] = [{ field: null, message: error.message }];
		return errorEnvelope(error.status, error.message, errors);
	}
	return null;
}
