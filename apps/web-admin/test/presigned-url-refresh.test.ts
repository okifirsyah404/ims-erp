import { describe, expect, test } from 'bun:test';

import {
	presignedUrlExpiresAt,
	presignedUrlRefreshDelayMs,
} from '../src/lib/user-api';

/** Builds a SigV4-style presigned GET URL issued at `issuedAt` (epoch ms). */
function presigned(url: string, issuedAt: number, expiresIn: number): string {
	const d = new Date(issuedAt);
	const pad = (n: number) => String(n).padStart(2, '0');
	const amzDate =
		`${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
		`T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
	return (
		`https://s3.example.com/${url}` +
		`?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=${amzDate}` +
		`&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=host` +
		`&X-Amz-Signature=deadbeef`
	);
}

describe('presignedUrlExpiresAt', () => {
	test('expiry is X-Amz-Date plus X-Amz-Expires', () => {
		const issuedAt = Date.UTC(2026, 0, 2, 3, 4, 5);
		expect(presignedUrlExpiresAt(presigned('a.png', issuedAt, 300))).toBe(
			issuedAt + 300_000,
		);
	});

	test('is independent of the local clock (absolute, not relative)', () => {
		const issuedAt = Date.UTC(2020, 5, 1);
		// A URL signed long ago keeps its original expiry, however skewed now is.
		expect(presignedUrlExpiresAt(presigned('a.png', issuedAt, 300))).toBe(
			issuedAt + 300_000,
		);
	});

	test('returns null without SigV4 query metadata', () => {
		expect(presignedUrlExpiresAt('https://cdn.example.com/user/1/a.png')).toBeNull();
		expect(presignedUrlExpiresAt('/user/1/avatar-custom.webp')).toBeNull();
		expect(presignedUrlExpiresAt('not a url at all')).toBeNull();
	});

	test('returns null on a malformed X-Amz-Date', () => {
		const url =
			'https://s3.example.com/a.png?X-Amz-Date=2026-01-02T03:04:05Z&X-Amz-Expires=300';
		expect(presignedUrlExpiresAt(url)).toBeNull();
	});
});

describe('presignedUrlRefreshDelayMs', () => {
	test('schedules refresh 30s before expiry', () => {
		const now = Date.now();
		const url = presigned('a.png', now, 300);
		const delay = presignedUrlRefreshDelayMs(url);
		// ~270s, allowing for test execution time.
		expect(delay).toBeGreaterThan(265_000);
		expect(delay).toBeLessThanOrEqual(270_000);
	});

	test('floors at 5s for an already-expired URL (no hot-loop)', () => {
		const url = presigned('a.png', Date.now() - 600_000, 300);
		expect(presignedUrlRefreshDelayMs(url)).toBe(5_000);
	});

	test('floors at 5s when inside the margin but not yet expired', () => {
		const url = presigned('a.png', Date.now() - 290_000, 300);
		expect(presignedUrlRefreshDelayMs(url)).toBe(5_000);
	});

	test('falls back to a periodic refresh for unparseable URLs', () => {
		// 60s fallback TTL minus the 30s margin.
		expect(presignedUrlRefreshDelayMs('https://cdn.example.com/a.png')).toBe(
			30_000,
		);
	});
});
