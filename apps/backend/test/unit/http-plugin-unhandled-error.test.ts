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
import { Elysia } from 'elysia';
import { errorRef } from '@ims-erp/common';

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

	test('carries a reference derived from the envelope requestId (RF-27, P7-6)', async () => {
		const response = await app.handle(new Request('http://localhost/unhandled/boom'));
		const body = (await response.json()) as { requestId: string; message: string };
		const ref = errorRef(body.requestId);
		expect(ref).toMatch(/^[0-9A-F]{8}$/);
		// Without the i18n plugin the translator answers with the key; the
		// reference still reaches the client through `requestId`.
		expect(body.message).toBe('common.internalError');
	});

	test('the translated message names the reference', async () => {
		const translated = new Elysia()
			.derive({ as: 'global' }, () => ({
				t: (key: string, options?: { ref?: string }) => `${key} (ref: ${options?.ref ?? ''})`,
			}))
			.use(
				domainPlugin({ name: 'unhandled-ref-test', prefix: '/unhandled-ref', guards: 'none' }).get('/boom', () => {
					throw new Error('boom');
				}),
			);
		const response = await translated.handle(new Request('http://localhost/unhandled-ref/boom'));
		const body = (await response.json()) as { requestId: string; message: string };
		expect(body.message).toBe(`api:common.internalError (ref: ${errorRef(body.requestId)})`);
	});

	test('never sends the SQL or the error text to the client', async () => {
		const response = await app.handle(new Request('http://localhost/unhandled/boom'));
		const text = await response.text();
		expect(text).not.toContain('Failed query');
		expect(text).not.toContain('purchase_orders');
	});
});
