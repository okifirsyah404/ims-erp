/**
 * Server-side image normalisation.
 *
 * @remarks
 * Every stored image is WebP, produced here — never taken from the client as
 * WebP and never trusted from a third-party API. Two consequences matter:
 * a browser without a WebP encoder (or an iPhone HEIC photo) is not a reason
 * to make the user convert by hand, and re-encoding drops EXIF/GPS metadata
 * and anything appended after the image data.
 *
 * `Bun.Image` (built into Bun, no dependency) decodes JPEG, PNG, WebP, GIF,
 * BMP, TIFF, HEIC and AVIF — verified on Bun 1.4.4.
 */

/** Formats {@link sniffImageType} can recognise by magic bytes. */
export const SUPPORTED_IMAGE_TYPES = [
	'png',
	'jpeg',
	'webp',
	'gif',
	'bmp',
	'tiff',
	'heic',
	'avif',
] as const;

export type TImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

/** Bytes that are not a decodable image. */
export class UnsupportedImageError extends Error {
	constructor() {
		super('Unsupported image');
		this.name = 'UnsupportedImageError';
	}
}

/** Default ceiling for the longest side of a stored image. */
export const DEFAULT_IMAGE_MAX_SIZE = 512;

/**
 * Recognises an image format from its first bytes.
 *
 * @returns The format, or `null` when no signature matches.
 *
 * @remarks
 * The declared `Content-Type` is spoofable, so it is only used to pick a key
 * extension — never to decide whether a file is an image.
 */
export function sniffImageType(bytes: Uint8Array): TImageType | null {
	const at = (offset: number, ...values: number[]) =>
		values.every((value, index) => bytes[offset + index] === value);

	if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'png';
	if (at(0, 0xff, 0xd8, 0xff)) return 'jpeg';
	// RIFF container with the WEBP form type at bytes 8-11.
	if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) {
		return 'webp';
	}
	if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'gif';
	if (at(0, 0x42, 0x4d)) return 'bmp';
	// TIFF, little- and big-endian.
	if (at(0, 0x49, 0x49, 0x2a, 0x00) || at(0, 0x4d, 0x4d, 0x00, 0x2a)) {
		return 'tiff';
	}
	// ISO-BMFF: `ftyp` at byte 4, then the HEIC/HEIF or AVIF brand.
	if (at(4, 0x66, 0x74, 0x79, 0x70)) {
		const brand = String.fromCharCode(...bytes.subarray(8, 12));
		if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) {
			return 'heic';
		}
		if (['avif', 'avis'].includes(brand)) return 'avif';
	}
	return null;
}

/**
 * Re-encodes any supported image to WebP, downscaling so the longest side is
 * at most `maxSize`.
 *
 * @param input - Raw image bytes (already size-capped by the caller)
 * @param options.maxSize - Longest side ceiling in pixels
 * @param options.quality - WebP quality (0-100)
 *
 * @throws {@link UnsupportedImageError} when the bytes cannot be decoded
 */
export async function toWebp(
	input: Uint8Array | ArrayBuffer | Buffer,
	{
		maxSize = DEFAULT_IMAGE_MAX_SIZE,
		quality = 85,
	}: { maxSize?: number; quality?: number } = {},
): Promise<Buffer> {
	const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
	try {
		const image = new Bun.Image(bytes);
		const { width, height } = await image.metadata();
		const longest = Math.max(width, height);
		if (longest <= maxSize) {
			return await image.webp({ quality }).buffer();
		}
		// `fit: inside` preserves the aspect ratio, so passing the ceiling for
		// both axes yields the largest box that fits.
		return await new Bun.Image(bytes)
			.resize(maxSize, maxSize, { fit: 'inside' })
			.webp({ quality })
			.buffer();
	} catch {
		throw new UnsupportedImageError();
	}
}

/** Bytes of a `File`/`Blob` (multipart upload) as a `Uint8Array`. */
export async function fileBytes(file: Blob): Promise<Uint8Array> {
	return new Uint8Array(await file.arrayBuffer());
}
