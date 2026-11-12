import { afterEach, describe, expect, test } from 'bun:test';

import { encodeImage } from '../../src/lib/image-file';

/**
 * `encodeImage` runs in the browser; these tests stub just the DOM pieces it
 * touches (`createImageBitmap`, a canvas, `Image`).
 */

const original = {
	createImageBitmap: globalThis.createImageBitmap,
	document: (globalThis as { document?: unknown }).document,
	Image: (globalThis as { Image?: unknown }).Image,
	createObjectURL: URL.createObjectURL,
	revokeObjectURL: URL.revokeObjectURL,
};

/** Installs a canvas whose `toBlob` hands back whatever `encode` produces. */
function stubCanvas(encode: (type: string) => Blob | null) {
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => ({ drawImage: () => {} }),
		toBlob: (callback: (blob: Blob | null) => void, type: string) => {
			callback(encode(type));
		},
	};
	(globalThis as { document?: unknown }).document = {
		createElement: () => canvas,
	};
	globalThis.createImageBitmap = (async () => ({
		width: 1024,
		height: 512,
		close: () => {},
	})) as unknown as typeof createImageBitmap;
}

const file = new File([new Uint8Array([1, 2, 3])], 'photo.heic', {
	type: 'image/heic',
});

afterEach(() => {
	globalThis.createImageBitmap = original.createImageBitmap;
	(globalThis as { document?: unknown }).document = original.document;
	(globalThis as { Image?: unknown }).Image = original.Image;
	URL.createObjectURL = original.createObjectURL;
	URL.revokeObjectURL = original.revokeObjectURL;
});

describe('encodeImage', () => {
	test('returns WebP when the browser can encode it', async () => {
		stubCanvas(() => new Blob(['x'], { type: 'image/webp' }));
		const encoded = await encodeImage(file);
		expect(encoded.extension).toBe('webp');
		expect(encoded.blob.type).toBe('image/webp');
	});

	test('falls back to PNG instead of failing when WebP is unavailable', async () => {
		// A browser without a WebP encoder silently hands back PNG.
		stubCanvas(() => new Blob(['x'], { type: 'image/png' }));
		const encoded = await encodeImage(file);
		expect(encoded.extension).toBe('png');
		expect(encoded.blob.type).toBe('image/png');
	});

	test('decodes through <img> when createImageBitmap rejects the format', async () => {
		stubCanvas(() => new Blob(['x'], { type: 'image/webp' }));
		globalThis.createImageBitmap = (async () => {
			throw new Error('unsupported');
		}) as unknown as typeof createImageBitmap;
		URL.createObjectURL = () => 'blob:stub';
		URL.revokeObjectURL = () => {};
		(globalThis as { Image?: unknown }).Image = class {
			naturalWidth = 640;
			naturalHeight = 480;
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			set src(_value: string) {
				queueMicrotask(() => this.onload?.());
			}
		};
		const encoded = await encodeImage(file);
		expect(encoded.extension).toBe('webp');
	});

	test('rejects when nothing can be encoded', async () => {
		stubCanvas(() => null);
		await expect(encodeImage(file)).rejects.toThrow('Image encoding failed');
	});
});
