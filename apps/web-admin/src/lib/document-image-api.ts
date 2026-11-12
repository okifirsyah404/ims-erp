import type { TApiResponse } from '@ims-erp/common';
import { currentLanguage } from '@/i18n';
import { encodeImage, MAX_IMAGE_SOURCE_BYTES } from './image-file';

/**
 * Upload and removal of images printed on documents (company logo and
 * signature, item photos).
 *
 * @remarks
 * Any image the browser can decode is accepted; the client downscales it
 * (WebP when it can, PNG otherwise) so the payload stays far below the 2 MB
 * upload cap, and the server normalises the bytes to WebP for storage.
 * Multipart, so the JSON request helpers do not fit.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const DOCUMENT_IMAGE_ACCEPT =
	'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,image/heic,image/heif';

/** Largest source worth decoding; the uploaded blob itself is much smaller. */
export const DOCUMENT_IMAGE_MAX_BYTES = MAX_IMAGE_SOURCE_BYTES;

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

export async function uploadDocumentImage<T>(path: string, file: File): Promise<T> {
	const encoded = await encodeImage(file);
	const body = new FormData();
	body.set('file', encoded.blob, `image.${encoded.extension}`);
	return send<T>(path, { method: 'PUT', body });
}

export function removeDocumentImage<T>(path: string): Promise<T> {
	return send<T>(path, { method: 'DELETE' });
}
