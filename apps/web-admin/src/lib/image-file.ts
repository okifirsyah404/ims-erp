/**
 * Picking and downscaling images before upload (ERP-0041), and the WebP
 * encoding the document logo and signature use (ERP-0044).
 *
 * @remarks
 * Only images are accepted; anything else (including a folder drag, which
 * surfaces as a non-image type) is rejected so the caller can toast instead of
 * trying to decode it. Two real-world quirks are handled:
 * - dragging from Explorer/Windows can hand over a file with an **empty MIME
 *   type**, so the extension is used as a fallback;
 * - decoding is the expensive step, so an oversized source is refused before
 *   it reaches the canvas (`MAX_IMAGE_SOURCE_BYTES`).
 *
 * Encoding never blocks the user: {@link encodeImage} prefers WebP but falls
 * back to PNG, because the server normalises whatever it receives to WebP.
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
 * most `maxSize` (default {@link DOCUMENT_IMAGE_MAX_SIZE}). Used by the
 * document logo/signature, where the 1024px print-size cap matters.
 *
 * @remarks
 * The backend caps the upload at 2MB, so the client keeps the payload small: a
 * 4000px photo re-encoded at quality 0.9 blows past the cap, while a 1024px
 * logo is still ~650dpi at 40mm print size. No PNG fallback here: the document
 * field needs the WebP size guarantee; {@link encodeImage} is the lenient path.
 *
 * @throws {Error} When the browser cannot decode the file, create a canvas, or
 * encode WebP (Safari < 14 has no WebP encoder)
 */
export async function encodeWebp(
	file: File,
	{ maxSize = DOCUMENT_IMAGE_MAX_SIZE }: { maxSize?: number } = {},
): Promise<Blob> {
	const { source, width, height, release } = await decodeImage(file);
	try {
		const dimensions = webpDimensions(width, height, maxSize);
		const canvas = document.createElement('canvas');
		canvas.width = dimensions.width;
		canvas.height = dimensions.height;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Canvas unavailable');
		context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
		const blob = await toBlob(canvas, 'image/webp', WEBP_QUALITY);
		if (blob?.type !== 'image/webp') throw new Error('WebP encoding failed');
		return blob;
	} finally {
		release();
	}
}

/** Result of {@link encodeImage}: bytes to upload plus their extension. */
export type TEncodedImage = { blob: Blob; extension: 'webp' | 'png' };

/**
 * Downscales a picked image so its longest side is at most `maxSize`, then
 * encodes it — WebP when the browser can, PNG otherwise.
 *
 * @remarks
 * The server accepts any format it can decode and normalises to WebP, so a
 * browser without a WebP encoder must not block the user: the PNG fallback is
 * already downscaled and stays well under the 2 MB upload cap. Decoding falls
 * back to an `<img>` element for formats `createImageBitmap` rejects but the
 * browser can still render (HEIC on Safari).
 *
 * @throws When the file cannot be decoded or encoded at all
 */
export async function encodeImage(
	file: File,
	{ maxSize = 512 }: { maxSize?: number } = {},
): Promise<TEncodedImage> {
	const canvas = await scaleToCanvas(file, maxSize);
	const webp = await toBlob(canvas, 'image/webp');
	if (webp?.type === 'image/webp') return { blob: webp, extension: 'webp' };
	const png = await toBlob(canvas, 'image/png');
	if (png) return { blob: png, extension: 'png' };
	throw new Error('Image encoding failed');
}

/** Draws `file` onto a canvas whose longest side is at most `maxSize`. */
async function scaleToCanvas(file: File, maxSize: number): Promise<HTMLCanvasElement> {
	const { source, width, height, release } = await decodeImage(file);
	try {
		const scale = Math.min(1, maxSize / Math.max(width, height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(width * scale));
		canvas.height = Math.max(1, Math.round(height * scale));
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Canvas not supported');
		context.drawImage(source, 0, 0, canvas.width, canvas.height);
		return canvas;
	} finally {
		release();
	}
}

/** Decodes a file to something drawable, preferring `createImageBitmap`. */
async function decodeImage(file: File): Promise<{
	source: CanvasImageSource;
	width: number;
	height: number;
	release: () => void;
}> {
	try {
		const bitmap = await createImageBitmap(file);
		return {
			source: bitmap,
			width: bitmap.width,
			height: bitmap.height,
			release: () => bitmap.close(),
		};
	} catch {
		const url = URL.createObjectURL(file);
		try {
			const image = await loadImage(url);
			return {
				source: image,
				width: image.naturalWidth,
				height: image.naturalHeight,
				release: () => URL.revokeObjectURL(url),
			};
		} catch (error) {
			URL.revokeObjectURL(url);
			throw error;
		}
	}
}

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('Image could not be read'));
		image.src = url;
	});
}

function toBlob(
	canvas: HTMLCanvasElement,
	type: string,
	quality = 0.9,
): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
