/**
 * Images printed on documents (letterhead logo, signature and stamp, item
 * photos). One rule set for every upload: any image the server can decode
 * (PNG, JPG, WebP, GIF, BMP, TIFF, HEIC, AVIF) up to 2 MB, normalised to WebP
 * and stored under a fresh key so an issued document that snapshotted the old
 * key keeps its picture.
 */
import { AppError } from '@http/errors';
import { fileBytes, toWebp, UnsupportedImageError } from '@utils/image.util';
import type { IObjectStorage } from './object-storage';

export const MAX_DOCUMENT_IMAGE_MB = 2;

/** Not a decodable image, or too large. */
export class DocumentImageInvalidError extends AppError {
	constructor(max: number = MAX_DOCUMENT_IMAGE_MB) {
		super(
			422,
			'common.imageInvalid',
			'Upload a PNG, JPG, WebP or HEIC image',
			{ max },
		);
	}
}

/**
 * The multipart `file` field, or a 422 when it is missing or oversized.
 *
 * @remarks
 * Only shape and size are checked here; the format is decided from the actual
 * bytes in {@link storeDocumentImage}, because the multipart `Content-Type` is
 * client-supplied.
 */
export function documentImageFrom(
	body: unknown,
	{ field = 'file', maxMb = MAX_DOCUMENT_IMAGE_MB }: { field?: string; maxMb?: number } = {},
): File {
	const file =
		body && typeof body === 'object' ? (body as Record<string, unknown>)[field] : undefined;
	if (!(file instanceof File) || file.size === 0 || file.size > maxMb * 1024 * 1024) {
		throw new DocumentImageInvalidError(maxMb);
	}
	return file;
}

/**
 * Normalises the image to WebP and stores it under `<prefix>/<uuid>.webp`.
 *
 * @throws DocumentImageInvalidError when the bytes cannot be decoded
 */
export async function storeDocumentImage(
	storage: IObjectStorage,
	prefix: string,
	file: File,
	/** Longest side in pixels; a letterhead spans the page, so it keeps more than a logo. */
	{ maxSize }: { maxSize?: number } = {},
): Promise<string> {
	let webp: Buffer;
	try {
		webp = await toWebp(await fileBytes(file), maxSize ? { maxSize } : undefined);
	} catch (error) {
		if (error instanceof UnsupportedImageError) throw new DocumentImageInvalidError();
		throw error;
	}
	const key = `${prefix}/${crypto.randomUUID()}.webp`;
	await storage.put(key, webp, 'image/webp');
	return key;
}

/** Inline URL for `<img>` (one hour; prints load it straight away). */
export function documentImageUrl(storage: Pick<IObjectStorage, 'presignGet'>, key: string | null): string | null {
	return key ? storage.presignGet(key, { fileName: key.split('/').pop() ?? 'image', inline: true, expiresIn: 3600 }) : null;
}
