import { pinoLogger } from '@providers/logger/logger';
import { Elysia } from 'elysia';

/**
 * Access log for the root application.
 *
 * @remarks
 * This replaces `@bogeychan/elysia-logger`'s `wrap()`, whose `onAfterResponse`
 * logged the **entire Elysia context**. pino only flattens top-level keys that
 * have a registered serializer (`request` and `err` — nothing else), so
 * everything else was serialized recursively at full depth. That included
 * `i18n`, which carries two complete copies of the EN/ID message catalogues
 * (the request instance plus the clone `elysia-i18next` derives per request),
 * plus the raw cookie jar with live session tokens. The result was a
 * multi-kilobyte JSON line per request, most of it static translations.
 *
 * Rather than subtracting keys from that payload, the record is built
 * explicitly here: method, path, status, duration and the resolved
 * organization. That is what an access log is for.
 *
 * Two hook subtleties, both load-bearing:
 *
 * - `onAfterResponse` does **not** run for a request that threw — Elysia
 *   routes those through `onError` only. The guard's 401s take that path, so
 *   without an `onError` arm the most interesting requests would go unlogged.
 * - The start timestamp rides on the request object, not on `ctx.store`:
 *   `store` is the app's plugin-scoped bag shared by every request, so writing
 *   to it races under concurrency.
 */
const START_TIME = Symbol('requestStartTime');

type TimedRequest = Request & { [START_TIME]?: number };

/** Response `set.status` is optional and may be a numeric-string alias. */
function resolveStatus(set: { status?: unknown }): number {
	if (typeof set.status === 'number') return set.status;
	if (typeof set.status === 'string') {
		const parsed = Number(set.status);
		if (Number.isFinite(parsed)) return parsed;
	}
	// Elysia omits `status` when the handler returned normally.
	return 200;
}

export const requestLogger = new Elysia({ name: 'request-logger' })
	.onRequest(({ request }) => {
		(request as TimedRequest)[START_TIME] = performance.now();
	})
	.onAfterResponse(({ request, route, set }) => {
		pinoLogger.info(record(request, route, set), 'request completed');
	})
	.onError(({ request, route, set, error }) => {
		// Let every other `onError` arm map the error first; `set.status` is
		// final by the time the microtask runs.
		queueMicrotask(() => {
			pinoLogger.error(
				{
					...record(request, route, set),
					err: {
						type: (error as Error)?.constructor?.name ?? typeof error,
						message: (error as Error)?.message ?? String(error),
					},
				},
				'request failed',
			);
		});
	})
	.as('global');

/** Builds the shared part of the access-log record. */
function record(
	request: Request,
	route: string | null,
	set: { status?: unknown },
) {
	const startTime = (request as TimedRequest)[START_TIME];

	return {
		method: request.method,
		path: new URL(request.url).pathname,
		route,
		status: resolveStatus(set),
		...(startTime === undefined
			? {}
			: { responseTime: Math.round((performance.now() - startTime) * 100) / 100 }),
	};
}
