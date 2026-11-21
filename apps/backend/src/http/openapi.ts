/**
 * OpenAPI documentation helper for routes that validate with an explicit zod
 * `.parse()` in the handler (api-conventions: "Elysia route schemas or
 * explicit zod parse").
 *
 * Such a route has no `body:` schema, so `@elysia/openapi` cannot see its
 * input. {@link requestBodyDoc} publishes the SAME zod schema the handler
 * parses as the operation's `requestBody`, so `/docs` shows the real contract
 * without changing how the request is validated. The schema is converted
 * once, when the route is declared (ERP-0094).
 */
import { z } from 'zod';

type TJsonSchema = Record<string, unknown>;

/** The input-side JSON Schema of a zod schema (what a caller sends, before transforms). */
function inputJsonSchema(schema: z.ZodType): TJsonSchema {
	const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as TJsonSchema;
	return json;
}

/**
 * `detail` fields documenting a JSON request body.
 *
 * @param schema - The zod schema the handler parses the body with
 * @param options - `multipart: true` also lists `multipart/form-data` (the
 *   body then arrives as a JSON string in a `payload` field)
 */
export function requestBodyDoc(schema: z.ZodType, options: { multipart?: boolean } = {}) {
	const json = inputJsonSchema(schema);
	const content: Record<string, { schema: TJsonSchema }> = { 'application/json': { schema: json } };
	if (options.multipart) {
		content['multipart/form-data'] = {
			schema: { type: 'object', properties: { payload: { type: 'string', description: 'The JSON body as a string' } }, required: ['payload'] },
		};
	}
	return { requestBody: { required: true, content } };
}
