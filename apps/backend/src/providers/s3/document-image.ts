/**
 * Images printed on documents (letterhead logo, signature and stamp, item
 * photos). One rule set for every upload: PNG, JPG or WebP up to 2 MB, stored
 * under a fresh key so an issued document that snapshotted the old key keeps
 * its picture.
 */
import { AppError } from '@http/errors';
import type { IObjectStorage } from './object-storage';

const IMAGE_TYPES: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
};

export const MAX_DOCUMENT_IMAGE_MB = 2;

/** Not an image we print, or too large. */
export class DocumentImageInvalidError extends AppError {
	constructor() {
		super(422, 'common.imageInvalid', 'Upload a PNG, JPG or WebP image', { max: MAX_DOCUMENT_IMAGE_MB });
	}
}

/** The multipart `file` field, or a 422 when it is missing or not an image. */
export function documentImageFrom(body: unknown): File {
	const file = body && typeof body === 'object' ? (body as { file?: unknown }).file : undefined;
	if (!(file instanceof File) || !IMAGE_TYPES[file.type] || file.size === 0 || file.size > MAX_DOCUMENT_IMAGE_MB * 1024 * 1024) {
		throw new DocumentImageInvalidError();
	}
	return file;
}

/** Stores the image under `<prefix>/<uuid>.<ext>` and returns the key. */
export async function storeDocumentImage(storage: IObjectStorage, prefix: string, file: File): Promise<string> {
	const key = `${prefix}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
	await storage.put(key, file, file.type);
	return key;
}

/** Inline URL for `<img>` (one hour; prints load it straight away). */
export function documentImageUrl(storage: Pick<IObjectStorage, 'presignGet'>, key: string | null): string | null {
	return key ? storage.presignGet(key, { fileName: key.split('/').pop() ?? 'image', inline: true, expiresIn: 3600 }) : null;
}
