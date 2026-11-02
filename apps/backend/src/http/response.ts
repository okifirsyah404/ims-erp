/**
 * Response envelope builders - the single implementation for the whole API.
 *
 * @remarks
 * `TApiResponse<T>` / `TApiPaginatedResponse<T>` from `@ims-erp/common` are
 * built here and nowhere else (see `elysia-layered-architecture` rule 1.5:
 * the envelope is an HTTP-layer concern, so services and repositories never
 * construct `requestId`/`status`/`timestamp`).
 *
 * Before this module existed each controller carried its own copy of these
 * helpers, and they had drifted apart: two of them hand-rolled the 201
 * envelope because only one had a `created()` helper, and `okPaginated` had
 * two incompatible signatures.
 */
import type {
	TApiErrorMessage,
	TApiPaginatedResponse,
	TApiResponse,
	TPaginationResult,
} from '@ims-erp/common';

/**
 * Builds the request-scoped envelope metadata.
 *
 * @param status - HTTP status mirrored into the body
 * @param message - Human-readable outcome, already translated by the caller
 */
export function buildMeta(status: number, message: string) {
	return {
		requestId: crypto.randomUUID(),
		status,
		message,
		timestamp: Date.now(),
	};
}

/** Wraps a single row in the standard success envelope (`200`). */
export function ok<T>(data: T): TApiResponse<T> {
	return { ...buildMeta(200, 'OK'), data, errors: [] };
}

/** Wraps a newly created row in the standard envelope (`201`). */
export function created<T>(data: T): TApiResponse<T> {
	return { ...buildMeta(201, 'Created'), data, errors: [] };
}

/** Wraps a `200` response carrying no payload. */
export function noContent(): TApiResponse<null> {
	return { ...buildMeta(200, 'OK'), data: null, errors: [] };
}

/**
 * Wraps a paginated result in the standard paginated envelope.
 *
 * @remarks
 * Takes the repository's `TPaginationResult<T>` directly and maps `meta` onto
 * `pagination`, so `total`/`totalPages` have exactly one source of truth.
 */
export function okPaginated<T>(
	result: TPaginationResult<T>,
): TApiPaginatedResponse<T> {
	return {
		...buildMeta(200, 'OK'),
		pagination: result.meta,
		data: result.data,
		errors: [],
	};
}

/** Builds the standard error envelope for a failed request. */
export function errorEnvelope(
	status: number,
	message: string,
	errors: TApiErrorMessage[] = [],
): TApiResponse<null> {
	return { ...buildMeta(status, message), data: null, errors };
}
