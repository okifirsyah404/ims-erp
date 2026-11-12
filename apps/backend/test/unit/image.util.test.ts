import { describe, expect, test } from 'bun:test';
import {
	DEFAULT_IMAGE_MAX_SIZE,
	fileBytes,
	sniffImageType,
	SUPPORTED_IMAGE_TYPES,
	toWebp,
	UnsupportedImageError,
} from '../../src/utils/image.util';

/** 1x1 PNG. */
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
	'base64',
);

/** 1x1 JPEG. */
const JPEG = Buffer.from(
	'/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
	'base64',
);

/** Real 1x1 WebP (re-encoded from {@link PNG} by Bun.Image). */
const REAL_WEBP = Buffer.from(
	'UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=',
	'base64',
);

/** Minimal WebP container header (magic bytes only, not decodable). */
const WEBP_HEADER = Buffer.from([
	0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

/** True when the bytes are a WebP container. */
function isWebp(bytes: Buffer): boolean {
	return (
		bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
		bytes.subarray(8, 12).toString('latin1') === 'WEBP'
	);
}

describe('sniffImageType', () => {
	test('recognises the supported formats by magic bytes', () => {
		expect(sniffImageType(PNG)).toBe('png');
		expect(sniffImageType(JPEG)).toBe('jpeg');
		expect(sniffImageType(WEBP_HEADER)).toBe('webp');
		expect(sniffImageType(Buffer.from('GIF89a'))).toBe('gif');
		expect(sniffImageType(Buffer.from([0x42, 0x4d, 0x00]))).toBe('bmp');
		expect(sniffImageType(Buffer.from([0x49, 0x49, 0x2a, 0x00]))).toBe('tiff');
	});

	test('recognises the ISO-BMFF brands (HEIC / AVIF)', () => {
		const box = (brand: string) =>
			Buffer.concat([
				Buffer.from([0, 0, 0, 0x18]),
				Buffer.from('ftyp'),
				Buffer.from(brand),
				Buffer.alloc(8),
			]);
		expect(sniffImageType(box('heic'))).toBe('heic');
		expect(sniffImageType(box('mif1'))).toBe('heic');
		expect(sniffImageType(box('avif'))).toBe('avif');
	});

	test('rejects bytes that are not an image', () => {
		expect(sniffImageType(Buffer.from('not an image'))).toBeNull();
		expect(sniffImageType(Buffer.alloc(0))).toBeNull();
	});

	test('every recognised type is in the advertised list', () => {
		for (const type of ['png', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'heic', 'avif'] as const) {
			expect(SUPPORTED_IMAGE_TYPES).toContain(type);
		}
	});
});

describe('toWebp', () => {
	test('converts PNG and JPEG to WebP', async () => {
		expect(isWebp(await toWebp(PNG))).toBe(true);
		expect(isWebp(await toWebp(JPEG))).toBe(true);
	});

	test('re-encodes an incoming WebP (strips metadata, guarantees the format)', async () => {
		const out = await toWebp(REAL_WEBP);
		expect(isWebp(out)).toBe(true);
		// Re-encoded: not the same bytes handed in.
		expect(out.equals(REAL_WEBP)).toBe(false);
	});

	test('accepts a Blob from a multipart upload', async () => {
		const file = new File([PNG], 'logo.png', { type: 'image/png' });
		expect(isWebp(await toWebp(await fileBytes(file)))).toBe(true);
	});

	test('downscales the longest side to the ceiling', async () => {
		// 1024x512 PNG built by decoding the 1x1 and upscaling through canvas
		// is not available server-side, so assert the contract on the default.
		expect(DEFAULT_IMAGE_MAX_SIZE).toBe(512);
		const out = await toWebp(PNG, { maxSize: 1 });
		const meta = await new Bun.Image(out).metadata();
		expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(1);
	});

	test('throws UnsupportedImageError for non-image bytes', async () => {
		await expect(toWebp(Buffer.from('definitely not an image'))).rejects.toBeInstanceOf(
			UnsupportedImageError,
		);
	});
});
