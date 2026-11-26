/**
 * An error no mapper recognises must still answer with the JSON envelope.
 *
 * @remarks
 * A failed Drizzle query used to fall through to Elysia's plain-text body
 * (`Failed query: update ...`), which the web admin then failed to parse
 * ("Unexpected token 'F'") and which leaked SQL to the browser. The plugin now
 * answers 500 with the standard envelope and a generic message.
 */
import { describe, expect, test } from 'bun:test';

import { domainPlugin } from '../../src/http/plugin';

describe('domainPlugin — unhandled errors', () => {
	const app = domainPlugin({ name: 'unhandled-test', prefix: '/unhandled', guards: 'none' }).get('/boom', () => {
		throw new Error('Failed query: update "procurement"."purchase_orders" set "code" = $1');
	});

	test('answers 500 with the JSON envelope, not plain text', async () => {
		const response = await app.handle(new Request('http://localhost/unhandled/boom'));
		expect(response.status).toBe(500);
		expect(response.headers.get('content-type') ?? '').toContain('application/json');
		const body = (await response.json()) as { status: number; data: unknown; errors: unknown[]; message: string };
		expect(body.status).toBe(500);
		expect(body.data).toBeNull();
		expect(Array.isArray(body.errors)).toBe(true);
	});

	test('never sends the SQL or the error text to the client', async () => {
		const response = await app.handle(new Request('http://localhost/unhandled/boom'));
		const text = await response.text();
		expect(text).not.toContain('Failed query');
		expect(text).not.toContain('purchase_orders');
	});
});
