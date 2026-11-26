import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { encodeWebp } from './image-file';

/**
 * API client for letterhead (kop surat) templates (`/companies/letterheads`,
 * ERP-0165).
 *
 * @remarks
 * Any member may read them (prints need them); managing them needs
 * `company:update`. Images are sent as WebP, downscaled in the browser to the
 * A4 width at 300 dpi, so a banner stays sharp on paper and the upload stays
 * below the server cap.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Longest side of an uploaded letterhead image (A4 width at 300 dpi), as the server keeps it. */
export const LETTERHEAD_IMAGE_MAX_PX = 2480;

/** Server-side cap on one uploaded letterhead image. */
export const LETTERHEAD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type TLetterhead = {
	id: string;
	name: string;
	isDefault: boolean;
	headerUrl: string | null;
	footerUrl: string | null;
	updatedAt: string;
};

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
	const json = init.body != null && !(init.body instanceof FormData);
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		...init,
		headers: {
			'Accept-Language': currentLanguage(),
			// A FormData body sets its own multipart boundary.
			...(json ? { 'Content-Type': 'application/json' } : {}),
		},
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope.data as T;
}

/** A picked image as the WebP part the server stores. */
export async function letterheadImagePart(file: File): Promise<File> {
	const webp = await encodeWebp(file, { maxSize: LETTERHEAD_IMAGE_MAX_PX });
	return new File([webp], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
}

export function letterheadsQueryOptions() {
	return queryOptions({
		queryKey: ['company', 'letterheads'] as const,
		queryFn: () => send<TLetterhead[]>('/companies/letterheads'),
	});
}

/** `header` and `footer` must already be WebP parts ({@link letterheadImagePart}). */
export function createLetterhead(input: { name: string; isDefault: boolean; header: File; footer: File | null }) {
	const body = new FormData();
	body.set('name', input.name);
	body.set('isDefault', String(input.isDefault));
	body.set('header', input.header);
	if (input.footer) body.set('footer', input.footer);
	return send<TLetterhead>('/companies/letterheads', { method: 'POST', body });
}

export function updateLetterhead(id: string, input: { name?: string; isDefault?: boolean }) {
	return send<TLetterhead>(`/companies/letterheads/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function replaceLetterheadImage(id: string, kind: 'header' | 'footer', file: File) {
	const body = new FormData();
	body.set('file', file);
	return send<TLetterhead>(`/companies/letterheads/${id}/${kind}`, { method: 'PUT', body });
}

export const removeLetterheadFooter = (id: string) => send<TLetterhead>(`/companies/letterheads/${id}/footer`, { method: 'DELETE' });
export const deleteLetterhead = (id: string) => send<null>(`/companies/letterheads/${id}`, { method: 'DELETE' });
