import { afterEach, describe, expect, test } from 'bun:test';
import {
	avatarApiUrl,
	avatarSeed,
	generateAvatarWebp,
} from '../../src/app/user/queues/avatar.worker';
import { avatarObjectKey } from '../../src/app/user/constants/avatar-keys';

// Minimal WebP container check: 'RIFF' magic + 'WEBP' fourcc at offset 8.
const WEBP_MAGIC = Buffer.concat([
	Buffer.from('RIFF'),
	Buffer.alloc(4),
	Buffer.from('WEBP'),
]);
const BASE = 'http://dicebear:3000';
const API = 'http://dicebear:3000/10.x/initials/webp';

/** Replaces global fetch for one test and records the requested URLs. */
const originalFetch = globalThis.fetch;
let requested: string[] = [];

function stubFetch(
	respond: (url: string) => Response | Promise<Response> = () =>
		new Response(WEBP_MAGIC, { status: 200 }),
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
	test('targets the initials WebP style with seed and size', () => {
		const url = new URL(avatarApiUrl(BASE, 'Budi Santoso'));
		expect(`${url.origin}${url.pathname}`).toBe(API);
		expect(url.searchParams.get('seed')).toBe('Budi Santoso');
		expect(url.searchParams.get('size')).toBe('72');
	});

	test('sends no backgroundColor parameter (v10 rejects transparent)', () => {
		// DiceBear v10 validates backgroundColor against a hex pattern and
		// answers 400 for the legacy `transparent` value. The style default
		// applies instead — the parameter must stay absent, not re-added.
		const url = new URL(avatarApiUrl(BASE, 'Budi Santoso'));
		expect(url.searchParams.has('backgroundColor')).toBe(false);
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

describe('generateAvatarWebp', () => {
	test('returns the WebP bytes served by the API', async () => {
		stubFetch();
		const webp = await generateAvatarWebp('user-1', 'Budi Santoso');
		expect(
			webp.subarray(0, 4).toString() === 'RIFF' &&
				webp.subarray(8, 12).toString() === 'WEBP',
		).toBe(true);
		expect(requested).toHaveLength(1);
		expect(new URL(requested[0]!).searchParams.get('seed')).toBe(
			'Budi Santoso',
		);
	});

	test('seeds with the user id when the name is blank', async () => {
		stubFetch();
		await generateAvatarWebp('user-9', '   ');
		expect(new URL(requested[0]!).searchParams.get('seed')).toBe('user-9');
	});

	test('throws on a non-2xx response', async () => {
		stubFetch(() => new Response('nope', { status: 503 }));
		await expect(generateAvatarWebp('user-1', 'Budi')).rejects.toThrow(/503/);
	});
});

describe('avatarObjectKey', () => {
	test('uses the users/<userId>/avatar.webp pattern', () => {
		expect(avatarObjectKey('abc-123')).toBe('users/abc-123/avatar.webp');
	});
});
