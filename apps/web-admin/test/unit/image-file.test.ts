import { describe, expect, test } from 'bun:test';

import {
	DOCUMENT_IMAGE_MAX_SIZE,
	MAX_IMAGE_SOURCE_BYTES,
	pickImageFile,
	rejectImageFile,
	webpDimensions,
} from '../../src/lib/image-file';

/** The dropzone's accept rule (ERP-0041): images only, folders ignored. */
function file(name: string, type: string, size = 3): File {
	return new File([new Uint8Array(size)], name, { type });
}

describe('pickImageFile', () => {
	test('accepts every image MIME type the picker offers', () => {
		expect(pickImageFile(file('logo.webp', 'image/webp'))?.name).toBe('logo.webp');
		expect(pickImageFile(file('logo.png', 'image/png'))?.name).toBe('logo.png');
	});

	test('falls back to the extension when the browser reports no type', () => {
		// Dragging from Windows Explorer can hand over an empty MIME type.
		expect(pickImageFile(file('logo.PNG', ''))?.name).toBe('logo.PNG');
		expect(pickImageFile(file('photo.jpeg', ''))?.name).toBe('photo.jpeg');
	});

	test('rejects a non-image drop', () => {
		expect(pickImageFile(file('notes.txt', 'text/plain'))).toBeNull();
		// A dropped folder arrives with an empty type and no extension.
		expect(pickImageFile(file('folder', ''))).toBeNull();
		expect(pickImageFile(file('archive.zip', ''))).toBeNull();
	});

	test('rejects an oversized source before decoding it', () => {
		const huge = file('huge.png', 'image/png', MAX_IMAGE_SOURCE_BYTES + 1);
		expect(rejectImageFile(huge)).toBe('size');
		expect(pickImageFile(huge)).toBeNull();
	});

	test('ignores an empty drop', () => {
		expect(pickImageFile(null)).toBeNull();
		expect(pickImageFile(undefined)).toBeNull();
		expect(rejectImageFile(null)).toBeNull();
	});
});

describe('webpDimensions', () => {
	test('downscales the longest side to the cap, preserving the aspect ratio', () => {
		expect(webpDimensions(4000, 3000)).toEqual({ width: 1024, height: 768 });
		expect(webpDimensions(3000, 4000)).toEqual({ width: 768, height: 1024 });
	});

	test('never upscales a small source', () => {
		expect(webpDimensions(64, 48)).toEqual({ width: 64, height: 48 });
		// A 1px sliver is already inside the cap, so it stays 1px wide.
		expect(webpDimensions(1, 900)).toEqual({ width: 1, height: 900 });
	});

	test('honours a custom cap and never returns zero', () => {
		expect(webpDimensions(2000, 1000, 512)).toEqual({ width: 512, height: 256 });
		// A very wide panorama rounds the short side down, but not to zero.
		expect(webpDimensions(10_000, 10, 100)).toEqual({ width: 100, height: 1 });
	});

	test('the default cap is the 1024px document rule', () => {
		expect(DOCUMENT_IMAGE_MAX_SIZE).toBe(1024);
		expect(webpDimensions(2048, 2048)).toEqual({ width: 1024, height: 1024 });
	});
});
