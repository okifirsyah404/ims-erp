/**
 * The domain plugin reports EVERY validation problem, each with its field and
 * a shared translation key (P7-6, TF-1, L-7).
 *
 * @remarks
 * Before P7-6 the plugin read only Elysia's first `valueError` and returned
 * Zod's English text, so a form with two wrong fields showed one English
 * message. The app below mounts the plugin behind the same i18next wiring as
 * `src/index.ts`, so the messages are the real `api` bundle text.
 */
import { describe, expect, test } from 'bun:test';
import { Elysia, t as tb } from 'elysia';
import { i18next } from 'elysia-i18next';
import { createInstance } from 'i18next';
import { z } from 'zod';
import { createLeadSchema } from '@ims-erp/common';
import { DEFAULT_LANGUAGE, LANGUAGE_CODES, en, id as idBundle } from '@ims-erp/locales';

import { domainPlugin } from '../../src/http/plugin';

type TBody = {
	status: number;
	message: string;
	errors: { field: string | null; key?: string; params?: Record<string, unknown>; message: string }[];
};

function makeApp() {
	const plugin = i18next({
		instance: createInstance(),
		initOptions: {
			fallbackLng: DEFAULT_LANGUAGE,
			supportedLngs: [...LANGUAGE_CODES],
			keySeparator: false,
			nsSeparator: ':',
			interpolation: { escapeValue: false },
			resources: { en, id: idBundle } as never,
		},
	}) as unknown as (app: Elysia) => Elysia;

	const routes = domainPlugin({ name: 'validation-test', prefix: '/validation', guards: 'none' })
		.post('/leads', ({ body }) => body, { body: createLeadSchema })
		.post('/items', ({ body }) => body, {
			body: z.object({ code: z.string().trim().min(1).max(5), quantity: z.number().int().min(1) }).strict(),
		})
		.post('/typebox', ({ body }) => body, {
			body: tb.Object({ name: tb.String({ minLength: 1 }), qty: tb.Number({ minimum: 0 }) }),
		})
		.post('/thrown', () => {
			z.object({ name: z.string().min(1) }).parse({ name: '' });
			return null;
		});
	return new Elysia().use(plugin).use(routes);
}

async function post(path: string, body: unknown, language = 'id'): Promise<{ status: number; body: TBody }> {
	const response = await makeApp().handle(
		new Request(`http://localhost/validation${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'accept-language': language },
			body: JSON.stringify(body),
		}),
	);
	return { status: response.status, body: (await response.json()) as TBody };
}

describe('domainPlugin — validation errors (P7-6)', () => {
	test('two wrong fields answer with two errors, each with field and key', async () => {
		const { status, body } = await post('/leads', { name: '', source: 'whatsapp' });
		expect(status).toBe(400);
		expect(body.errors.map(({ field, key }) => ({ field, key }))).toEqual([
			{ field: 'name', key: 'required' },
			{ field: 'contact', key: 'contactRequired' },
		]);
	});

	test('messages come from the api bundle in the request language, never Zod English', async () => {
		const id = await post('/leads', { name: '', source: 'whatsapp' }, 'id');
		expect(id.body.message).toBe('Validasi gagal');
		expect(id.body.errors[0]?.message).toBe('Wajib diisi.');
		expect(id.body.errors[1]?.message).toBe('Isi minimal satu kontak: telepon, WhatsApp, atau email.');

		const english = await post('/leads', { name: '', source: 'whatsapp' }, 'en');
		expect(english.body.errors[0]?.message).toBe('This field is required.');
		expect(JSON.stringify(english.body)).not.toContain('Too small');
	});

	test('limits carry their parameters for the form to word the message', async () => {
		const { body } = await post('/items', { code: 'TOO-LONG', quantity: 0 });
		expect(body.errors).toEqual([
			{ field: 'code', key: 'maxLength', params: { max: 5 }, message: 'Maksimal 5 karakter.' },
			{ field: 'quantity', key: 'min', params: { min: 1 }, message: 'Minimal 1.' },
		]);
	});

	test('a missing field is "required" and an unknown field is named', async () => {
		const { body } = await post('/items', { code: 'A1', extra: true });
		expect(body.errors.map(({ field, key }) => ({ field, key }))).toEqual([
			{ field: 'quantity', key: 'required' },
			{ field: 'extra', key: 'unknownField' },
		]);
	});

	test('a follow-up in the past is refused on create', async () => {
		const { body } = await post('/leads', {
			name: 'Budi',
			source: 'phone',
			phone: '081234567890',
			nextFollowUpAt: Date.now() - 24 * 60 * 60 * 1000,
		});
		expect(body.errors.map(({ field, key }) => ({ field, key }))).toEqual([
			{ field: 'nextFollowUpAt', key: 'notPast' },
		]);
	});

	test('TypeBox routes report every problem with a JSON-pointer path turned into a field', async () => {
		const { status, body } = await post('/typebox', { name: '', qty: -1 });
		expect(status).toBe(400);
		expect(body.errors.map(({ field, key }) => ({ field, key }))).toEqual([
			{ field: 'name', key: 'required' },
			{ field: 'qty', key: 'notNegative' },
		]);
	});

	test('a ZodError thrown by a handler is mapped the same way', async () => {
		const { status, body } = await post('/thrown', {});
		expect(status).toBe(400);
		expect(body.errors).toEqual([{ field: 'name', key: 'required', message: 'Wajib diisi.' }]);
	});

	test('a malformed JSON body answers 400 without echoing the body', async () => {
		const response = await makeApp().handle(
			new Request('http://localhost/validation/items', {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'accept-language': 'id' },
				body: '{"code": "secret-value"',
			}),
		);
		expect(response.status).toBe(400);
		const text = await response.text();
		expect(text).not.toContain('secret-value');
	});
});
