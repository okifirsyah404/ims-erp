/**
 * Builds a module's Elysia plugin with the API's shared HTTP plumbing.
 *
 * @remarks
 * Every domain controller needs the same three things: a named/prefixed
 * plugin, the guards it relies on, and an `onError` hook that turns
 * validation failures and domain errors into the standard envelope. Doing
 * that by hand in each controller produced six near-identical copies that had
 * drifted (see `src/http/response.ts`).
 *
 * The returned builder is typed so handlers get the guard's `erp` context
 * without repeating `.use(...)` in every controller.
 */
import { type AnyElysia, Elysia } from 'elysia';
import { ZodError } from 'zod';
import { erpGuard, sessionGuard } from '@authorization/elysia-auth';
import { translator } from '@providers/i18n/translator';
import { toErrorResponse } from './errors';
import { errorEnvelope } from './response';

/** Guard combinations a module can declare. */
export type TGuardSet = 'none' | 'session' | 'erp' | 'erp+session';

/** Options describing one module's plugin. */
export type TDomainPluginOptions = {
	/** Unique plugin name - Elysia deduplicates hooks on hot reload. */
	name: string;
	/** URL prefix for every route in the plugin. */
	prefix?: string;
	/** OpenAPI tags applied to the plugin's routes. */
	tags?: string[];
	/** Which authorization guards to mount. Defaults to `none`. */
	guards?: TGuardSet;
};

/**
 * Creates the domain plugin builder.
 *
 * @remarks
 * Returns the base `Elysia` instance with guards and error mapping already
 * applied, so the controller chains `.get()`/`.post()` straight onto it:
 *
 * ```ts
 * return domainPlugin({ name: 'location', prefix: '/locations' })
 * 	.get('/provinces', handler);
 * ```
 *
 * The `onError` hook is scoped with `as: 'local'` so it only maps this
 * module's routes, and it maps, in order: Elysia `VALIDATION`/`PARSE`,
 * thrown `ZodError`s, then {@link AppError}/{@link DomainHttpError}. Unknown
 * errors return `undefined` so Elysia's default handling still applies.
 */
export function domainPlugin(
	options: TDomainPluginOptions,
): AnyElysia {
	const { name, prefix, tags, guards = 'none' } = options;

	let app: AnyElysia = new Elysia({ name, prefix, tags });

	if (guards === 'erp' || guards === 'erp+session') app = app.use(erpGuard());
	if (guards === 'session' || guards === 'erp+session') {
		app = app.use(sessionGuard());
	}

	return app.onError({ as: 'local' }, (ctx) => {
		const { code, error, set } = ctx;
		const t = translator(ctx);

		if (code === 'VALIDATION') {
			set.status = 400;
			return errorEnvelope(400, t('common.validationFailed'), [
				{
					field: error.value ? String(error.value) : null,
					message: error.message,
				},
			]);
		}
		if (code === 'PARSE' || error instanceof ZodError) {
			set.status = 400;
			return errorEnvelope(400, t('common.validationFailed'), [
				{
					field: null,
					message:
						error instanceof ZodError
							? error.issues.map((issue) => issue.message).join('; ')
							: String(error),
				},
			]);
		}

		const mapped = toErrorResponse(error, t);
		if (mapped) {
			set.status = mapped.status;
			return mapped;
		}
		return undefined;
	}) as AnyElysia;
}
