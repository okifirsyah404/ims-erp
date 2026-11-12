import { describe, expect, test } from 'bun:test';

import { pickImageFile } from '../../src/lib/image-file';

/** The dropzone's accept rule (ERP-0041): images only, folders ignored. */
function file(name: string, type: string): File {
	return new File(['x'], name, { type });
}

describe('pickImageFile', () => {
	test('accepts every image MIME type the picker offers', () => {
		expect(pickImageFile(file('logo.webp', 'image/webp'))?.name).toBe('logo.webp');
		expect(pickImageFile(file('logo.png', 'image/png'))?.name).toBe('logo.png');
	});

	test('rejects a non-image drop', () => {
		expect(pickImageFile(file('notes.txt', 'text/plain'))).toBeNull();
		// A dropped folder arrives with an empty type.
		expect(pickImageFile(file('folder', ''))).toBeNull();
	});

	test('ignores an empty drop', () => {
		expect(pickImageFile(null)).toBeNull();
		expect(pickImageFile(undefined)).toBeNull();
	});
});
