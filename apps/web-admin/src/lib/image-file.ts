/**
 * Which file a click/drop should hand to the uploader (ERP-0041), and how it
 * becomes the WebP the backend stores (ERP-0044).
 *
 * @remarks
 * Only images are accepted; anything else (including a folder drag, which
 * surfaces as a non-image type) is rejected so the caller can toast instead of
 * trying to decode it into WebP. Two real-world quirks are handled:
 * - dragging from Explorer/Windows can hand over a file with an **empty MIME
 *   type**, so the extension is used as a fallback;
 * - decoding is the expensive step, so an oversized source is refused before
 *   it reaches the canvas (`MAX_IMAGE_SOURCE_BYTES`).
 */

/** Largest source image worth decoding (the output is downscaled to 512px). */
export const MAX_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;

/** Longest output side for a logo/signature printed on a document (ERP-0044). */
export const DOCUMENT_IMAGE_MAX_SIZE = 1024;

/** WebP quality used for every client-side encode. */
const WEBP_QUALITY = 0.9;

/** Extensions accepted when the browser reports no MIME type. */
const IMAGE_EXTENSIONS = new Set([
	'png',
	'jpg',
	'jpeg',
	'webp',
	'gif',
	'avif',
	'bmp',
]);

/** Why a picked file was refused, so the caller can show the right message. */
export type TImageRejectReason = 'type' | 'size';

/**
 * Validates a picked file against the dropzone rules.
 *
 * @returns `null` when accepted, otherwise the rejection reason.
 */
export function rejectImageFile(
	file: File | null | undefined,
): TImageRejectReason | null {
	if (!file) return null;
	if (!isImage(file)) return 'type';
	if (file.size > MAX_IMAGE_SOURCE_BYTES) return 'size';
	return null;
}

/** Accepted file for a click/drop, or `null` (folder, non-image, too large). */
export function pickImageFile(file: File | null | undefined): File | null {
	return rejectImageFile(file) === null && file ? file : null;
}

function isImage(file: File): boolean {
	if (file.type.startsWith('image/')) return true;
	if (file.type) return false;
	const extension = file.name.toLowerCase().split('.').pop() ?? '';
	return IMAGE_EXTENSIONS.has(extension);
}

/**
 * Output dimensions after downscaling, never upscaling.
 *
 * @remarks
 * Pure so the rule is testable without a DOM: `scale` is clamped to 1, so a
 * 64px icon stays 64px, and both sides round to at least 1px.
 */
export function webpDimensions(
	width: number,
	height: number,
	maxSize: number = DOCUMENT_IMAGE_MAX_SIZE,
): { width: number; height: number } {
	const scale = Math.min(1, maxSize / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}

/**
 * Encodes a picked image to WebP, downscaling it so the longest side is at
 * most `maxSize` (default {@link DOCUMENT_IMAGE_MAX_SIZE}).
 *
 * @remarks
 * The backend caps the upload at 2MB and validates magic bytes only, so the
 * client must keep the payload small: a 4000px photo re-encoded at quality 0.9
 * blows past the cap, while a 1024px logo is still ~650dpi at 40mm print size.
 * `createImageBitmap` rejects formats the browser cannot decode (e.g. HEIC).
 *
 * @throws {Error} When the browser cannot create a canvas or the WebP encode
 * fails (Safari < 14 has no WebP encoder)
 */
export async function encodeWebp(
	file: File,
	{ maxSize = DOCUMENT_IMAGE_MAX_SIZE }: { maxSize?: number } = {},
): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	const { width, height } = webpDimensions(bitmap.width, bitmap.height, maxSize);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (!context) {
		bitmap.close();
		throw new Error('Canvas unavailable');
	}
	context.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) =>
				blob && blob.type === 'image/webp'
					? resolve(blob)
					: reject(new Error('WebP encoding failed')),
			'image/webp',
			WEBP_QUALITY,
		);
	});
}
