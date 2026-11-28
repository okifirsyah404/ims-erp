import {
	type TFormErrorKey,
	type TFormErrorParams,
	type TZodIssueLike,
	zodIssuesToFormErrors,
} from '@ims-erp/common';

import type { ApiError } from './api-error';

/**
 * Field issues for web forms, from the shared schema or from the server
 * (P7-6, TF-A, RF-17).
 *
 * @remarks
 * Both sources end up in the same {@link TFieldIssues} map, keyed by the
 * field path the server and the schema use (`name`, `lines.0.quantity`), so
 * a form shows a server refusal under the same input as its own check.
 */

/** One problem with one field. */
export type TFieldIssue = {
	/** Shared key; the form words it with the field label. */
	key?: TFormErrorKey;
	params?: TFormErrorParams;
	/** Server text, used when there is no key. */
	message?: string;
};

export type TFieldIssues = Record<string, TFieldIssue>;

/** The only part of a Zod schema this module needs (no zod import here). */
export type TSafeParseSchema = {
	safeParse(input: unknown): { success: boolean; error?: { issues: ReadonlyArray<TZodIssueLike> } };
};

/**
 * Validates a payload with a shared schema; the first issue per field wins.
 *
 * @remarks
 * Issues that name no field are returned under `''`.
 */
export function schemaIssues(schema: TSafeParseSchema, input: unknown): TFieldIssues {
	const parsed = schema.safeParse(input);
	if (parsed.success || !parsed.error) return {};
	const issues: TFieldIssues = {};
	for (const formError of zodIssuesToFormErrors(parsed.error.issues, input)) {
		const field = formError.field ?? '';
		if (issues[field]) continue;
		issues[field] = formError.params ? { key: formError.key, params: formError.params } : { key: formError.key };
	}
	return issues;
}

/** The field issues of a failed request (RF-17). */
export function serverIssues(error: ApiError): TFieldIssues {
	const issues: TFieldIssues = {};
	for (const [field, entry] of Object.entries(error.fieldErrors)) {
		issues[field] = {
			...(entry.key ? { key: entry.key } : {}),
			...(entry.params ? { params: entry.params } : {}),
			message: entry.message,
		};
	}
	return issues;
}

/**
 * The issues to show now, in the form's field order.
 *
 * @param order - Field names top to bottom; also the focus order (RF-16)
 * @param local - Issues from the shared schema
 * @param server - Issues from the last failed save; they win over local ones
 * @param visible - Which fields may show an issue yet (left or submitted, RF-14)
 */
export function visibleIssues(
	order: readonly string[],
	local: TFieldIssues,
	server: TFieldIssues,
	visible: (field: string) => boolean,
): Array<[string, TFieldIssue]> {
	const result: Array<[string, TFieldIssue]> = [];
	const seen = new Set<string>();
	for (const field of [...order, ...Object.keys(server), ...Object.keys(local)]) {
		if (seen.has(field)) continue;
		seen.add(field);
		const issue = server[field] ?? (visible(field) ? local[field] : undefined);
		if (issue) result.push([field, issue]);
	}
	return result;
}

/** Moves the cursor to a control and brings it into view (RF-16). */
export function focusControl(id: string): void {
	const element = document.getElementById(id);
	if (!element) return;
	element.scrollIntoView({ block: 'center', behavior: 'smooth' });
	element.focus({ preventScroll: true });
}
