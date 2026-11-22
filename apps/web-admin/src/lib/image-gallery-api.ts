import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { encodeImage } from './image-file';

/**
 * Image galleries of products, components, materials, assets and warehouses.
 *
 * @remarks
 * Every owner exposes the same routes under its own path (`/products/:id`,
 * `/inventory/items/:id`, `/warehouses/:id`): `GET|POST /images`,
 * `PUT /images/order`, `PATCH|DELETE /images/:imageId`. The first image is the
 * cover. The browser downscales each file first, so the payload stays under the
 * 2 MB upload cap; the server normalises to WebP.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Server cap per owner. */
export const MAX_GALLERY_IMAGES = 10;

/** Longest side of an uploaded gallery image. */
const GALLERY_IMAGE_MAX_SIZE = 1280;

export type TGalleryImage = {
	id: string;
	url: string | null;
	caption: string | null;
	sortOrder: number;
};

async function send<T>(path: string, init: RequestInit): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		...init,
		headers: { 'Accept-Language': currentLanguage(), ...init.headers },
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope.data as T;
}

const json = { 'Content-Type': 'application/json' };

/** Query key of one owner's gallery (`entityPath` is e.g. `/products/<id>`). */
export const galleryQueryKey = (entityPath: string) => ['image-gallery', entityPath] as const;

export function galleryQueryOptions(entityPath: string) {
	return queryOptions({
		queryKey: galleryQueryKey(entityPath),
		queryFn: () => send<TGalleryImage[]>(`${entityPath}/images`, { method: 'GET' }),
	});
}

/**
 * Uploads files one after another so the order of the pick is the gallery
 * order. A failed file does not stop the rest.
 *
 * @returns The error messages of the files that failed (empty on full success)
 */
export async function uploadGalleryImages(entityPath: string, files: File[]): Promise<string[]> {
	const errors: string[] = [];
	for (const file of files) {
		try {
			const encoded = await encodeImage(file, { maxSize: GALLERY_IMAGE_MAX_SIZE });
			const body = new FormData();
			body.set('file', encoded.blob, `image.${encoded.extension}`);
			await send(`${entityPath}/images`, { method: 'POST', body });
		} catch (cause) {
			errors.push(cause instanceof Error ? cause.message : String(cause));
		}
	}
	return errors;
}

export function removeGalleryImage(entityPath: string, imageId: string): Promise<unknown> {
	return send(`${entityPath}/images/${imageId}`, { method: 'DELETE' });
}

/** Full new order; the first id becomes the cover. */
export function reorderGalleryImages(entityPath: string, imageIds: string[]): Promise<TGalleryImage[]> {
	return send(`${entityPath}/images/order`, {
		method: 'PUT',
		headers: json,
		body: JSON.stringify({ imageIds }),
	});
}

export function updateGalleryCaption(
	entityPath: string,
	imageId: string,
	caption: string | null,
): Promise<TGalleryImage> {
	return send(`${entityPath}/images/${imageId}`, {
		method: 'PATCH',
		headers: json,
		body: JSON.stringify({ caption }),
	});
}
