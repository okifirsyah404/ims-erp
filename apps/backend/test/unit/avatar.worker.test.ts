import { afterEach, describe, expect, test } from 'bun:test';
import {
	avatarApiUrl,
	avatarSeed,
	generateAvatarPng,
} from '../../src/app/user/queues/avatar.worker';
import { avatarObjectKey } from '../../src/providers/s3/s3';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const BASE = 'http://dicebear:3000';
const API = 'http://dicebear:3000/10.x/initials/png';

/** Replaces global fetch for one test and records the requested URLs. */
const originalFetch = globalThis.fetch;
let requested: string[] = [];

function stubFetch(
	respond: (url: string) => Response | Promise<Response> = () =>
		new Response(PNG_MAGIC, { status: 200 }),
): void {
	requested = [];
	globalThis.fetch = (async (
		input: string | URL | Request,
	): Promise<Response> => {
		const url = input instanceof Request ? input.url : String(input);
		requested.push(url);
		return respond(url);
	}) as typeof fetch;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe('avatarApiUrl', () => {
	test('targets the initials PNG style with seed and size', () => {
		const url = new URL(avatarApiUrl(BASE, 'Budi Santoso'));
		expect(`${url.origin}${url.pathname}`).toBe(API);
		expect(url.searchParams.get('seed')).toBe('Budi Santoso');
		expect(url.searchParams.get('size')).toBe('72');
		expect(url.searchParams.get('backgroundColor')).toBe('transparent');
	});

	test('is deterministic for the same seed', () => {
		expect(avatarApiUrl(BASE, 'Budi')).toBe(avatarApiUrl(BASE, 'Budi'));
	});

	test('encodes seeds with spaces and unicode', () => {
		const url = avatarApiUrl(BASE, 'I Nyoman Ñu');
		expect(url).not.toContain(' ');
		expect(new URL(url).searchParams.get('seed')).toBe('I Nyoman Ñu');
	});

	test('tolerates a trailing slash on the base URL', () => {
		expect(avatarApiUrl(`${BASE}/`, 'Budi')).toBe(avatarApiUrl(BASE, 'Budi'));
	});
});

describe('avatarSeed', () => {
	test('uses the trimmed display name', () => {
		expect(avatarSeed('user-1', ' Budi ')).toBe(' Budi ');
	});

	test('falls back to the user id when the name is blank', () => {
		expect(avatarSeed('user-9', '')).toBe('user-9');
		expect(avatarSeed('user-9', '   ')).toBe('user-9');
	});
});

describe('generateAvatarPng', () => {
	test('returns the PNG bytes served by the API', async () => {
		stubFetch();
		const png = await generateAvatarPng('user-1', 'Budi Santoso');
		expect(png.subarray(0, 4).equals(PNG_MAGIC)).toBe(true);
		expect(requested).toHaveLength(1);
		expect(new URL(requested[0]!).searchParams.get('seed')).toBe(
			'Budi Santoso',
		);
	});

	test('seeds with the user id when the name is blank', async () => {
		stubFetch();
		await generateAvatarPng('user-9', '   ');
		expect(new URL(requested[0]!).searchParams.get('seed')).toBe('user-9');
	});

	test('throws on a non-2xx response', async () => {
		stubFetch(() => new Response('nope', { status: 503 }));
		await expect(generateAvatarPng('user-1', 'Budi')).rejects.toThrow(/503/);
	});
});

describe('avatarObjectKey', () => {
	test('uses the user/<userId>/avatar.png pattern', () => {
		expect(avatarObjectKey('abc-123')).toBe('user/abc-123/avatar.png');
	});
});
