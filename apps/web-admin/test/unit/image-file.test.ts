import { describe, expect, test } from 'bun:test';

import {
	MAX_IMAGE_SOURCE_BYTES,
	pickImageFile,
	rejectImageFile,
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
