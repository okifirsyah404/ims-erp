import {
	errorRef,
	FORM_ERROR_KEYS,
	type TApiResponse,
	type TFormErrorKey,
	type TFormErrorParams,
} from '@ims-erp/common';

/**
 * One reader for failed API responses (P7-6, TF-2).
 *
 * @remarks
 * The `lib/*-api.ts` clients used to copy `throw new Error(errors[0].message)`
 * each, which dropped every error after the first and lost the field it
 * belonged to. {@link readApiError} keeps all of it: a summary message, the
 * errors per field (with the shared key so a form can word them with its own
 * label), the errors that name no field, and for a server fault the
 * reference to report (RF-27).
 */

/** One field error as sent by the server. */
export type TApiFieldError = {
	/** Server message, already translated for the request language. */
	message: string;
	key?: TFormErrorKey;
	params?: TFormErrorParams;
};

/** What went wrong with a request, in a shape forms can use directly. */
export class ApiError extends Error {
	override readonly name = 'ApiError';

	/** HTTP status; `0` when the request never reached the server. */
	readonly status: number;
	/** First error per field name (`name`, `lines.0.quantity`). */
	readonly fieldErrors: Record<string, TApiFieldError>;
	/** Messages that name no field (shown in the form summary, RF-17). */
	readonly formErrors: string[];
	/** Reference for a server fault (status >= 500), `null` otherwise (RF-27). */
	readonly ref: string | null;

	constructor(
		message: string,
		status: number,
		fieldErrors: Record<string, TApiFieldError>,
		formErrors: string[],
		ref: string | null,
	) {
		super(message);
		this.status = status;
		this.fieldErrors = fieldErrors;
		this.formErrors = formErrors;
		this.ref = ref;
	}

	/** True when the request failed before any response arrived (RF-19). */
	get isNetworkError(): boolean {
		return this.status === 0;
	}
}

const isFormErrorKey = (value: unknown): value is TFormErrorKey =>
	typeof value === 'string' && (FORM_ERROR_KEYS as readonly string[]).includes(value);

/**
 * Turns a failed response envelope into an {@link ApiError}.
 *
 * @param envelope - The parsed body, or `null` when it was not JSON
 * @param status - The HTTP status of the response
 */
export function readApiError(
	envelope: Partial<TApiResponse<unknown>> | null | undefined,
	status: number,
): ApiError {
	const fieldErrors: Record<string, TApiFieldError> = {};
	const formErrors: string[] = [];
	for (const entry of envelope?.errors ?? []) {
		if (!entry || typeof entry.message !== 'string') continue;
		if (entry.field) {
			if (fieldErrors[entry.field]) continue;
			fieldErrors[entry.field] = {
				message: entry.message,
				...(isFormErrorKey(entry.key) ? { key: entry.key } : {}),
				...(entry.params ? { params: entry.params } : {}),
			};
		} else {
			formErrors.push(entry.message);
		}
	}
	const ref = status >= 500 && typeof envelope?.requestId === 'string' ? errorRef(envelope.requestId) : null;
	const first = envelope?.errors?.find((entry) => entry && typeof entry.message === 'string')?.message;
	// A server fault keeps the envelope message: it carries the reference.
	const message = (ref ? envelope?.message : (first ?? envelope?.message)) || 'Request failed';
	return new ApiError(message, status, fieldErrors, formErrors, ref);
}

/** The error for a request that got no response (offline, server down). */
export function networkError(cause: unknown): ApiError {
	return new ApiError(cause instanceof Error ? cause.message : 'Network error', 0, {}, [], null);
}

/**
 * Reads a `fetch` response as the standard envelope, throwing {@link ApiError}
 * when it failed.
 *
 * @remarks
 * A body that is not JSON (a proxy error page, a crashed server) still
 * becomes an {@link ApiError} with the HTTP status, never a JSON parse error.
 */
export async function readEnvelope<T>(response: Response): Promise<TApiResponse<T>> {
	let envelope: TApiResponse<T> | null = null;
	try {
		envelope = (await response.json()) as TApiResponse<T>;
	} catch {
		envelope = null;
	}
	if (!response.ok || envelope === null) throw readApiError(envelope, response.status);
	return envelope;
}
