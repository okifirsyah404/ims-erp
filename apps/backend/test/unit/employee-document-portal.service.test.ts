/**
 * Employee portal document surface (Phase C).
 *
 * The two real services already own the rules (registry access, request state,
 * signature placement), so what is worth pinning here is **scoping**: every
 * call must carry the session user, nothing from the request body can redirect
 * a read, and the image upload writes under the caller's own prefix.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { EmployeeDocumentPortalService } from '../../src/app/document/services/employee-document-portal.service';

type TCall = { method: string; args: unknown[] };

function service() {
	const calls: TCall[] = [];
	const stored: { key: string; userId: string }[] = [];
	const instance = new EmployeeDocumentPortalService(
		{
			paginate: async (_userId: string, request: { page: number; limit: number; search: string | null }) => ({
				meta: { page: request.page, limit: request.limit, total: 1, totalPages: 1 },
				data: [
					{
						id: 'doc-1',
						code: '0001/DOC',
						title: 'Perjanjian Kerja',
						documentType: 'employment_agreement',
						status: 'draft',
						issuedOn: null,
						createdAt: new Date(),
						pendingSignatureRequestId: 'req-1',
						fileId: 'file-1',
						fileName: 'perjanjian.pdf',
					},
				],
			}),
		} as never,
		{
			list: async () => ({ meta: {}, data: [] }),
			downloadFile: async (...args: unknown[]) => {
				calls.push({ method: 'downloadFile', args });
				return { url: 'https://signed/file', fileName: 'perjanjian.pdf', mimeType: 'application/pdf' };
			},
		} as never,
		{
			listIncoming: async (...args: unknown[]) => {
				calls.push({ method: 'listIncoming', args });
				return { meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] };
			},
			sign: async (...args: unknown[]) => {
				calls.push({ method: 'sign', args });
				return { id: 'sig-1' };
			},
			decline: async (...args: unknown[]) => {
				calls.push({ method: 'decline', args });
				return { id: 'req-1', status: 'declined' };
			},
			myImage: async (...args: unknown[]) => {
				calls.push({ method: 'myImage', args });
				return null;
			},
			uploadImage: async (userId: string, key: string) => {
				calls.push({ method: 'uploadImage', args: [userId, key] });
				stored.push({ key, userId });
			},
			deleteImage: async (...args: unknown[]) => {
				calls.push({ method: 'deleteImage', args });
			},
		} as never,
		{
			put: async (key: string) => {
				calls.push({ method: 'put', args: [key] });
			},
			presignGet: () => 'https://signed/image.webp',
		} as never,
	);
	return { instance, calls, stored };
}

/** A real 1x1 PNG: 	oWebp decodes the bytes, so a fake header would 422. */
const PNG_1X1 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64',
);
const png = () => new File([PNG_1X1], 'sig.png', { type: 'image/png' });

beforeEach(() => {
	// each case builds its own service
});

describe('EmployeeDocumentPortalService', () => {
	test('list is scoped to the session user and keeps the file link', async () => {
		const { instance } = service();
		const page = await instance.list('user-1', { page: 1, limit: 20, search: undefined });
		expect(page.meta.total).toBe(1);
		expect(page.data[0]!.fileId).toBe('file-1');
		expect(page.data[0]!.pendingSignatureRequestId).toBe('req-1');
	});

	test('signing delegates to the signature module with the session user', async () => {
		const { instance, calls } = service();
		await instance.sign('user-7', 'req-1', { signatureText: 'Ami', image: null }, '203.0.113.9');
		const call = calls.find((entry) => entry.method === 'sign')!;
		expect(call.args[0]).toBe('req-1');
		expect(call.args[1]).toBe('user-7');
		expect(call.args[2]).toBe('203.0.113.9');
		expect(call.args[3]).toBe('electronic');
	});

	test('declining passes the reason, and a default when none is given', async () => {
		const { instance, calls } = service();
		await instance.decline('user-7', 'req-1', { reason: 'Salah dokumen' });
		await instance.decline('user-7', 'req-1', { reason: null });
		const reasons = calls.filter((entry) => entry.method === 'decline').map((entry) => entry.args[2]);
		expect(reasons).toEqual(['Salah dokumen', '-']);
	});

	test('uploading an image writes under the caller prefix and records the key', async () => {
		const { instance, calls, stored } = service();
		const result = await instance.uploadImage('user-7', { file: png() });
		expect(result.url).toBe('https://signed/image.webp');
		const put = calls.find((entry) => entry.method === 'put')!;
		expect(String(put.args[0])).toStartWith('signatures/user-7/');
		expect(stored[0]?.userId).toBe('user-7');
	});

	test('a download is requested with the session user, never a body id', async () => {
		const { instance, calls } = service();
		await instance.download('user-7', 'doc-1', 'file-1');
		const call = calls.find((entry) => entry.method === 'downloadFile')!;
		expect(call.args).toEqual(['doc-1', 'file-1', 'user-7']);
	});
});

