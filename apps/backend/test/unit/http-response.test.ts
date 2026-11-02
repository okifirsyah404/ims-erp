/**
 * Envelope-shape regression tests.
 *
 * @remarks
 * The W3 refactor replaced six hand-rolled copies of the response helpers
 * with one implementation. These tests pin the observable wire shapes so a
 * future "tidy" cannot silently change them again.
 *
 * `errors` is optional on `TApiResponse`, so success envelopes deliberately
 * omit it (matching what every controller shipped before the refactor) while
 * error envelopes always carry it.
 */
import { describe, expect, test } from 'bun:test';
import {
	buildMeta,
	created,
	errorEnvelope,
	noContent,
	ok,
	okPaginated,
} from '@http/response';
import type { TPaginationResult } from '@ims-erp/common';

const ISO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('response envelope', () => {
	test('buildMeta fills the four request-scoped fields', () => {
		const meta = buildMeta(200, 'OK');
		expect(meta.requestId).toMatch(ISO_UUID);
		expect(meta.status).toBe(200);
		expect(meta.message).toBe('OK');
		expect(typeof meta.timestamp).toBe('number');
	});

	test('ok omits errors and carries the row', () => {
		const response = ok({ id: 'row-1' });
		expect(response).toEqual({
			requestId: expect.any(String),
			status: 200,
			message: 'OK',
			timestamp: expect.any(Number),
			data: { id: 'row-1' },
		});
		expect('errors' in response).toBe(false);
	});

	test('created uses 201 + Created', () => {
		const response = created({ id: 'row-1' });
		expect(response.status).toBe(201);
		expect(response.message).toBe('Created');
		expect('errors' in response).toBe(false);
	});

	test('noContent returns a 200 with null data', () => {
		const response = noContent();
		expect(response.status).toBe(200);
		expect(response.data).toBeNull();
	});

	test('okPaginated maps a TPaginationResult meta onto pagination', () => {
		const result: TPaginationResult<{ id: string }> = {
			data: [{ id: 'a' }, { id: 'b' }],
			meta: { page: 2, limit: 10, total: 57, totalPages: 6 },
		};
		const response = okPaginated(result);
		expect(response.pagination).toEqual(result.meta);
		expect(response.data).toHaveLength(2);
		expect(response.status).toBe(200);
	});

	test('errorEnvelope always carries an errors array', () => {
		const withMessages = errorEnvelope(404, 'Not found', [
			{ field: null, message: 'gone' },
		]);
		expect(withMessages.errors).toEqual([{ field: null, message: 'gone' }]);
		expect(withMessages.data).toBeNull();
		expect(withMessages.status).toBe(404);

		// Omitted errors default to an empty array, never undefined.
		expect(errorEnvelope(500, 'Boom').errors).toEqual([]);
	});

	test('generated requestIds are unique per call', () => {
		expect(buildMeta(200, 'OK').requestId).not.toBe(
			buildMeta(200, 'OK').requestId,
		);
	});
});
