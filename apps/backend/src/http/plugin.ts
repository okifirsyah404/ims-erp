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
import { ZodError, ZodType } from 'zod';
import {
	errorRef,
	type TApiErrorMessage,
	type TFormError,
	zodIssuesToFormErrors,
} from '@ims-erp/common';
import {
	adminOrErpGuard,
	erpGuard,
	sessionGuard,
	warehouseGuard,
} from '@authorization/elysia-auth';
import { employeePortalGuard } from '@authorization/employee-portal-guard';
import { portalGuard } from '@authorization/portal-auth';
import { type ApiKey, resolveLanguage, translator } from '@providers/i18n/translator';
import { toErrorResponse } from './errors';
import { errorEnvelope } from './response';
import { pinoLogger } from '@providers/logger/logger';

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
type TValidationDetail = TApiErrorMessage;

/** Translator signature handed in from the request context. */
type TTranslate = (key: ApiKey, options?: object) => string;

/** Upper bound on reported issues; a hostile body must not build a huge reply. */
const MAX_VALIDATION_ERRORS = 50;

/** TypeBox `ValueErrorType` codes this mapper distinguishes (TypeBox 0.34). */
const TYPEBOX = {
	arrayMinItems: 4,
	integerMaximum: 24,
	integerMinimum: 25,
	numberMaximum: 38,
	numberMinimum: 39,
	additionalProperties: 42,
	requiredProperty: 45,
	stringMaxLength: 51,
	stringMinLength: 52,
} as const;

/** Translates a shared form error into the envelope entry (P7-6, TF-1). */
function toDetail(formError: TFormError, t: TTranslate): TValidationDetail {
	return {
		field: formError.field,
		key: formError.key,
		...(formError.params ? { params: formError.params } : {}),
		message: t(`validation.${formError.key}` as ApiKey, formError.params ?? {}),
	};
}

/** The Zod schema behind an Elysia validator, when the route used Zod. */
function zodSchemaOf(validator: unknown): ZodType | null {
	const candidates = [validator, (validator as { schema?: unknown } | null)?.schema];
	for (const candidate of candidates) {
		if (candidate instanceof ZodType) return candidate;
	}
	return null;
}

/**
 * Maps one TypeBox `ValueError` to the shared vocabulary.
 *
 * @remarks
 * TypeBox paths are JSON pointers (`/lines/0/qty`); the field becomes
 * `lines.0.qty`, the same shape Zod paths produce.
 */
function typeBoxFormError(valueError: unknown): TFormError {
	const { type, path, schema, value } = (valueError ?? {}) as {
		type?: number;
		path?: unknown;
		schema?: { minLength?: number; maxLength?: number; minimum?: number; maximum?: number };
		value?: unknown;
	};
	const field =
		typeof path === 'string' && path.length > 1
			? path.slice(1).split('/').join('.')
			: null;
	const blank = value === undefined || value === null || value === '';
	switch (type) {
		case TYPEBOX.requiredProperty:
			return { field, key: 'required' };
		case TYPEBOX.additionalProperties:
			return { field, key: 'unknownField' };
		case TYPEBOX.arrayMinItems:
			return { field, key: 'emptyTable' };
		case TYPEBOX.stringMinLength: {
			const min = schema?.minLength ?? 1;
			return blank || min <= 1
				? { field, key: 'required' }
				: { field, key: 'minLength', params: { min } };
		}
		case TYPEBOX.stringMaxLength:
			return { field, key: 'maxLength', params: { max: schema?.maxLength ?? 0 } };
		case TYPEBOX.numberMinimum:
		case TYPEBOX.integerMinimum: {
			const min = schema?.minimum ?? 0;
			return min === 0 ? { field, key: 'notNegative' } : { field, key: 'min', params: { min } };
		}
		case TYPEBOX.numberMaximum:
		case TYPEBOX.integerMaximum:
			return { field, key: 'max', params: { max: schema?.maximum ?? 0 } };
		default:
			return blank ? { field, key: 'required' } : { field, key: 'invalidFormat' };
	}
}

/**
 * Reads every validation problem out of Elysia's `ValidationError` (TF-1).
 *
 * @remarks
 * Elysia keeps only the first problem on `valueError`. For Zod-backed routes
 * the schema is re-run (`safeParse`) to get every issue with its code; for
 * TypeBox routes `error.all` already lists them. Each issue becomes a field
 * name plus a shared key ({@link TFormError}) and an Indonesian/English
 * message from the `api` bundle, never Zod's English text.
 *
 * `error.value` is passed to the schema but never stringified: it holds the
 * raw request input, and stringifying it used to throw (`No default value`)
 * and turn every validation failure into a 500. Any failure while reading
 * falls back to the single {@link firstValidationDetail}.
 *
 * @param error - The caught `ValidationError`
 * @param t - The request-scoped `api` translator
 */
function validationDetails(error: unknown, t: TTranslate): TValidationDetail[] {
	try {
		const source = error as { validator?: unknown; value?: unknown; all?: unknown };
		const schema = zodSchemaOf(source.validator);
		if (schema) {
			const parsed = schema.safeParse(source.value);
			if (!parsed.success && parsed.error.issues.length > 0) {
				return zodIssuesToFormErrors(
					parsed.error.issues.slice(0, MAX_VALIDATION_ERRORS),
					source.value,
				).map((formError) => toDetail(formError, t));
			}
		} else {
			const all = source.all;
			if (Array.isArray(all) && all.length > 0) {
				return all
					.slice(0, MAX_VALIDATION_ERRORS)
					.map((valueError) => toDetail(typeBoxFormError(valueError), t));
			}
		}
	} catch (readError) {
		pinoLogger.warn({ err: readError }, 'could not read validation issues');
	}
	return [firstValidationDetail(error)];
}

/**
 * Reads the offending field and message of the FIRST problem only.
 *
 * @remarks
 * Fallback for {@link validationDetails}. Elysia keeps the first validator
 * error on `valueError` for both validator families, but with different
 * `path` shapes: Zod issues carry an array (`['id']`) and TypeBox carries a
 * JSON-pointer string (`'/id'`).
 *
 * @param error - The caught `ValidationError`
 */
function firstValidationDetail(error: unknown): TValidationDetail {
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
 * Applies the request's `Accept-Language` before an early error is translated.
 *
 * @remarks
 * `elysia-i18next` switches the request-scoped instance to the detected
 * language in `onBeforeHandle`, which runs AFTER body validation. A
 * VALIDATION or PARSE error therefore reached this hook still in the default
 * language, and every field message came back English whatever the UI
 * language (found while building P7-6). Errors raised later already carry the
 * detected language and are left alone.
 */
async function alignEarlyErrorLanguage(ctx: unknown): Promise<void> {
	const { i18n, request } = ctx as {
		i18n?: { language?: string; changeLanguage?: (lng: string) => Promise<unknown> };
		request?: Request;
	};
	if (typeof i18n?.changeLanguage !== 'function') return;
	const language = resolveLanguage(request?.headers.get('accept-language'));
	if (i18n.language !== language) await i18n.changeLanguage(language);
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

	return app.onError({ as: 'local' }, async (ctx) => {
		const { code, error, set } = ctx;
		if (code === 'VALIDATION' || code === 'PARSE') await alignEarlyErrorLanguage(ctx);
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
			return errorEnvelope(400, t('common.validationFailed'), validationDetails(error, t));
		}
		if (code === 'PARSE' || error instanceof ZodError) {
			set.status = 400;
			// A thrown ZodError (a service-level `parse`) lists every issue like
			// a route validator does; a PARSE failure (malformed body) has no
			// field and never echoes the body back.
			const details =
				error instanceof ZodError
					? zodIssuesToFormErrors(error.issues.slice(0, MAX_VALIDATION_ERRORS)).map(
							(formError) => toDetail(formError, t),
						)
					: [toDetail({ field: null, key: 'invalidFormat' }, t)];
			return errorEnvelope(400, t('common.validationFailed'), details);
		}

		const mapped = toErrorResponse(error, t);
		if (mapped) {
			set.status = mapped.status;
			return mapped;
		}
		// An error nobody mapped (a failed query, a bug) used to fall through to
		// Elysia's plain-text body, which the clients then failed to parse as
		// JSON ("Unexpected token 'F', \"Failed que\"..."). Answer with the
		// standard envelope and a generic message instead; the detail (SQL,
		// stack) goes to the server log only, never to the client.
		if (code === 'UNKNOWN' || code === 'INTERNAL_SERVER_ERROR') {
			// RF-27: the envelope's requestId doubles as the support reference.
			// The short `ref` is shown to the user and logged with the full id,
			// so a report can be matched to this line.
			const requestId = crypto.randomUUID();
			const ref = errorRef(requestId);
			pinoLogger.error({ err: error, path: ctx.path, requestId, ref }, 'unhandled error');
			set.status = 500;
			return errorEnvelope(500, t('common.internalError', { ref }), [], requestId);
		}
		return undefined;
	}) as AnyElysia;
}
