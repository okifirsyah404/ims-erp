import { describe, expect, test } from 'bun:test';
import { createLeadSchema, errorRef } from '@ims-erp/common';

import { ApiError, networkError, readApiError, readEnvelope } from '../../src/lib/api-error';
import { schemaIssues, serverIssues, visibleIssues } from '../../src/lib/form-validation';

const REQUEST_ID = '3f2a9c1b-0d4e-4f5a-9b6c-7d8e9f0a1b2c';

const envelope = (status: number, message: string, errors: unknown[]) => ({
	requestId: REQUEST_ID,
	status,
	message,
	timestamp: 0,
	data: null,
	errors,
});

describe('readApiError (P7-6, TF-2)', () => {
	test('keeps every field error with its key, not only the first message', () => {
		const error = readApiError(
			envelope(400, 'Validasi gagal', [
				{ field: 'name', key: 'required', message: 'Wajib diisi.' },
				{ field: 'contact', key: 'contactRequired', message: 'Isi minimal satu kontak: telepon, WhatsApp, atau email.' },
				{ field: 'code', key: 'maxLength', params: { max: 5 }, message: 'Maksimal 5 karakter.' },
			]) as never,
			400,
		);
		expect(error).toBeInstanceOf(ApiError);
		expect(error.status).toBe(400);
		expect(Object.keys(error.fieldErrors)).toEqual(['name', 'contact', 'code']);
		expect(error.fieldErrors.code).toEqual({ key: 'maxLength', params: { max: 5 }, message: 'Maksimal 5 karakter.' });
		// Old callers that only read `message` still get the first problem.
		expect(error.message).toBe('Wajib diisi.');
		expect(error.ref).toBeNull();
	});

	test('errors without a field go to the form summary; an unknown key is dropped', () => {
		const error = readApiError(
			envelope(409, 'Konflik', [
				{ field: null, message: 'Prospek sudah dikonversi.' },
				{ field: 'phone', key: 'notAKey', message: 'Nomor sudah dipakai.' },
			]) as never,
			409,
		);
		expect(error.formErrors).toEqual(['Prospek sudah dikonversi.']);
		expect(error.fieldErrors.phone).toEqual({ message: 'Nomor sudah dipakai.' });
	});

	test('a server fault carries the reference from requestId and keeps the server message (RF-27)', () => {
		const message = `Terjadi kesalahan di server (ref: ${errorRef(REQUEST_ID)}). Coba lagi atau laporkan nomor ini ke admin.`;
		const error = readApiError(envelope(500, message, []) as never, 500);
		expect(error.ref).toBe('3F2A9C1B');
		expect(error.message).toBe(message);
		expect(error.fieldErrors).toEqual({});
	});

	test('a field error shows no reference', () => {
		const error = readApiError(envelope(400, 'Validasi gagal', [{ field: 'name', message: 'x' }]) as never, 400);
		expect(error.ref).toBeNull();
	});

	test('a non-JSON body still becomes an ApiError with the status', async () => {
		const failure = readEnvelope(new Response('Bad Gateway', { status: 502 }));
		await expect(failure).rejects.toBeInstanceOf(ApiError);
		await failure.catch((error: ApiError) => {
			expect(error.status).toBe(502);
			expect(error.ref).toBeNull();
		});
	});

	test('a request that never reached the server is a network error (RF-19)', () => {
		const error = networkError(new TypeError('Failed to fetch'));
		expect(error.isNetworkError).toBe(true);
		expect(error.status).toBe(0);
	});
});

describe('form issues from the shared schema and the server', () => {
	test('the lead schema reports name and contact for an empty form, with their keys', () => {
		const issues = schemaIssues(createLeadSchema, {
			name: '',
			companyName: null,
			phone: null,
			whatsapp: null,
			email: null,
			source: 'whatsapp',
			needs: null,
			estimatedValue: null,
			nextFollowUpAt: null,
		});
		expect(issues).toEqual({ name: { key: 'required' }, contact: { key: 'contactRequired' } });
	});

	test('a bad email is an invalid format, not "required"', () => {
		const issues = schemaIssues(createLeadSchema, { name: 'Budi', source: 'phone', email: 'budi@' });
		expect(issues.email).toEqual({ key: 'invalidFormat' });
	});

	test('server issues map onto the same field names', () => {
		const error = readApiError(
			envelope(400, 'Validasi gagal', [{ field: 'phone', key: 'taken', params: { value: '0812' }, message: 'x' }]) as never,
			400,
		);
		expect(serverIssues(error)).toEqual({ phone: { key: 'taken', params: { value: '0812' }, message: 'x' } });
	});

	test('issues follow the form order; untouched fields stay quiet until a save, server issues always show', () => {
		const local = { needs: { key: 'maxLength' as const }, name: { key: 'required' as const } };
		const server = { phone: { message: 'Nomor sudah dipakai.' } };
		const order = ['name', 'phone', 'needs'];
		expect(visibleIssues(order, local, server, () => false).map(([field]) => field)).toEqual(['phone']);
		expect(visibleIssues(order, local, server, () => true).map(([field]) => field)).toEqual(['name', 'phone', 'needs']);
	});
});
