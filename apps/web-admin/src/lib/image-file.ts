/**
 * Picking and downscaling images before upload (ERP-0041).
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

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
}
