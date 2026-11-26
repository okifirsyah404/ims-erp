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
import {
	adminOrErpGuard,
	erpGuard,
	sessionGuard,
	warehouseGuard,
} from '@authorization/elysia-auth';
import { employeePortalGuard } from '@authorization/employee-portal-guard';
import { portalGuard } from '@authorization/portal-auth';
import { translator } from '@providers/i18n/translator';
import { toErrorResponse } from './errors';
import { errorEnvelope } from './response';

/** Guard combinations a module can declare. */
export type TGuardSet =
	| 'none'
	| 'session'
	| 'erp'
	| 'erp+session'
	/** Session guard plus the warehouse person-in-charge guard (ADR-0017). */
	| 'session+warehouse'
	/** The customer-portal session cookie (ERP-0022, ERP-0094), never combined with the ERP guards. */
	| 'portal'
	/** Application admin, or an organization member holding the permission (code numbering). */
	| 'admin-or-erp'
	/** Employee portal: session + an employee record in the active organization. */
	| 'employee-portal';

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

/** One field-level message for the error envelope. */
type TValidationDetail = { field: string | null; message: string };

/**
 * Reads the offending field and message out of Elysia's `ValidationError`.
 *
 * @remarks
 * Elysia keeps the first validator error on `valueError` for both validator
 * families, but with different `path` shapes: Zod issues carry an array
 * (`['id']`) and TypeBox carries a JSON-pointer string (`'/id'`). Its
 * `message` is a stringified JSON blob, so it is only the fallback.
 *
 * `error.value` is deliberately never stringified: it holds the raw request
 * input, and touching it used to throw (`No default value`) and turn every
 * validation failure into a 500.
 *
 * @param error - The caught `ValidationError`
 */
function validationDetail(error: unknown): TValidationDetail {
	const valueError = (error as { valueError?: unknown } | null)?.valueError;
	if (valueError && typeof valueError === 'object') {
		const { path, message } = valueError as {
			path?: unknown;
			message?: unknown;
		};
		const segments = Array.isArray(path) ? path : [path];
		const field = segments
			.filter((segment): segment is string => typeof segment === 'string')
			.join('.')
			.replace(/^\./, '');
		if (typeof message === 'string' && message.length > 0) {
			return { field: field || null, message };
		}
	}
	const fallback = (error as { message?: unknown } | null)?.message;
	return { field: null, message: typeof fallback === 'string' ? fallback : '' };
}

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
	if (guards === 'session+warehouse') {
		app = app.use(sessionGuard()).use(warehouseGuard());
	}
	if (guards === 'portal') app = app.use(portalGuard());
	if (guards === 'admin-or-erp') app = app.use(adminOrErpGuard());
	if (guards === 'employee-portal') app = app.use(employeePortalGuard());

	return app.onError({ as: 'local' }, (ctx) => {
		const { code, error, set } = ctx;
		const t = translator(ctx);

		if (code === 'VALIDATION') {
			set.status = 400;
			// `field` is the offending property NAME, never its value. The
			// previous `String(error.value)` stringified the request input
			// (`[object Object]`), and with Zod-backed schemas Elysia puts the
			// raw input there — a `ZodError`-shaped value whose `toString()`
			// throws (`No default value`), which turned every validation
			// failure into a 500 once the route was served from `.listen()`.
			// `.listen()` compiles routes (AOT), so `app.handle()` in tests
			// never reproduced it.
			const detail = validationDetail(error);
			return errorEnvelope(400, t('common.validationFailed'), [detail]);
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
