import { describe, expect, test } from 'bun:test';
import {
	generateAvatarPng,
} from '../../src/app/user/queues/avatar.worker';
import { avatarObjectKey } from '../../src/providers/s3/s3';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('generateAvatarPng', () => {
	test('produces a valid PNG buffer', async () => {
		const png = await generateAvatarPng('user-1', 'Budi Santoso');
		expect(png.length).toBeGreaterThan(0);
		expect(png.subarray(0, 4).equals(PNG_MAGIC)).toBe(true);
	});

	test('is deterministic for the same name', async () => {
		const a = await generateAvatarPng('user-1', 'Budi Santoso');
		const b = await generateAvatarPng('user-2', 'Budi Santoso');
		expect(a.equals(b)).toBe(true);
	});

	test('falls back to userId seed when name is blank', async () => {
		const a = await generateAvatarPng('user-9', '');
		const b = await generateAvatarPng('user-9', '   ');
		expect(a.equals(b)).toBe(true);
		// Different from a name-based avatar; seed = userId.
		const named = await generateAvatarPng('user-9', 'user-9');
		expect(a.equals(named)).toBe(true);
	});
});

describe('avatarObjectKey', () => {
	test('uses the user/<userId>/avatar.png pattern', () => {
		expect(avatarObjectKey('abc-123')).toBe('user/abc-123/avatar.png');
	});
});
