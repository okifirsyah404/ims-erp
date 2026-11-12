/**
 * Which file a click/drop should hand to the uploader (ERP-0041).
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
