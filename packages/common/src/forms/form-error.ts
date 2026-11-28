/**
 * Field-level validation errors shared by the backend envelope and the web
 * forms (P7-6, TF-1/TF-A, message pattern 4.5 of
 * `docs/adjustment/3-rancangan/rancangan-menu-dasbor-dan-form.md`).
 *
 * @remarks
 * Zod issues carry English text and technical codes. Both sides map an issue
 * to one of {@link FORM_ERROR_KEYS} plus its parameters instead, and each side
 * translates the key itself: the backend without a field label (it has none),
 * the web form with the label it shows next to the input.
 */

/** Translation keys of the shared field-error vocabulary. */
export const FORM_ERROR_KEYS = [
	'required',
	'invalidFormat',
	'min',
	'max',
	'minLength',
	'maxLength',
	'notNegative',
	'notPast',
	'dateOrder',
	'taken',
	'exceedsRemaining',
	'emptyTable',
	'contactRequired',
	'unknownField',
] as const;

export type TFormErrorKey = (typeof FORM_ERROR_KEYS)[number];

/** Interpolation values for a {@link TFormErrorKey}. */
export type TFormErrorParams = Record<string, string | number>;

/** One field-level error: which field, which key, which values. */
export type TFormError = {
	/** Dot path of the field (`name`, `lines.0.quantity`); `null` for the whole form. */
	field: string | null;
	key: TFormErrorKey;
	params?: TFormErrorParams;
};

/** The subset of a Zod (v4) issue this module reads. */
export type TZodIssueLike = {
	code: string;
	path: ReadonlyArray<PropertyKey>;
	message?: string;
	origin?: string;
	minimum?: number | bigint;
	maximum?: number | bigint;
	keys?: string[];
	params?: Record<string, unknown>;
};

/**
 * Builds the refine options that make a custom rule report a shared key.
 *
 * @example
 * ```ts
 * schema.refine(hasContact, formRule('contactRequired', ['phone']));
 * ```
 *
 * @remarks
 * `when: () => true` runs the rule even when other fields already failed,
 * so a single save shows every problem at once (RF-14).
 */
export function formRule(
	key: TFormErrorKey,
	path: PropertyKey[],
	params?: TFormErrorParams,
) {
	return {
		message: key,
		path,
		params: { key, ...params },
		when: () => true,
	};
}

const isFormErrorKey = (value: unknown): value is TFormErrorKey =>
	typeof value === 'string' &&
	(FORM_ERROR_KEYS as readonly string[]).includes(value);

/** Joins an issue path into the dot form used as the field name. */
export function issueField(path: ReadonlyArray<PropertyKey>): string | null {
	const field = path
		.filter(
			(segment): segment is string | number =>
				typeof segment === 'string' || typeof segment === 'number',
		)
		.join('.');
	return field === '' ? null : field;
}

function valueAt(root: unknown, path: ReadonlyArray<PropertyKey>): unknown {
	let current = root;
	for (const segment of path) {
		if (current == null || typeof current !== 'object') return undefined;
		current = (current as Record<PropertyKey, unknown>)[segment];
	}
	return current;
}

const isBlank = (value: unknown) =>
	value === undefined ||
	value === null ||
	(typeof value === 'string' && value.trim() === '');

/**
 * Maps one Zod issue to the shared field-error vocabulary.
 *
 * @param issue - A Zod v4 issue (or anything shaped like one)
 * @param input - The value that was validated; used to tell "empty" from
 *   "wrong" because Zod issues do not carry the input by default
 */
export function zodIssueToFormError(
	issue: TZodIssueLike,
	input?: unknown,
): TFormError {
	const field = issueField(issue.path);
	const blank = isBlank(valueAt(input, issue.path));
	const bound = (value: number | bigint | undefined) =>
		value === undefined ? 0 : Number(value);

	switch (issue.code) {
		case 'custom': {
			const key = issue.params?.key;
			if (!isFormErrorKey(key)) return { field, key: 'invalidFormat' };
			const params: TFormErrorParams = {};
			for (const [name, value] of Object.entries(issue.params ?? {})) {
				if (name !== 'key' && (typeof value === 'string' || typeof value === 'number')) {
					params[name] = value;
				}
			}
			return Object.keys(params).length > 0 ? { field, key, params } : { field, key };
		}
		case 'too_small': {
			const min = bound(issue.minimum);
			if (issue.origin === 'string' || issue.origin === 'array') {
				if (issue.origin === 'array' && min <= 1) return { field, key: 'emptyTable' };
				return blank || min <= 1
					? { field, key: 'required' }
					: { field, key: 'minLength', params: { min } };
			}
			if (min === 0) return { field, key: 'notNegative' };
			return { field, key: 'min', params: { min } };
		}
		case 'too_big': {
			const max = bound(issue.maximum);
			return issue.origin === 'string'
				? { field, key: 'maxLength', params: { max } }
				: { field, key: 'max', params: { max } };
		}
		case 'unrecognized_keys':
			return {
				field: issue.keys?.[0] ?? field,
				key: 'unknownField',
			};
		case 'invalid_type':
		case 'invalid_value':
		case 'invalid_union':
			return blank ? { field, key: 'required' } : { field, key: 'invalidFormat' };
		default:
			return { field, key: 'invalidFormat' };
	}
}

/** Maps every issue of a failed parse; one entry per issue, in order. */
export function zodIssuesToFormErrors(
	issues: ReadonlyArray<TZodIssueLike>,
	input?: unknown,
): TFormError[] {
	return issues.map((issue) => zodIssueToFormError(issue, input));
}

/**
 * Short reference shown to the user for a server error (RF-27).
 *
 * @remarks
 * The first eight hex digits of the envelope's `requestId`, upper-cased. The
 * backend logs the same value, so a support request can be matched to the
 * log line without exposing the error itself.
 */
export function errorRef(requestId: string): string {
	return requestId.replace(/-/g, '').slice(0, 8).toUpperCase();
}
