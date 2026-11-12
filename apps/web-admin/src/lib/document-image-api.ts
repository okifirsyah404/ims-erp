import type { TApiResponse } from '@ims-erp/common';
import { currentLanguage } from '@/i18n';

/**
 * Upload and removal of images printed on documents (company logo and
 * signature, item photos). The client converts to WebP before uploading
 * (`lib/image-file.ts`); the server caps the payload at 2 MB and checks the
 * magic bytes again. Multipart, so the JSON request helpers do not fit.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Server-side cap on the uploaded WebP. */
export const DOCUMENT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

async function send<T>(path: string, init: RequestInit): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: { 'Accept-Language': currentLanguage() },
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope.data as T;
}

export function uploadDocumentImage<T>(path: string, file: File): Promise<T> {
	const body = new FormData();
	body.set('file', file);
	return send<T>(path, { method: 'PUT', body });
}

export function removeDocumentImage<T>(path: string): Promise<T> {
	return send<T>(path, { method: 'DELETE' });
}
