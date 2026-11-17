// Unit tests for the CORS allowlist loader (config/loaders/config.loader.ts).
// cors.json is gitignored; the loader must tolerate a missing file but fail
// loudly on a malformed one — a typo must never loosen the allowlist silently.
import { afterAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { loadCorsOrigins } from '../../config/loaders/config.loader';

const tmpDirs: string[] = [];

function makeCorsFile(content: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cors-test-'));
	tmpDirs.push(dir);
	const file = path.join(dir, 'cors.json');
	fs.writeFileSync(file, content, 'utf8');
	return file;
}

afterAll(() => {
	for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe('loadCorsOrigins', () => {
	test('parses a valid allowlist and normalizes entries', () => {
		const file = makeCorsFile(
			JSON.stringify({
				allow: [
					'https://app.example.com/',
					'  http://localhost:5173  ',
					'https://app.example.com',
					'',
				],
			}),
		);
		expect(loadCorsOrigins(file)).toEqual([
			'https://app.example.com',
			'http://localhost:5173',
		]);
	});

	test('blacklist removes entries from allow', () => {
		const file = makeCorsFile(
			JSON.stringify({
				allow: ['https://a.com', 'https://b.com'],
				blacklist: ['https://b.com/'],
			}),
		);
		expect(loadCorsOrigins(file)).toEqual(['https://a.com']);
	});

	test('accepts a blacklist-only file', () => {
		const file = makeCorsFile(
			JSON.stringify({ blacklist: ['https://spam.example'] }),
		);
		// Blacklist-only means "allow nothing (except the blocked list being
		// tracked by the caller)" — an empty allowlist, not null.
		expect(loadCorsOrigins(file)).toEqual([]);
	});

	test('returns null for a missing file', () => {
		expect(
			loadCorsOrigins(path.join(os.tmpdir(), 'cors-test-missing.json')),
		).toBeNull();
	});

	test('treats an accidentally-mounted directory as unset', () => {
		// docker-compose creates a directory when the bind-mount source file
		// does not exist on the host; the loader must treat that as "unset".
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cors-test-dir-'));
		tmpDirs.push(dir);
		expect(loadCorsOrigins(dir)).toBeNull();
	});

	test('throws on invalid JSON', () => {
		const file = makeCorsFile('{ not json');
		expect(() => loadCorsOrigins(file)).toThrow(/Invalid CORS allowlist/);
	});

	test('throws when the file is not an object', () => {
		const file = makeCorsFile(JSON.stringify(['https://a.com']));
		expect(() => loadCorsOrigins(file)).toThrow(/Invalid CORS allowlist/);
	});

	test('throws when an entry is not a string', () => {
		const file = makeCorsFile(
			JSON.stringify({ allow: ['https://a.com', 42] }),
		);
		expect(() => loadCorsOrigins(file)).toThrow(/Invalid CORS allowlist/);
	});

	test('throws on a relative URL entry', () => {
		const file = makeCorsFile(JSON.stringify({ allow: ['/admin'] }));
		expect(() => loadCorsOrigins(file)).toThrow(/origin URL without path/);
	});

	test('throws on an origin with a path', () => {
		const file = makeCorsFile(
			JSON.stringify({ allow: ['https://a.com/app'] }),
		);
		expect(() => loadCorsOrigins(file)).toThrow(/origin URL without path/);
	});

	test('throws when both lists are empty or absent', () => {
		const file = makeCorsFile('{}');
		expect(() => loadCorsOrigins(file)).toThrow(/at least one of/);
	});
});
